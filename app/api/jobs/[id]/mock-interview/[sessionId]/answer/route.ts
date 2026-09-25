import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

import {
  scoreInterviewAnswer,
} from "@/lib/ai/score-interview-answer";

import {
  generateAdaptiveQuestion,
} from "@/lib/ai/adaptive-interviewer";

type RouteContext = {
  params: Promise<{
    id: string;
    sessionId: string;
  }>;
};

export async function POST(
  request: Request,
  { params }: RouteContext,
) {
  try {
    const { id: jobId, sessionId } = await params;

    const body = await request.json();

    const questionId =
      typeof body.question_id === "string"
        ? body.question_id
        : "";

    const answer =
      typeof body.answer === "string"
        ? body.answer.trim()
        : "";

    if (!questionId) {
      return NextResponse.json(
        {
          error: "question_id is required.",
        },
        { status: 400 },
      );
    }

    if (!answer) {
      return NextResponse.json(
        {
          error: "Please provide an answer.",
        },
        { status: 400 },
      );
    }

    if (answer.length < 3) {
      return NextResponse.json(
        {
          error: "Please give a more complete answer.",
        },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    const { data: session, error: sessionError } = await supabase
      .from("interview_sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("job_id", jobId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        {
          error: "Interview session not found.",
        },
        { status: 404 },
      );
    }

    if (session.status !== "active") {
      return NextResponse.json(
        {
          error: "This interview session is no longer active.",
        },
        { status: 400 },
      );
    }

    if (
      session.current_question_id &&
      session.current_question_id !== questionId
    ) {
      return NextResponse.json(
        {
          error:
            "This is not the current interview question. Refresh the interview.",
        },
        { status: 409 },
      );
    }

    const { data: question, error: questionError } = await supabase
      .from("interview_questions")
      .select("*")
      .eq("id", questionId)
      .eq("job_id", jobId)
      .single();

    if (questionError || !question) {
      return NextResponse.json(
        {
          error: "Interview question not found.",
        },
        { status: 404 },
      );
    }

    const { data: existingAnswer } = await supabase
      .from("interview_answers")
      .select("id")
      .eq("session_id", sessionId)
      .eq("question_id", questionId)
      .maybeSingle();

    if (existingAnswer) {
      return NextResponse.json(
        {
          error: "This question has already been answered.",
        },
        { status: 409 },
      );
    }

    const { data: profile } = await supabase
      .from("candidate_profiles")
      .select("*")
      .eq("id", session.profile_id)
      .single();

    const scoring = await scoreInterviewAnswer({
      question: question.question,
      category: question.category,
      difficulty: question.difficulty,
      targetSkill: question.target_skill,
      answer,
    });

    const currentTurn = (session.current_question_index ?? 0) + 1;
    const totalQuestions = session.total_questions || 12;
    const isLastQuestion = currentTurn >= totalQuestions;

    let nextQuestion = null;
    let adaptiveDecision = null;

    if (!isLastQuestion) {
      const { data: priorAnswers } = await supabase
        .from("interview_answers")
        .select(`
          answer_text,
          overall_score,
          feedback,
          score_breakdown,
          question:interview_questions(
            question,
            category,
            target_skill
          )
        `)
        .eq("session_id", sessionId)
        .order("answered_at", { ascending: true });

      const { data: availableQuestions } = await supabase
        .from("interview_questions")
        .select(
          "id, question, category, difficulty, target_skill",
        )
        .eq("job_id", jobId)
        .eq("profile_id", session.profile_id)
        .neq("status", "adaptive");

      const answeredQuestionIds = new Set(
        (priorAnswers ?? []).map(
          (item) =>
            (
              item.question as {
                question?: string;
              } | null
            )?.question,
        ),
      );

      const availableTopics = Array.from(
        new Set(
          (availableQuestions ?? [])
            .filter(
              (item) =>
                item.id !== questionId &&
                !answeredQuestionIds.has(item.question),
            )
            .map((item) => item.target_skill)
            .filter(Boolean),
        ),
      );

      const { data: projects } = await supabase
        .from("project_recommendations")
        .select(
          "title, status, target_skills, tech_stack, architecture",
        )
        .eq("job_id", jobId)
        .limit(8);

      const history = (priorAnswers ?? [])
        .map((item) => {
          const questionData = item.question as {
            question?: string;
            category?: string;
            target_skill?: string;
          } | null;

          const scoreBreakdown =
            item.score_breakdown &&
            typeof item.score_breakdown === "object"
              ? (item.score_breakdown as Record<string, unknown>)
              : {};

          const missingConcepts = Array.isArray(
            scoreBreakdown.missing_concepts,
          )
            ? scoreBreakdown.missing_concepts.filter(
                (item): item is string =>
                  typeof item === "string",
              )
            : [];

          return {
            question: questionData?.question ?? "",
            category: questionData?.category ?? "technical",
            target_skill: questionData?.target_skill ?? "",
            answer: item.answer_text,
            overall_score: Number(item.overall_score ?? 0),
            missing_concepts: missingConcepts,
          };
        })
        .filter((item) => item.question);

      adaptiveDecision = await generateAdaptiveQuestion({
        currentQuestion: {
          question: question.question,
          category: question.category,
          difficulty: question.difficulty,
          target_skill: question.target_skill,
        },

        answer,

        score: {
          correctness_score: scoring.correctness_score,
          structure_score: scoring.structure_score,
          specificity_score: scoring.specificity_score,
          communication_score: scoring.communication_score,
          overall_score: scoring.overall_score,
          missing_concepts: scoring.missing_concepts,
        },

        history,

        availableTopics,

        projects: (projects ?? []).map((project) => ({
          title: project.title,
          status: project.status,
          target_skills: project.target_skills ?? [],
          tech_stack: project.tech_stack ?? [],
          architecture: project.architecture ?? "",
        })),
      });

      const { data: generatedQuestion, error: nextQuestionError } =
        await supabase
          .from("interview_questions")
          .insert({
            job_id: jobId,
            profile_id: session.profile_id,
            project_id: null,
            question: adaptiveDecision.question,
            category: adaptiveDecision.category,
            difficulty: adaptiveDecision.difficulty,
            target_skill: adaptiveDecision.target_skill,
            why_asked: adaptiveDecision.why_asked,
            ideal_answer: adaptiveDecision.ideal_answer,
            key_points: adaptiveDecision.key_points,
            follow_up_questions:
              adaptiveDecision.follow_up_questions,
            source_type: adaptiveDecision.source_type,
            status: "adaptive",
            confidence_score: 0,
          })
          .select("*")
          .single();

      if (nextQuestionError || !generatedQuestion) {
        console.warn(
          "Adaptive question insert failed. Falling back.",
          nextQuestionError,
        );
      } else {
        nextQuestion = generatedQuestion;
      }
    }

    if (!nextQuestion && !isLastQuestion) {
      const { data: answeredRows } = await supabase
        .from("interview_answers")
        .select("question_id")
        .eq("session_id", sessionId);

      const answeredIds = new Set(
        (answeredRows ?? []).map((row) => row.question_id),
      );

      const { data: fallbackQuestions } = await supabase
        .from("interview_questions")
        .select("*")
        .eq("job_id", jobId)
        .eq("profile_id", session.profile_id)
        .neq("status", "adaptive")
        .order("created_at", { ascending: true })
        .order("id", { ascending: true });

      nextQuestion =
        fallbackQuestions?.find(
          (item) =>
            item.id !== questionId &&
            !answeredIds.has(item.id),
        ) ?? null;
    }

    const { data: savedAnswer, error: answerInsertError } =
      await supabase
        .from("interview_answers")
        .insert({
          session_id: sessionId,
          question_id: questionId,
          answer_text: answer,
          correctness_score: scoring.correctness_score,
          structure_score: scoring.structure_score,
          specificity_score: scoring.specificity_score,
          communication_score:
            scoring.communication_score,
          overall_score: scoring.overall_score,
          feedback: scoring.feedback,
          stronger_answer: scoring.stronger_answer,
          score_breakdown: {
            ...scoring.score_breakdown,
            answer_summary: scoring.answer_summary,
            missing_concepts: scoring.missing_concepts,
            adaptive_decision: adaptiveDecision,
          },
        })
        .select("*")
        .single();

    if (answerInsertError || !savedAnswer) {
      return NextResponse.json(
        {
          error:
            answerInsertError?.message ??
            "Could not save interview answer.",
        },
        { status: 500 },
      );
    }

    const nextIndex = currentTurn;

    if (isLastQuestion || !nextQuestion) {
      const { data: updatedSession } = await supabase
        .from("interview_sessions")
        .update({
          status: "completed",
          current_question_index: nextIndex,
          current_question_id: null,
          completed_at: new Date().toISOString(),
        })
        .eq("id", sessionId)
        .select("*")
        .single();

      return NextResponse.json({
        success: true,
        completed: true,
        answer: savedAnswer,
        scoring,
        adaptiveDecision,
        session: updatedSession,
        nextQuestion: null,
        nextQuestionIndex: null,
      });
    }

    const { data: updatedSession, error: sessionUpdateError } =
      await supabase
        .from("interview_sessions")
        .update({
          current_question_index: nextIndex,
          current_question_id: nextQuestion.id,
        })
        .eq("id", sessionId)
        .select("*")
        .single();

    if (sessionUpdateError) {
      return NextResponse.json(
        {
          error: sessionUpdateError.message,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      completed: false,
      answer: savedAnswer,
      scoring,
      adaptiveDecision,
      session: updatedSession,
      nextQuestion,
      nextQuestionIndex: nextIndex,
    });
  } catch (error) {
    console.error("Mock interview answer error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to process interview answer.",
      },
      { status: 500 },
    );
  }
}
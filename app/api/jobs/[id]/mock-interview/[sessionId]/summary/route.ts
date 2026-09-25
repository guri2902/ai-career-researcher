import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

import {
  summarizeInterview,
} from "@/lib/ai/summarize-interview";

import {
  aggregateInterviewSkillPerformance,
  type InterviewSkillPerformance,
  type InterviewSkillAnswer,
} from "@/lib/skills/interview-performance";

type RouteContext = {
  params: Promise<{
    id: string;
    sessionId: string;
  }>;
};

type QuestionData = {
  question: string;
  category: string;
  target_skill: string;
};

type RawAnswer = {
  id: string;
  question_id: string;
  answer_text: string;
  correctness_score: number | null;
  structure_score: number | null;
  specificity_score: number | null;
  communication_score: number | null;
  overall_score: number | null;
  feedback: string | null;
  stronger_answer: string | null;
  score_breakdown: unknown;
  answered_at: string;
  question:
    | QuestionData[]
    | QuestionData
    | null;
};

type TopicPerformance = {
  skill: string;
  questions: number;
  averageScore: number;
  performanceLevel:
    | "strong"
    | "developing"
    | "weak"
    | "insufficient";
};

function getQuestionData(
  value: unknown,
): QuestionData | null {
  if (Array.isArray(value)) {
    const first = value[0];

    if (
      first &&
      typeof first === "object"
    ) {
      const item =
        first as Record<
          string,
          unknown
        >;

      return {
        question:
          typeof item.question ===
          "string"
            ? item.question
            : "Unknown question",

        category:
          typeof item.category ===
          "string"
            ? item.category
            : "technical",

        target_skill:
          typeof item.target_skill ===
          "string"
            ? item.target_skill
            : "General",
      };
    }

    return null;
  }

  if (
    value &&
    typeof value === "object"
  ) {
    const item =
      value as Record<
        string,
        unknown
      >;

    return {
      question:
        typeof item.question ===
        "string"
          ? item.question
          : "Unknown question",

      category:
        typeof item.category ===
        "string"
          ? item.category
          : "technical",

      target_skill:
        typeof item.target_skill ===
        "string"
          ? item.target_skill
          : "General",
    };
  }

  return null;
}

export async function GET(
  _request: Request,
  { params }: RouteContext,
) {
  try {
    const {
      id: jobId,
      sessionId,
    } = await params;

    const supabase =
      await createClient();

    // --------------------------------------------------
    // Load session
    // --------------------------------------------------

    const {
      data: session,
      error: sessionError,
    } = await supabase
      .from("interview_sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("job_id", jobId)
      .single();

    if (
      sessionError ||
      !session
    ) {
      return NextResponse.json(
        {
          error:
            "Interview session not found.",
        },
        { status: 404 },
      );
    }

    // --------------------------------------------------
    // Load job
    // --------------------------------------------------

    const {
      data: job,
      error: jobError,
    } = await supabase
      .from("jobs")
      .select(
        "id, title, company_name",
      )
      .eq("id", jobId)
      .single();

    if (
      jobError ||
      !job
    ) {
      return NextResponse.json(
        {
          error: "Job not found.",
        },
        { status: 404 },
      );
    }

    // --------------------------------------------------
    // Load answers
    // --------------------------------------------------

    const {
      data: answers,
      error: answersError,
    } = await supabase
      .from("interview_answers")
      .select(
        `
        id,
        question_id,
        answer_text,
        correctness_score,
        structure_score,
        specificity_score,
        communication_score,
        overall_score,
        feedback,
        stronger_answer,
        score_breakdown,
        answered_at,
        question:interview_questions(
          question,
          category,
          target_skill
        )
      `,
      )
      .eq("session_id", sessionId)
      .order("answered_at", {
        ascending: true,
      });

    if (answersError) {
      return NextResponse.json(
        {
          error:
            answersError.message,
        },
        { status: 500 },
      );
    }

    const allAnswers =
      (answers ??
        []) as unknown as RawAnswer[];

    // --------------------------------------------------
    // Separate answered/skipped
    // --------------------------------------------------

    const answeredQuestions: RawAnswer[] =
      allAnswers.filter(
        (answer: RawAnswer) =>
          answer.answer_text !==
          "[Question skipped by candidate]",
      );

    const skippedQuestions: RawAnswer[] =
      allAnswers.filter(
        (answer: RawAnswer) =>
          answer.answer_text ===
          "[Question skipped by candidate]",
      );

    // --------------------------------------------------
    // Overall score
    // --------------------------------------------------

    const validScores: number[] =
      answeredQuestions
        .map(
          (answer: RawAnswer) =>
            Number(
              answer.overall_score ?? 0,
            ),
        )
        .filter(
          (score: number) =>
            Number.isFinite(score) &&
            score > 0,
        );

    const calculatedOverall =
      validScores.length > 0
        ? validScores.reduce(
            (
              sum: number,
              score: number,
            ) => sum + score,
            0,
          ) / validScores.length
        : 0;

    const overallScore =
      Number(
        calculatedOverall.toFixed(2),
      );

    // --------------------------------------------------
    // Build skill-level answer evidence
    // --------------------------------------------------

    const skillAnswers: InterviewSkillAnswer[] =
      answeredQuestions
        .map(
          (
            answer: RawAnswer,
          ): InterviewSkillAnswer | null => {
            const question =
              getQuestionData(
                answer.question,
              );

            if (!question) {
              return null;
            }

            const answerScore =
              Number(
                answer.overall_score ??
                  0,
              );

            if (
              !Number.isFinite(
                answerScore,
              ) ||
              answerScore <= 0
            ) {
              return null;
            }

            return {
              skill_name:
                question.target_skill,

              overall_score:
                answerScore,

              correctness_score:
                answer.correctness_score,

              structure_score:
                answer.structure_score,

              specificity_score:
                answer.specificity_score,

              communication_score:
                answer.communication_score,

              feedback:
                answer.feedback,
            };
          },
        )
        .filter(
          (
            answer: InterviewSkillAnswer | null,
          ): answer is InterviewSkillAnswer =>
            answer !== null,
        );

    // --------------------------------------------------
    // Aggregate performance by skill
    // --------------------------------------------------

    const skillPerformance: InterviewSkillPerformance[] =
      aggregateInterviewSkillPerformance(
        skillAnswers,
      );

    // --------------------------------------------------
    // Save skill performance
    // --------------------------------------------------

    if (
      skillPerformance.length > 0
    ) {
      const rows =
        skillPerformance.map(
          (
            performance: InterviewSkillPerformance,
          ) => ({
            session_id:
              sessionId,

            job_id:
              jobId,

            profile_id:
              session.profile_id,

            skill_name:
              performance.skill_name,

            question_count:
              performance.question_count,

            average_score:
              performance.average_score,

            correctness_score:
              performance.correctness_score,

            structure_score:
              performance.structure_score,

            specificity_score:
              performance.specificity_score,

            communication_score:
              performance.communication_score,

            performance_level:
              performance.performance_level,

            evidence_summary:
              performance.evidence_summary,

            strengths:
              performance.strengths,

            weaknesses:
              performance.weaknesses,

            updated_at:
              new Date().toISOString(),
          }),
        );

      const {
        error: performanceError,
      } = await supabase
        .from(
          "interview_skill_performance",
        )
        .upsert(rows, {
          onConflict:
            "session_id,skill_name",
        });

      if (performanceError) {
        console.error(
          "Interview skill performance save error:",
          performanceError,
        );

        return NextResponse.json(
          {
            error:
              "Interview report was calculated, but skill performance could not be saved: " +
              performanceError.message,
          },
          { status: 500 },
        );
      }
    }

    // --------------------------------------------------
    // Topic performance for UI
    // --------------------------------------------------

    const topicPerformance: TopicPerformance[] =
      skillPerformance
        .map(
          (
            performance: InterviewSkillPerformance,
          ): TopicPerformance => ({
            skill:
              performance.skill_name,

            questions:
              performance.question_count,

            averageScore:
              performance.average_score,

            performanceLevel:
              performance.performance_level,
          }),
        )
        .sort(
          (
            a: TopicPerformance,
            b: TopicPerformance,
          ) =>
            b.averageScore -
            a.averageScore,
        );

    // --------------------------------------------------
    // Existing AI report data
    // --------------------------------------------------

    const answerRows =
      answeredQuestions.map(
        (
          answer: RawAnswer,
        ) => {
          const question =
            getQuestionData(
              answer.question,
            );

          const skill =
            question?.target_skill ??
            "General";

          return {
            question:
              question?.question ??
              "Unknown question",

            category:
              question?.category ??
              "technical",

            targetSkill:
              skill,

            score:
              Number(
                answer.overall_score ??
                  0,
              ),

            feedback:
              answer.feedback ??
              "",
          };
        },
      );

    let summary =
      typeof session.summary ===
      "string"
        ? session.summary
        : null;

    let strengths: string[] =
      Array.isArray(
        session.strengths,
      )
        ? session.strengths
        : [];

    let weaknesses: string[] =
      Array.isArray(
        session.weaknesses,
      )
        ? session.weaknesses
        : [];

    // --------------------------------------------------
    // AI summary
    // --------------------------------------------------

    if (
      !summary ||
      strengths.length === 0 ||
      weaknesses.length === 0
    ) {
      try {
        const aiSummary =
          await summarizeInterview({
            jobTitle:
              job.title ??
              "Target role",

            companyName:
              job.company_name ??
              "Target company",

            totalQuestions:
              session.total_questions ??
              0,

            answeredQuestions:
              answeredQuestions.length,

            skippedQuestions:
              skippedQuestions.length,

            overallScore,

            topicPerformance:
              topicPerformance.map(
                (
                  topic: TopicPerformance,
                ) => ({
                  skill:
                    topic.skill,

                  questions:
                    topic.questions,

                  averageScore:
                    topic.averageScore,
                }),
              ),

            answers:
              answerRows,
          });

        summary =
          aiSummary.summary;

        strengths =
          aiSummary.strengths;

        weaknesses =
          aiSummary.weaknesses;
      } catch (aiError) {
        console.warn(
          "Interview summary AI failed:",
          aiError,
        );

        const strongestTopic =
          topicPerformance[0];

        const weakestTopic =
          topicPerformance[
            topicPerformance.length -
              1
          ];

        summary =
          `The candidate completed ${answeredQuestions.length} answered question(s) out of ${
            session.total_questions ?? 0
          }. The overall interview score was ${overallScore.toFixed(
            2,
          )}/5.`;

        strengths =
          strongestTopic
            ? [
                `${strongestTopic.skill} averaged ${strongestTopic.averageScore.toFixed(
                  2,
                )}/5.`,
              ]
            : [];

        weaknesses =
          weakestTopic
            ? [
                `${weakestTopic.skill} averaged ${weakestTopic.averageScore.toFixed(
                  2,
                )}/5 and should be reviewed.`,
              ]
            : [];
      }
    }

    // --------------------------------------------------
    // Save overall interview report
    // --------------------------------------------------

    const {
      data: updatedSession,
      error: updateSessionError,
    } = await supabase
      .from("interview_sessions")
      .update({
        overall_score:
          overallScore,

        strengths,

        weaknesses,

        summary,
      })
      .eq("id", sessionId)
      .select("*")
      .single();

    if (updateSessionError) {
      console.warn(
        "Could not update interview session summary:",
        updateSessionError,
      );
    }

    // --------------------------------------------------
    // Return report
    // --------------------------------------------------

    return NextResponse.json({
      success: true,

      session:
        updatedSession ??
        session,

      metrics: {
        totalQuestions:
          session.total_questions ??
          0,

        answeredQuestions:
          answeredQuestions.length,

        skippedQuestions:
          skippedQuestions.length,

        overallScore,
      },

      topicPerformance,

      strengths,

      weaknesses,

      summary,

      skillPerformance,

      answers: allAnswers.map(
        (
          answer: RawAnswer,
        ) => {
          const question =
            getQuestionData(
              answer.question,
            );

          return {
            id: answer.id,

            question:
              question?.question ??
              "Unknown question",

            category:
              question?.category ??
              "technical",

            targetSkill:
              question?.target_skill ??
              "General",

            answer:
              answer.answer_text,

            score:
              Number(
                answer.overall_score ??
                  0,
              ),

            correctness:
              answer.correctness_score,

            structure:
              answer.structure_score,

            specificity:
              answer.specificity_score,

            communication:
              answer.communication_score,

            feedback:
              answer.feedback,

            strongerAnswer:
              answer.stronger_answer,

            skipped:
              answer.answer_text ===
              "[Question skipped by candidate]",
          };
        },
      ),
    });
  } catch (error) {
    console.error(
      "Interview summary error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to generate interview summary.",
      },
      { status: 500 },
    );
  }
}
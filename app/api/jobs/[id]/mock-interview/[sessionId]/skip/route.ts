import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

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

    if (!questionId) {
      return NextResponse.json(
        {
          error: "question_id is required.",
        },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    const { data: session, error: sessionError } =
      await supabase
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
            "This is not the current interview question.",
        },
        { status: 409 },
      );
    }

    const { data: existingAnswer } =
      await supabase
        .from("interview_answers")
        .select("id")
        .eq("session_id", sessionId)
        .eq("question_id", questionId)
        .maybeSingle();

    if (!existingAnswer) {
      const { error: skipInsertError } =
        await supabase
          .from("interview_answers")
          .insert({
            session_id: sessionId,
            question_id: questionId,
            answer_text: "[Question skipped by candidate]",
            feedback:
              "The candidate skipped this question.",
            score_breakdown: {
              skipped: true,
            },
          });

      if (skipInsertError) {
        return NextResponse.json(
          {
            error: skipInsertError.message,
          },
          { status: 500 },
        );
      }
    }

    /*
     * Prefer an unanswered original question from the
     * generated interview bank so Skip usually changes
     * the topic instead of immediately generating another
     * follow-up on the same topic.
     */
    const { data: answeredRows } =
      await supabase
        .from("interview_answers")
        .select("question_id")
        .eq("session_id", sessionId);

    const answeredIds = new Set(
      (answeredRows ?? []).map(
        (row) => row.question_id,
      ),
    );

    const { data: baseQuestions } =
      await supabase
        .from("interview_questions")
        .select("*")
        .eq("job_id", jobId)
        .eq("profile_id", session.profile_id)
        .neq("status", "adaptive")
        .order("created_at", {
          ascending: true,
        })
        .order("id", {
          ascending: true,
        });

    let nextQuestion =
      baseQuestions?.find(
        (item) =>
          item.id !== questionId &&
          !answeredIds.has(item.id),
      ) ?? null;

    /*
     * If there is no original question left, use any
     * unanswered question as a fallback.
     */
    if (!nextQuestion) {
      const { data: allQuestions } =
        await supabase
          .from("interview_questions")
          .select("*")
          .eq("job_id", jobId)
          .eq("profile_id", session.profile_id)
          .order("created_at", {
            ascending: true,
          })
          .order("id", {
            ascending: true,
          });

      nextQuestion =
        allQuestions?.find(
          (item) =>
            item.id !== questionId &&
            !answeredIds.has(item.id),
        ) ?? null;
    }

    const nextIndex =
      (session.current_question_index ?? 0) + 1;

    if (!nextQuestion) {
      const { data: completedSession } =
        await supabase
          .from("interview_sessions")
          .update({
            status: "completed",
            current_question_index: nextIndex,
            current_question_id: null,
            completed_at:
              new Date().toISOString(),
          })
          .eq("id", sessionId)
          .select("*")
          .single();

      return NextResponse.json({
        success: true,
        completed: true,
        session: completedSession,
        nextQuestion: null,
        nextQuestionIndex: null,
      });
    }

    const { data: updatedSession, error: updateError } =
      await supabase
        .from("interview_sessions")
        .update({
          current_question_index: nextIndex,
          current_question_id: nextQuestion.id,
        })
        .eq("id", sessionId)
        .select("*")
        .single();

    if (updateError) {
      return NextResponse.json(
        {
          error: updateError.message,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      completed: false,
      session: updatedSession,
      nextQuestion,
      nextQuestionIndex: nextIndex,
    });
  } catch (error) {
    console.error(
      "Mock interview skip error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to skip question.",
      },
      { status: 500 },
    );
  }
}
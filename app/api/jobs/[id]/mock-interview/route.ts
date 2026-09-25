import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

const DEFAULT_INTERVIEW_TURNS = 12;

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(
  _request: Request,
  { params }: RouteContext,
) {
  try {
    const { id: jobId } = await params;

    const supabase = await createClient();

    const { data: profile, error: profileError } =
      await supabase
        .from("candidate_profiles")
        .select("*")
        .limit(1)
        .maybeSingle();

    if (profileError) {
      return NextResponse.json(
        {
          error: profileError.message,
        },
        { status: 500 },
      );
    }

    if (!profile) {
      return NextResponse.json(
        {
          error:
            "Create a candidate profile before starting an interview.",
        },
        { status: 400 },
      );
    }

    const { data: job, error: jobError } =
      await supabase
        .from("jobs")
        .select("id, title, company_name")
        .eq("id", jobId)
        .single();

    if (jobError || !job) {
      return NextResponse.json(
        {
          error: "Job not found.",
        },
        { status: 404 },
      );
    }

    const {
      data: questions,
      error: questionsError,
    } = await supabase
      .from("interview_questions")
      .select("*")
      .eq("job_id", jobId)
      .eq("profile_id", profile.id)
      .neq("status", "adaptive")
      .order("created_at", {
        ascending: true,
      })
      .order("id", {
        ascending: true,
      });

    if (questionsError) {
      return NextResponse.json(
        {
          error: questionsError.message,
        },
        { status: 500 },
      );
    }

    if (!questions || questions.length === 0) {
      return NextResponse.json(
        {
          error:
            "No interview questions exist for this job. Generate the question bank first.",
        },
        { status: 400 },
      );
    }

    /*
     * Resume an ACTIVE or PAUSED session.
     * Abandoned/completed sessions are not resumed.
     */
    const {
      data: existingSession,
      error: sessionLookupError,
    } = await supabase
      .from("interview_sessions")
      .select("*")
      .eq("job_id", jobId)
      .eq("profile_id", profile.id)
      .in("status", ["active", "paused"])
      .order("created_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (sessionLookupError) {
      return NextResponse.json(
        {
          error: sessionLookupError.message,
        },
        { status: 500 },
      );
    }

    let session = existingSession;

    if (!session) {
      const firstQuestion = questions[0];

      const {
        data: createdSession,
        error: createError,
      } = await supabase
        .from("interview_sessions")
        .insert({
          job_id: jobId,
          profile_id: profile.id,
          status: "active",
          current_question_index: 0,
          current_question_id: firstQuestion.id,
          total_questions:
            DEFAULT_INTERVIEW_TURNS,
          paused_at: null,
          ended_at: null,
        })
        .select("*")
        .single();

      if (createError || !createdSession) {
        return NextResponse.json(
          {
            error:
              createError?.message ??
              "Unable to create interview session.",
          },
          { status: 500 },
        );
      }

      session = createdSession;
    }

    let currentQuestion = null;

    if (session.current_question_id) {
      const {
        data: storedQuestion,
      } = await supabase
        .from("interview_questions")
        .select("*")
        .eq("id", session.current_question_id)
        .eq("job_id", jobId)
        .eq("profile_id", profile.id)
        .maybeSingle();

      currentQuestion =
        storedQuestion ?? null;
    }

    /*
     * If the saved current question cannot be found,
     * find the first unanswered question.
     */
    if (!currentQuestion) {
      const { data: answered } =
        await supabase
          .from("interview_answers")
          .select("question_id")
          .eq("session_id", session.id);

      const answeredIds = new Set(
        (answered ?? []).map(
          (row) => row.question_id,
        ),
      );

      currentQuestion =
        questions.find(
          (item) => !answeredIds.has(item.id),
        ) ?? questions[0];

      await supabase
        .from("interview_sessions")
        .update({
          current_question_id:
            currentQuestion.id,
        })
        .eq("id", session.id);
    }

    return NextResponse.json({
      success: true,

      job,

      session: {
        ...session,

        current_question_id:
          currentQuestion.id,
      },

      question: currentQuestion,

      questionNumber:
        (session.current_question_index ?? 0) + 1,

      totalQuestions:
        session.total_questions ||
        DEFAULT_INTERVIEW_TURNS,

      resumed:
        Boolean(existingSession),

      paused:
        session.status === "paused",
    });
  } catch (error) {
    console.error(
      "Mock interview start/resume error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to start mock interview.",
      },
      { status: 500 },
    );
  }
}
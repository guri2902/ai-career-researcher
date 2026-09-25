import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{
    id: string;
    sessionId: string;
  }>;
};

export async function POST(
  _request: Request,
  { params }: RouteContext,
) {
  try {
    const {
      id: jobId,
      sessionId,
    } = await params;

    const supabase = await createClient();

    const { data: session, error } =
      await supabase
        .from("interview_sessions")
        .select("*")
        .eq("id", sessionId)
        .eq("job_id", jobId)
        .single();

    if (error || !session) {
      return NextResponse.json(
        {
          error: "Interview session not found.",
        },
        { status: 404 },
      );
    }

    if (session.status === "active") {
      return NextResponse.json({
        success: true,
        session,
      });
    }

    if (session.status !== "paused") {
      return NextResponse.json(
        {
          error:
            "Only a paused interview can be resumed.",
        },
        { status: 400 },
      );
    }

    const {
      data: updatedSession,
      error: updateError,
    } = await supabase
      .from("interview_sessions")
      .update({
        status: "active",
        paused_at: null,
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
      session: updatedSession,
    });
  } catch (error) {
    console.error(
      "Resume interview error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to resume interview.",
      },
      { status: 500 },
    );
  }
}
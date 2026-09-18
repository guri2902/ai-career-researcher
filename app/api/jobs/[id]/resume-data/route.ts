import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const supabase = await createClient();

    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id, title, company_name")
      .eq("id", id)
      .single();

    if (jobError || !job) {
      return NextResponse.json(
        { error: "Job not found." },
        { status: 404 },
      );
    }

    const { data: resume, error: resumeError } =
      await supabase
        .from("resume_variants")
        .select("*")
        .eq("job_id", id)
        .order("created_at", {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();

    if (resumeError) {
      return NextResponse.json(
        { error: resumeError.message },
        { status: 500 },
      );
    }

    if (!resume) {
      return NextResponse.json(
        {
          error:
            "No tailored resume has been generated for this job yet.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      job,
      resume,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load resume.",
      },
      { status: 500 },
    );
  }
}
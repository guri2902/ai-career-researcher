import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { extractRequirements } from "@/lib/ai/extract-requirements";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const supabase = await createClient();

    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id, raw_jd_text")
      .eq("id", id)
      .single();

    if (jobError || !job) {
      return NextResponse.json(
        { error: "Job not found." },
        { status: 404 },
      );
    }

    const requirements = await extractRequirements(
      job.raw_jd_text,
    );

    const { data, error } = await supabase
      .from("requirements")
      .upsert(
        {
          job_id: id,
          ...requirements,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "job_id",
        },
      )
      .select()
      .single();

    if (error) {
      console.error("Requirement save error:", error);

      return NextResponse.json(
        { error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      requirements: data,
    });
  } catch (error) {
    console.error("Analyze job error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to analyze job.",
      },
      { status: 500 },
    );
  }
}
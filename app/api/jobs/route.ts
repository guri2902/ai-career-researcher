import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("jobs")
      .select(
        "id, title, company_name, source_url, status, readiness_score, created_at",
      )
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error("Failed to load jobs:", error);

      return Response.json(
        {
          success: false,
          error: error.message,
        },
        {
          status: 500,
        },
      );
    }

    return Response.json({
      success: true,
      jobs: data ?? [],
    });
  } catch (error) {
    console.error("GET /api/jobs failed:", error);

    return Response.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load jobs.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const companyName = body.companyName?.trim();
    const title = body.title?.trim();
    const sourceUrl = body.sourceUrl?.trim();
    const rawJdText = body.rawJdText?.trim();

    if (!rawJdText) {
      return NextResponse.json(
        { error: "Job description is required." },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("jobs")
      .insert({
        company_name: companyName || null,
        title: title || null,
        source_url: sourceUrl || null,
        raw_jd_text: rawJdText,
        status: "saved",
      })
      .select()
      .single();

    if (error) {
      console.error("Supabase insert error:", error);

      return NextResponse.json(
        { error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      job: data,
    });
  } catch (error) {
    console.error("Create job error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create job.",
      },
      { status: 500 },
    );
  }
}
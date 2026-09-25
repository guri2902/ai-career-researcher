import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type SkillGapRow = {
  required_skill: string;
  requirement_type:
    | "must_have"
    | "nice_to_have";
  match_status:
    | "matched"
    | "partial"
    | "missing";
  candidate_skill: string | null;
  match_score: number;
  gap_type:
    | "blocking"
    | "minor"
    | null;
  covered_by_parent_requirement:
    | boolean
    | null;
};

export async function GET(
  _request: Request,
  { params }: RouteContext,
) {
  try {
    const { id: jobId } =
      await params;

    const supabase =
      await createClient();

    const {
      data: gapRows,
      error: gapsError,
    } = await supabase
      .from("skill_gaps")
      .select(
        `
        required_skill,
        requirement_type,
        match_status,
        candidate_skill,
        match_score,
        gap_type,
        covered_by_parent_requirement
        `,
      )
      .eq("job_id", jobId);

    if (gapsError) {
      return NextResponse.json(
        {
          error: gapsError.message,
        },
        { status: 500 },
      );
    }

    const gaps =
      ((gapRows ??
        []) as SkillGapRow[]).map(
        (row) => ({
          requiredSkill:
            row.required_skill,

          requirementType:
            row.requirement_type,

          matchStatus:
            row.match_status,

          candidateSkill:
            row.candidate_skill,

          matchScore:
            Number(
              row.match_score ?? 0,
            ),

          gapType:
            row.gap_type,

          coveredByParentRequirement:
            Boolean(
              row.covered_by_parent_requirement,
            ),
        }),
      );

    // Use the newest session that has actually
    // produced interview skill-performance data.
    const {
      data: latestPerformanceRow,
      error: latestPerformanceError,
    } = await supabase
      .from(
        "interview_skill_performance",
      )
      .select(
        "session_id, created_at, id",
      )
      .eq("job_id", jobId)
      .order("created_at", {
        ascending: false,
      })
      .order("id", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (latestPerformanceError) {
      return NextResponse.json(
        {
          error:
            latestPerformanceError.message,
        },
        { status: 500 },
      );
    }

    let interviewPerformance: unknown[] =
      [];

    if (
      latestPerformanceRow
    ) {
      const {
        data: performanceRows,
        error: performanceError,
      } = await supabase
        .from(
          "interview_skill_performance",
        )
        .select(
          `
          skill_name,
          question_count,
          average_score,
          performance_level
          `,
        )
        .eq(
          "session_id",
          latestPerformanceRow.session_id,
        )
        .order(
          "average_score",
          {
            ascending: true,
          },
        );

      if (performanceError) {
        return NextResponse.json(
          {
            error:
              performanceError.message,
          },
          { status: 500 },
        );
      }

      interviewPerformance =
        performanceRows ?? [];
    }

    return NextResponse.json({
      success: true,
      gaps,
      interviewPerformance,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load practice data.",
      },
      { status: 500 },
    );
  }
}

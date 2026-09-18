import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { matchSkills } from "@/lib/skills/match";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: jobId } = await params;

    const supabase = await createClient();

    // ─────────────────────────────────────
    // Get requirements
    // ─────────────────────────────────────

    const { data: requirements, error: requirementsError } =
      await supabase
        .from("requirements")
        .select("*")
        .eq("job_id", jobId)
        .single();

    if (requirementsError || !requirements) {
      return NextResponse.json(
        {
          error:
            "Requirements not found. Analyze the job first.",
        },
        { status: 404 },
      );
    }

    // ─────────────────────────────────────
    // Get candidate profile
    // ─────────────────────────────────────

    const { data: profile, error: profileError } =
      await supabase
        .from("candidate_profiles")
        .select("id")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json(
        {
          error:
            "Candidate profile not found. Create your profile first.",
        },
        { status: 404 },
      );
    }

    // ─────────────────────────────────────
    // Get candidate skills
    // ─────────────────────────────────────

    const { data: candidateSkills, error: skillsError } =
      await supabase
        .from("candidate_skills")
        .select(
          "skill_name, proficiency, source",
        )
        .eq("profile_id", profile.id);

    if (skillsError) {
      return NextResponse.json(
        { error: skillsError.message },
        { status: 500 },
      );
    }

    // ─────────────────────────────────────
    // Match skills
    // ─────────────────────────────────────

    const mustHaveMatches = matchSkills(
      requirements.must_have_skills ?? [],
      "must_have",
      candidateSkills ?? [],
    );

    const niceToHaveMatches = matchSkills(
      requirements.nice_to_have_skills ?? [],
      "nice_to_have",
      candidateSkills ?? [],
    );

    const matches = [
      ...mustHaveMatches,
      ...niceToHaveMatches,
    ];

    // ─────────────────────────────────────
    // Calculate readiness
    // ─────────────────────────────────────

    const scoredMustHaveMatches =
        mustHaveMatches.filter(
            (match) => !match.coveredByParentRequirement,
        );

        const scoredNiceToHaveMatches =
        niceToHaveMatches.filter(
            (match) => !match.coveredByParentRequirement,
        );

        const mustHaveTotal = scoredMustHaveMatches.length;

        const niceToHaveTotal =
        scoredNiceToHaveMatches.length;

    const mustHavePoints =
        scoredMustHaveMatches.reduce(
            (total, match) => total + match.matchScore,
            0,
        );

        const niceToHavePoints =
        scoredNiceToHaveMatches.reduce(
            (total, match) => total + match.matchScore,
            0,
        );

    let readinessScore = 0;

    if (mustHaveTotal > 0) {
      const mustHaveScore =
        mustHavePoints / mustHaveTotal;

      const niceToHaveScore =
        niceToHaveTotal > 0
          ? niceToHavePoints / niceToHaveTotal
          : 0;

      readinessScore = Math.round(
        (mustHaveScore * 0.8 +
          niceToHaveScore * 0.2) *
          100,
      );
    } else if (niceToHaveTotal > 0) {
      readinessScore = Math.round(
        (niceToHavePoints / niceToHaveTotal) * 100,
      );
    }

    // ─────────────────────────────────────
    // Clear previous results
    // ─────────────────────────────────────

    const { error: deleteError } = await supabase
      .from("skill_gaps")
      .delete()
      .eq("job_id", jobId)
      .eq("profile_id", profile.id);

    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 },
      );
    }

    // ─────────────────────────────────────
    // Save matches
    // ─────────────────────────────────────

    if (matches.length > 0) {
      const rows = matches.map((match) => ({
        job_id: jobId,
        profile_id: profile.id,
        required_skill: match.requiredSkill,
        requirement_type: match.requirementType,
        match_status: match.matchStatus,
        candidate_skill: match.candidateSkill,
        gap_type: match.gapType,
        match_score: match.matchScore,
        covered_by_parent_requirement:
            match.coveredByParentRequirement,
        }));

      const { error: insertError } = await supabase
        .from("skill_gaps")
        .insert(rows);

      if (insertError) {
        return NextResponse.json(
          { error: insertError.message },
          { status: 500 },
        );
      }
    }

    // ─────────────────────────────────────
    // Save readiness score
    // ─────────────────────────────────────

    const { error: updateJobError } = await supabase
      .from("jobs")
      .update({
        readiness_score: readinessScore,
      })
      .eq("id", jobId);

    if (updateJobError) {
      return NextResponse.json(
        { error: updateJobError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      readinessScore,
      matches,
    });
  } catch (error) {
    console.error("Skill gap analysis error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to calculate skill gaps.",
      },
      { status: 500 },
    );
  }
}
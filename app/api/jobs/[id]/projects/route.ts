import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  generateProjects,
  type ProjectGenerationInput,
} from "@/lib/ai/generate-projects";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Supabase environment variables are missing.");
  }

  return createClient(url, key);
}

export async function POST(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const { id: jobId } = await context.params;

    if (!jobId) {
      return NextResponse.json(
        {
          success: false,
          error: "Job ID is required.",
        },
        { status: 400 },
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: profile, error: profileError } = await supabase
      .from("candidate_profiles")
      .select("id")
      .limit(1)
      .maybeSingle();

    if (profileError) {
      throw profileError;
    }

    if (!profile) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No candidate profile exists yet. Complete your profile first.",
        },
        { status: 400 },
      );
    }

    const profileId = profile.id;

    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select(
        `
        id,
        title,
        company_name
      `,
      )
      .eq("id", jobId)
      .single();

    if (jobError) {
      throw jobError;
    }

    const { data: requirements, error: requirementsError } =
      await supabase
        .from("requirements")
        .select(
          `
          must_have_skills,
          nice_to_have_skills,
          years_experience,
          tools,
          seniority_level
        `,
        )
        .eq("job_id", jobId)
        .single();

    if (requirementsError) {
      throw requirementsError;
    }

    const { data: skillGaps, error: skillGapsError } = await supabase
      .from("skill_gaps")
      .select(
        `
        required_skill,
        requirement_type,
        match_status,
        gap_type,
        match_score,
        covered_by_parent_requirement
      `,
      )
      .eq("job_id", jobId)
      .eq("profile_id", profileId)
      .order("match_score", { ascending: false });

    if (skillGapsError) {
      throw skillGapsError;
    }

    const { data: candidateSkills, error: candidateSkillsError } =
      await supabase
        .from("candidate_skills")
        .select("skill_name")
        .eq("profile_id", profileId);

    if (candidateSkillsError) {
      throw candidateSkillsError;
    }

    const input: ProjectGenerationInput = {
      jobTitle: job.title,
      companyName: job.company_name,
      requirements: {
        must_have_skills: requirements.must_have_skills ?? [],
        nice_to_have_skills:
          requirements.nice_to_have_skills ?? [],
        tools: requirements.tools ?? [],
        years_experience: requirements.years_experience,
        seniority_level: requirements.seniority_level,
      },
      skillGaps: (skillGaps ?? []).map((gap) => ({
        required_skill: gap.required_skill,
        requirement_type: gap.requirement_type,
        match_status: gap.match_status,
        gap_type: gap.gap_type,
        match_score: Number(gap.match_score ?? 0),
        covered_by_parent_requirement:
          gap.covered_by_parent_requirement ?? false,
      })),
      candidateSkills: (candidateSkills ?? [])
        .map((skill) => skill.skill_name)
        .filter(Boolean),
    };

    const projects = await generateProjects(input);

    const { error: deleteError } = await supabase
      .from("project_recommendations")
      .delete()
      .eq("job_id", jobId)
      .eq("profile_id", profileId);

    if (deleteError) {
      throw deleteError;
    }

    const rows = projects.map((project) => ({
      job_id: jobId,
      profile_id: profileId,
      title: project.title,
      problem_statement: project.problem_statement,
      why_this_project: project.why_this_project,
      difficulty: project.difficulty,
      estimated_weeks: project.estimated_weeks,
      target_skills: project.target_skills,
      tech_stack: project.tech_stack,
      features: project.features,
      implementation_steps: project.implementation_steps,
      deliverables: project.deliverables,
      architecture: project.architecture,
      github_structure: project.github_structure,
      interview_value: project.interview_value,
      status: "recommended",
    }));

    const { data: insertedProjects, error: insertError } =
      await supabase
        .from("project_recommendations")
        .insert(rows)
        .select("*");

    if (insertError) {
      throw insertError;
    }

    return NextResponse.json({
      success: true,
      jobId,
      profileId,
      projects: insertedProjects ?? [],
      count: insertedProjects?.length ?? 0,
    });
  } catch (error) {
    console.error("Project generation error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate projects.",
      },
      { status: 500 },
    );
  }
}

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const { id: jobId } = await context.params;

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("project_recommendations")
      .select("*")
      .eq("job_id", jobId)
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      projects: data ?? [],
    });
  } catch (error) {
    console.error("Project fetch error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch projects.",
      },
      { status: 500 },
    );
  }
}
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  generateInterviewQuestions,
  type InterviewGenerationInput,
} from "@/lib/ai/generate-interview-questions";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase environment variables are missing.",
    );
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

    const supabase = getSupabase();

    // Candidate profile
    const { data: profile, error: profileError } =
      await supabase
        .from("candidate_profiles")
        .select("id, resume_text")
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
            "No candidate profile exists yet.",
        },
        { status: 400 },
      );
    }

    if (!profile.resume_text?.trim()) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Your resume is empty. Add your base resume before generating interview questions.",
        },
        { status: 400 },
      );
    }

    // Job
    const { data: job, error: jobError } =
      await supabase
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

    // Requirements
    const {
      data: requirements,
      error: requirementsError,
    } = await supabase
      .from("requirements")
      .select(
        `
        must_have_skills,
        nice_to_have_skills,
        tools,
        years_experience,
        seniority_level
      `,
      )
      .eq("job_id", jobId)
      .single();

    if (requirementsError) {
      throw requirementsError;
    }

    // Skill gaps
    const {
      data: skillGaps,
      error: skillGapsError,
    } = await supabase
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
      .eq("profile_id", profile.id)
      .order("match_score", {
        ascending: false,
      });

    if (skillGapsError) {
      throw skillGapsError;
    }

    // Projects
    const {
      data: projects,
      error: projectsError,
    } = await supabase
      .from("project_recommendations")
      .select(
        `
        id,
        title,
        problem_statement,
        target_skills,
        tech_stack,
        architecture,
        implementation_steps,
        interview_value,
        status
      `,
      )
      .eq("job_id", jobId)
      .eq("profile_id", profile.id)
      .order("created_at", {
        ascending: true,
      });

    if (projectsError) {
      throw projectsError;
    }

    const input: InterviewGenerationInput = {
      jobTitle: job.title,
      companyName: job.company_name,

      resumeText: profile.resume_text,

      requirements: {
        must_have_skills:
          requirements.must_have_skills ?? [],

        nice_to_have_skills:
          requirements.nice_to_have_skills ?? [],

        tools:
          requirements.tools ?? [],

        years_experience:
          requirements.years_experience,

        seniority_level:
          requirements.seniority_level,
      },

      skillGaps: (skillGaps ?? []).map(
        (gap) => ({
          required_skill:
            gap.required_skill,

          requirement_type:
            gap.requirement_type,

          match_status:
            gap.match_status,

          gap_type:
            gap.gap_type,

          match_score:
            Number(gap.match_score ?? 0),

          covered_by_parent_requirement:
            gap.covered_by_parent_requirement ??
            false,
        }),
      ),

      projects: (projects ?? []).map(
        (project) => ({
          id: project.id,
          title: project.title,

          problem_statement:
            project.problem_statement,

          target_skills:
            project.target_skills ?? [],

          tech_stack:
            project.tech_stack ?? [],

          architecture:
            project.architecture,

          implementation_steps:
            project.implementation_steps ?? [],

          interview_value:
            project.interview_value,

          status:
            project.status,
        }),
      ),
    };

    const questions =
      await generateInterviewQuestions(input);

    // Remove previously generated questions for this
    // job/profile combination so regeneration doesn't
    // create duplicates.
    const {
      error: deleteError,
    } = await supabase
      .from("interview_questions")
      .delete()
      .eq("job_id", jobId)
      .eq("profile_id", profile.id);

    if (deleteError) {
      throw deleteError;
    }

    const rows = questions.map(
      (question) => ({
        job_id: jobId,

        profile_id: profile.id,

        question:
          question.question,

        category:
          question.category,

        difficulty:
          question.difficulty,

        target_skill:
          question.target_skill,

        why_asked:
          question.why_asked,

        ideal_answer:
          question.ideal_answer,

        key_points:
          question.key_points,

        follow_up_questions:
          question.follow_up_questions,

        source_type:
          question.source_type,

        status: "unseen",

        confidence_score: 0,
      }),
    );

    const {
      data: insertedQuestions,
      error: insertError,
    } = await supabase
      .from("interview_questions")
      .insert(rows)
      .select("*");

    if (insertError) {
      throw insertError;
    }

    return NextResponse.json({
      success: true,
      jobId,
      profileId: profile.id,
      questions:
        insertedQuestions ?? [],
      count:
        insertedQuestions?.length ?? 0,
    });
  } catch (error) {
    console.error(
      "Interview question generation error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate interview questions.",
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

    const supabase = getSupabase();

    const {
      data: questions,
      error,
    } = await supabase
      .from("interview_questions")
      .select("*")
      .eq("job_id", jobId)
      .order("created_at", {
        ascending: true,
      });

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      questions: questions ?? [],
      count: questions?.length ?? 0,
    });
  } catch (error) {
    console.error(
      "Interview question fetch error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch interview questions.",
      },
      { status: 500 },
    );
  }
}
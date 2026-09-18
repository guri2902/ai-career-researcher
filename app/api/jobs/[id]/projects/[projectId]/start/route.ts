import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type RouteContext = {
  params: Promise<{
    id: string;
    projectId: string;
  }>;
};

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Supabase environment variables are missing.");
  }

  return createClient(url, key);
}

function getTaskTitle(step: string, index: number) {
  const cleaned = step
    .replace(/\.$/, "")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length <= 90) {
    return `Step ${index + 1}: ${cleaned}`;
  }

  return `Step ${index + 1}: ${cleaned.slice(0, 87)}...`;
}

function getSkillFocus(
  step: string,
  targetSkills: string[],
): string[] {
  const normalizedStep = step.toLowerCase();

  const matched = targetSkills.filter((skill) =>
    normalizedStep.includes(skill.toLowerCase()),
  );

  if (matched.length > 0) {
    return matched.slice(0, 4);
  }

  return targetSkills.slice(0, 3);
}

export async function POST(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const { id: jobId, projectId } = await context.params;

    if (!jobId || !projectId) {
      return NextResponse.json(
        {
          success: false,
          error: "Job ID and project ID are required.",
        },
        { status: 400 },
      );
    }

    const supabase = getSupabase();

    // Verify that the project belongs to this job.
    const { data: project, error: projectError } = await supabase
      .from("project_recommendations")
      .select(
        `
        id,
        job_id,
        title,
        estimated_weeks,
        target_skills,
        implementation_steps,
        status,
        started_at,
        completed_at
      `,
      )
      .eq("id", projectId)
      .eq("job_id", jobId)
      .single();

    if (projectError) {
      throw projectError;
    }

    if (!project) {
      return NextResponse.json(
        {
          success: false,
          error: "Project not found.",
        },
        { status: 404 },
      );
    }

    // Check whether tasks already exist.
    const { data: existingTasks, error: existingTasksError } =
      await supabase
        .from("project_tasks")
        .select("*")
        .eq("project_id", projectId)
        .order("task_order", { ascending: true });

    if (existingTasksError) {
      throw existingTasksError;
    }

    // If the project has already been started, don't recreate tasks.
    if (existingTasks && existingTasks.length > 0) {
      if (project.status !== "in_progress") {
        const { error: updateError } = await supabase
          .from("project_recommendations")
          .update({
            status: "in_progress",
            started_at: project.started_at ?? new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", projectId)
          .eq("job_id", jobId);

        if (updateError) {
          throw updateError;
        }
      }

      return NextResponse.json({
        success: true,
        alreadyStarted: true,
        project,
        tasks: existingTasks,
        count: existingTasks.length,
      });
    }

    const implementationSteps =
      Array.isArray(project.implementation_steps)
        ? project.implementation_steps
        : [];

    if (implementationSteps.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "This project has no implementation steps to create tasks from.",
        },
        { status: 400 },
      );
    }

    const estimatedWeeks = Math.max(
      1,
      Number(project.estimated_weeks) || 1,
    );

    const targetSkills = Array.isArray(project.target_skills)
      ? project.target_skills
      : [];

    const tasks = implementationSteps.map(
      (step: string, index: number) => {
        const weekNumber = Math.min(
          estimatedWeeks,
          Math.max(
            1,
            Math.ceil(
              ((index + 1) / implementationSteps.length) *
                estimatedWeeks,
            ),
          ),
        );

        return {
          project_id: projectId,
          task_order: index + 1,
          week_number: weekNumber,
          title: getTaskTitle(step, index),
          description: step,
          skill_focus: getSkillFocus(step, targetSkills),
          status: "todo",
        };
      },
    );

    const { data: insertedTasks, error: insertError } =
      await supabase
        .from("project_tasks")
        .insert(tasks)
        .select("*")
        .order("task_order", { ascending: true });

    if (insertError) {
      throw insertError;
    }

    const now = new Date().toISOString();

    const { data: updatedProject, error: updateError } =
      await supabase
        .from("project_recommendations")
        .update({
          status: "in_progress",
          started_at: project.started_at ?? now,
          completed_at: null,
          updated_at: now,
        })
        .eq("id", projectId)
        .eq("job_id", jobId)
        .select("*")
        .single();

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      alreadyStarted: false,
      project: updatedProject,
      tasks: insertedTasks ?? [],
      count: insertedTasks?.length ?? 0,
    });
  } catch (error) {
    console.error("Start project error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to start project.",
      },
      { status: 500 },
    );
  }
}
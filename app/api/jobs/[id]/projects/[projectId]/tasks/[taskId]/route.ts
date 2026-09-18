import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type RouteContext = {
  params: Promise<{
    id: string;
    projectId: string;
    taskId: string;
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

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const {
      id: jobId,
      projectId,
      taskId,
    } = await context.params;

    const body = await request.json();

    const status = body?.status;

    if (
      status !== "todo" &&
      status !== "in_progress" &&
      status !== "completed"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid task status.",
        },
        { status: 400 },
      );
    }

    const supabase = getSupabase();

    const { data: project, error: projectError } =
      await supabase
        .from("project_recommendations")
        .select("*")
        .eq("id", projectId)
        .eq("job_id", jobId)
        .single();

    if (projectError || !project) {
      return NextResponse.json(
        {
          success: false,
          error: "Project not found.",
        },
        { status: 404 },
      );
    }

    const { data: task, error: taskError } =
      await supabase
        .from("project_tasks")
        .select("*")
        .eq("id", taskId)
        .eq("project_id", projectId)
        .single();

    if (taskError || !task) {
      return NextResponse.json(
        {
          success: false,
          error: "Task not found.",
        },
        { status: 404 },
      );
    }

    const { data: updatedTask, error: updateTaskError } =
      await supabase
        .from("project_tasks")
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", taskId)
        .eq("project_id", projectId)
        .select("*")
        .single();

    if (updateTaskError) {
      throw updateTaskError;
    }

    // Recalculate project progress.
    const { data: allTasks, error: allTasksError } =
      await supabase
        .from("project_tasks")
        .select("status")
        .eq("project_id", projectId);

    if (allTasksError) {
      throw allTasksError;
    }

    const totalTasks = allTasks?.length ?? 0;

    const completedTasks =
      allTasks?.filter(
        (item) => item.status === "completed",
      ).length ?? 0;

    const allCompleted =
      totalTasks > 0 &&
      completedTasks === totalTasks;

    let nextProjectStatus = project.status;

    if (allCompleted) {
      nextProjectStatus = "completed";
    } else {
      nextProjectStatus = "in_progress";
    }

    const now = new Date().toISOString();

    const { data: updatedProject, error: updateProjectError } =
      await supabase
        .from("project_recommendations")
        .update({
          status: nextProjectStatus,
          started_at: project.started_at ?? now,
          completed_at: allCompleted
            ? project.completed_at ?? now
            : null,
          updated_at: now,
        })
        .eq("id", projectId)
        .eq("job_id", jobId)
        .select("*")
        .single();

    if (updateProjectError) {
      throw updateProjectError;
    }

    return NextResponse.json({
      success: true,
      task: updatedTask,
      project: updatedProject,
      progress: {
        total: totalTasks,
        completed: completedTasks,
        percentage:
          totalTasks > 0
            ? Math.round(
                (completedTasks / totalTasks) * 100,
              )
            : 0,
      },
    });
  } catch (error) {
    console.error("Project task update error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to update task.",
      },
      { status: 500 },
    );
  }
}
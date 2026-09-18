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

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const { id: jobId, projectId } = await context.params;

    const supabase = getSupabase();

    const { data: project, error: projectError } =
      await supabase
        .from("project_recommendations")
        .select("id")
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

    const { data: tasks, error: tasksError } =
      await supabase
        .from("project_tasks")
        .select("*")
        .eq("project_id", projectId)
        .order("task_order", {
          ascending: true,
        });

    if (tasksError) {
      throw tasksError;
    }

    return NextResponse.json({
      success: true,
      tasks: tasks ?? [],
    });
  } catch (error) {
    console.error("Project tasks fetch error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch project tasks.",
      },
      { status: 500 },
    );
  }
}
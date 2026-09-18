"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

type Project = {
  id: string;
  job_id: string;
  title: string;
  problem_statement: string;
  why_this_project: string;
  difficulty: string;
  estimated_weeks: number;

  target_skills: string[];
  tech_stack: string[];

  features: string[];
  implementation_steps: string[];
  deliverables: string[];

  architecture: string;
  github_structure: string;
  interview_value: string;

  status: string;
  started_at: string | null;
  completed_at: string | null;
};

type Task = {
  id: string;
  project_id: string;
  task_order: number;
  week_number: number;
  title: string;
  description: string | null;
  skill_focus: string[];
  status: "todo" | "in_progress" | "completed";
};

export default function ProjectDetailPage() {
  const params = useParams();

  const jobId = params.id as string;
  const projectId = params.projectId as string;

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);

  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [updatingTask, setUpdatingTask] = useState<string | null>(
    null,
  );
  const [error, setError] = useState("");

  const loadProject = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `/api/jobs/${jobId}/projects`,
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "Failed to load projects.",
        );
      }

      const selectedProject = (data.projects || []).find(
        (item: Project) => item.id === projectId,
      );

      if (!selectedProject) {
        throw new Error("Project not found.");
      }

      setProject(selectedProject);

      // Load task list after finding the project.
      const taskResponse = await fetch(
        `/api/jobs/${jobId}/projects/${projectId}/tasks`,
      );

      if (taskResponse.ok) {
        const taskData = await taskResponse.json();

        if (taskData.success) {
          setTasks(taskData.tasks || []);
        }
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load project.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (jobId && projectId) {
      loadProject();
    }
  }, [jobId, projectId]);

  const completedTasks = useMemo(
    () =>
      tasks.filter(
        (task) => task.status === "completed",
      ).length,
    [tasks],
  );

  const progress = useMemo(() => {
    if (tasks.length === 0) {
      return 0;
    }

    return Math.round(
      (completedTasks / tasks.length) * 100,
    );
  }, [completedTasks, tasks.length]);

  const groupedTasks = useMemo(() => {
    const groups = new Map<number, Task[]>();

    for (const task of tasks) {
      const existing = groups.get(task.week_number) ?? [];
      existing.push(task);
      groups.set(task.week_number, existing);
    }

    return Array.from(groups.entries()).sort(
      ([weekA], [weekB]) => weekA - weekB,
    );
  }, [tasks]);

  async function startProject() {
    try {
      setStarting(true);
      setError("");

      const response = await fetch(
        `/api/jobs/${jobId}/projects/${projectId}/start`,
        {
          method: "POST",
        },
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "Failed to start project.",
        );
      }

      setProject(data.project);
      setTasks(data.tasks || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to start project.",
      );
    } finally {
      setStarting(false);
    }
  }

  async function updateTaskStatus(
    taskId: string,
    status: "todo" | "in_progress" | "completed",
  ) {
    try {
      setUpdatingTask(taskId);
      setError("");

      const response = await fetch(
        `/api/jobs/${jobId}/projects/${projectId}/tasks/${taskId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "Failed to update task.",
        );
      }

      setTasks((current) =>
        current.map((task) =>
          task.id === taskId
            ? {
                ...task,
                status: data.task.status,
              }
            : task,
        ),
      );

      if (data.project) {
        setProject(data.project);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update task.",
      );
    } finally {
      setUpdatingTask(null);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f5efe5] px-6 py-12 text-[#152a3f]">
        <div className="mx-auto max-w-5xl">
          <p className="text-sm text-[#6f655a]">
            Loading project plan...
          </p>
        </div>
      </main>
    );
  }

  if (error && !project) {
    return (
      <main className="min-h-screen bg-[#f5efe5] px-6 py-12 text-[#152a3f]">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-3xl border border-[#dfd3c4] bg-[#fbf7f0] p-8">
            <div className="text-xs font-semibold tracking-[0.25em] text-[#7b1e2b]">
              PROJECT ERROR
            </div>

            <h1 className="mt-3 text-2xl font-semibold">
              We couldn't load this project.
            </h1>

            <p className="mt-3 text-sm text-[#6f655a]">
              {error}
            </p>

            <div className="mt-6">
              <Link href={`/jobs/${jobId}/projects`}>
                <Button variant="outline">
                  Back to Projects
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!project) {
    return null;
  }

  return (
    <main className="min-h-screen bg-[#f5efe5] px-6 py-10 text-[#152a3f]">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-10">
          <Link
            href={`/jobs/${jobId}/projects`}
            className="text-sm text-[#6f655a] hover:text-[#7b1e2b]"
          >
            ← Back to Projects
          </Link>

          <div className="mt-8">
            <div className="text-xs font-semibold tracking-[0.28em] text-[#7b1e2b]">
              PROJECT BLUEPRINT
            </div>

            <h1 className="mt-3 max-w-4xl text-4xl font-semibold tracking-tight md:text-5xl">
              {project.title}
            </h1>

            <div className="mt-5 flex flex-wrap gap-3">
              <span className="rounded-full border border-[#d9cbbb] bg-[#fbf7f0] px-4 py-2 text-sm">
                {project.difficulty}
              </span>

              <span className="rounded-full border border-[#d9cbbb] bg-[#fbf7f0] px-4 py-2 text-sm">
                {project.estimated_weeks}{" "}
                {project.estimated_weeks === 1
                  ? "week"
                  : "weeks"}
              </span>

              {project.status === "in_progress" && (
                <span className="rounded-full bg-[#7b1e2b] px-4 py-2 text-sm text-white">
                  In progress
                </span>
              )}

              {project.status === "completed" && (
                <span className="rounded-full bg-[#153f31] px-4 py-2 text-sm text-white">
                  Completed
                </span>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-8 rounded-2xl border border-[#d7b8b8] bg-[#f8eaea] px-5 py-4 text-sm text-[#7b1e2b]">
            {error}
          </div>
        )}

        {/* Progress */}
        {tasks.length > 0 && (
          <section className="mb-8 rounded-3xl border border-[#dfd3c4] bg-[#fbf7f0] p-7 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="text-xs font-semibold tracking-[0.24em] text-[#7b1e2b]">
                  PROJECT PROGRESS
                </div>

                <h2 className="mt-3 text-3xl font-semibold">
                  {progress}% complete
                </h2>

                <p className="mt-2 text-sm text-[#6f655a]">
                  {completedTasks} of {tasks.length} tasks
                  completed
                </p>
              </div>

              <div className="w-full md:max-w-sm">
                <div className="mb-2 flex justify-between text-xs text-[#6f655a]">
                  <span>Progress</span>
                  <span>{progress}%</span>
                </div>

                <div className="h-3 overflow-hidden rounded-full bg-[#e4d8ca]">
                  <div
                    className="h-full rounded-full bg-[#7b1e2b] transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Main content */}
        <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-8">
            {/* Problem */}
            <section className="rounded-3xl border border-[#dfd3c4] bg-[#fbf7f0] p-7 shadow-sm">
              <SectionLabel>
                THE PROBLEM
              </SectionLabel>

              <h2 className="mt-3 text-2xl font-semibold">
                What are you solving?
              </h2>

              <p className="mt-4 leading-7 text-[#6f655a]">
                {project.problem_statement}
              </p>
            </section>

            {/* Why */}
            <section className="rounded-3xl border border-[#dfd3c4] bg-[#fbf7f0] p-7 shadow-sm">
              <SectionLabel>
                WHY THIS PROJECT
              </SectionLabel>

              <h2 className="mt-3 text-2xl font-semibold">
                How it closes your gaps
              </h2>

              <p className="mt-4 leading-7 text-[#6f655a]">
                {project.why_this_project}
              </p>
            </section>

            {/* Architecture */}
            <section className="rounded-3xl border border-[#dfd3c4] bg-[#fbf7f0] p-7 shadow-sm">
              <SectionLabel>
                ARCHITECTURE
              </SectionLabel>

              <h2 className="mt-3 text-2xl font-semibold">
                System design
              </h2>

              <div className="mt-5 rounded-2xl border border-[#e0d3c4] bg-[#f4ebdf] p-5">
                <p className="whitespace-pre-wrap text-sm leading-7 text-[#5f574e]">
                  {project.architecture}
                </p>
              </div>
            </section>

            {/* Features */}
            <section className="rounded-3xl border border-[#dfd3c4] bg-[#fbf7f0] p-7 shadow-sm">
              <SectionLabel>
                FEATURES
              </SectionLabel>

              <h2 className="mt-3 text-2xl font-semibold">
                What you should build
              </h2>

              <div className="mt-5 space-y-3">
                {project.features.map(
                  (feature, index) => (
                    <div
                      key={`${index}-${feature}`}
                      className="flex gap-4 rounded-2xl border border-[#e3d8ca] bg-[#f7f0e6] p-4"
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#7b1e2b] text-xs font-semibold text-white">
                        {index + 1}
                      </div>

                      <p className="text-sm leading-6 text-[#5f574e]">
                        {feature}
                      </p>
                    </div>
                  ),
                )}
              </div>
            </section>

            {/* Implementation */}
            <section className="rounded-3xl border border-[#dfd3c4] bg-[#fbf7f0] p-7 shadow-sm">
              <SectionLabel>
                IMPLEMENTATION PLAN
              </SectionLabel>

              <h2 className="mt-3 text-2xl font-semibold">
                Your build roadmap
              </h2>

              <div className="mt-6 space-y-5">
                {project.implementation_steps.map(
                  (step, index) => (
                    <div
                      key={`${index}-${step}`}
                      className="flex gap-4"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#cdbba7] bg-[#f3e8d9] text-sm font-semibold text-[#7b1e2b]">
                        {index + 1}
                      </div>

                      <p className="pt-1 text-sm leading-7 text-[#5f574e]">
                        {step}
                      </p>
                    </div>
                  ),
                )}
              </div>
            </section>

            {/* Task tracker */}
            {tasks.length > 0 && (
              <section className="rounded-3xl border border-[#dfd3c4] bg-[#fbf7f0] p-7 shadow-sm">
                <SectionLabel>
                  BUILD TRACKER
                </SectionLabel>

                <h2 className="mt-3 text-2xl font-semibold">
                  Work through the project
                </h2>

                <p className="mt-3 text-sm leading-6 text-[#6f655a]">
                  Complete each task as you build. Your progress
                  is saved automatically.
                </p>

                <div className="mt-8 space-y-8">
                  {groupedTasks.map(
                    ([weekNumber, weekTasks]) => (
                      <div key={weekNumber}>
                        <div className="mb-4 flex items-center gap-3">
                          <div className="rounded-full bg-[#7b1e2b] px-3 py-1 text-xs font-semibold text-white">
                            WEEK {weekNumber}
                          </div>

                          <div className="h-px flex-1 bg-[#dfd3c4]" />
                        </div>

                        <div className="space-y-3">
                          {weekTasks.map((task) => (
                            <TaskRow
                              key={task.id}
                              task={task}
                              disabled={
                                updatingTask === task.id
                              }
                              onChange={(
                                status,
                              ) =>
                                updateTaskStatus(
                                  task.id,
                                  status,
                                )
                              }
                            />
                          ))}
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </section>
            )}

            {/* Deliverables */}
            <section className="rounded-3xl border border-[#dfd3c4] bg-[#fbf7f0] p-7 shadow-sm">
              <SectionLabel>
                DELIVERABLES
              </SectionLabel>

              <h2 className="mt-3 text-2xl font-semibold">
                What should exist when you're done
              </h2>

              <div className="mt-5 space-y-3">
                {project.deliverables.map(
                  (item) => (
                    <div
                      key={item}
                      className="flex items-start gap-3"
                    >
                      <span className="mt-1 text-[#7b1e2b]">
                        ✓
                      </span>

                      <p className="text-sm leading-6 text-[#5f574e]">
                        {item}
                      </p>
                    </div>
                  ),
                )}
              </div>
            </section>

            {/* GitHub */}
            <section className="rounded-3xl border border-[#dfd3c4] bg-[#fbf7f0] p-7 shadow-sm">
              <SectionLabel>
                GITHUB STRUCTURE
              </SectionLabel>

              <h2 className="mt-3 text-2xl font-semibold">
                Suggested repository
              </h2>

              <pre className="mt-5 overflow-x-auto rounded-2xl border border-[#ded0bf] bg-[#162536] p-5 text-sm leading-6 text-[#eee7dc]">
                {project.github_structure}
              </pre>
            </section>
          </div>

          {/* Sidebar */}
          <aside className="space-y-8">
            {/* Start project */}
            <section className="rounded-3xl border border-[#7b1e2b] bg-[#7b1e2b] p-6 text-white shadow-sm">
              <div className="text-xs font-semibold tracking-[0.22em] text-[#ead7d2]">
                PROJECT STATUS
              </div>

              {project.status === "recommended" ? (
                <>
                  <h2 className="mt-3 text-2xl font-semibold">
                    Ready to build?
                  </h2>

                  <p className="mt-3 text-sm leading-6 text-[#f0dfda]">
                    Start the project to turn the AI-generated
                    implementation plan into a persistent
                    checklist.
                  </p>

                  <Button
                    onClick={startProject}
                    disabled={starting}
                    className="mt-5 w-full bg-white text-[#7b1e2b] hover:bg-[#f5ebe8]"
                  >
                    {starting
                      ? "Starting..."
                      : "Start Project"}
                  </Button>
                </>
              ) : project.status === "in_progress" ? (
                <>
                  <h2 className="mt-3 text-2xl font-semibold">
                    You're building this
                  </h2>

                  <p className="mt-3 text-sm leading-6 text-[#f0dfda]">
                    Your task progress is being saved automatically.
                  </p>

                  <div className="mt-5 rounded-2xl bg-white/10 p-4">
                    <div className="text-sm text-[#f0dfda]">
                      Started
                    </div>

                    <div className="mt-1 text-sm font-medium">
                      {project.started_at
                        ? new Date(
                            project.started_at,
                          ).toLocaleDateString()
                        : "Recently"}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="mt-3 text-2xl font-semibold">
                    Project completed
                  </h2>

                  <p className="mt-3 text-sm leading-6 text-[#f0dfda]">
                    You've completed the project roadmap.
                  </p>
                </>
              )}
            </section>

            {/* Skills */}
            <section className="rounded-3xl border border-[#dfd3c4] bg-[#fbf7f0] p-6 shadow-sm">
              <SectionLabel>
                SKILL GAPS
              </SectionLabel>

              <h2 className="mt-3 text-xl font-semibold">
                Skills you'll develop
              </h2>

              <div className="mt-5 flex flex-wrap gap-2">
                {project.target_skills.map(
                  (skill) => (
                    <span
                      key={skill}
                      className="rounded-full border border-[#c9b39b] bg-[#f3e8d9] px-3 py-2 text-xs"
                    >
                      {skill}
                    </span>
                  ),
                )}
              </div>
            </section>

            {/* Stack */}
            <section className="rounded-3xl border border-[#dfd3c4] bg-[#fbf7f0] p-6 shadow-sm">
              <SectionLabel>
                TECH STACK
              </SectionLabel>

              <div className="mt-5 space-y-3">
                {project.tech_stack.map(
                  (technology) => (
                    <div
                      key={technology}
                      className="rounded-xl border border-[#e2d5c7] bg-[#f7f0e6] px-4 py-3 text-sm"
                    >
                      {technology}
                    </div>
                  ),
                )}
              </div>
            </section>

            {/* Interview */}
            <section className="rounded-3xl border border-[#dfd3c4] bg-[#fbf7f0] p-6 shadow-sm">
              <SectionLabel>
                INTERVIEW VALUE
              </SectionLabel>

              <h2 className="mt-3 text-xl font-semibold">
                What you'll be able to discuss
              </h2>

              <p className="mt-5 text-sm leading-7 text-[#6f655a]">
                {project.interview_value}
              </p>
            </section>
          </aside>
        </div>

        <div className="mt-10 flex flex-wrap gap-3 border-t border-[#dacdbd] pt-8">
          <Link href={`/jobs/${jobId}/projects`}>
            <Button variant="outline">
              ← All Projects
            </Button>
          </Link>

          <Link href={`/jobs/${jobId}`}>
            <Button variant="outline">
              Back to Job
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}

function TaskRow({
  task,
  disabled,
  onChange,
}: {
  task: Task;
  disabled: boolean;
  onChange: (
    status: "todo" | "in_progress" | "completed",
  ) => void;
}) {
  const isCompleted = task.status === "completed";
  const isInProgress = task.status === "in_progress";

  return (
    <div
      className={`rounded-2xl border p-4 transition ${
        isCompleted
          ? "border-[#bfd0c5] bg-[#edf5ef]"
          : isInProgress
            ? "border-[#cbb7a5] bg-[#f7f0e6]"
            : "border-[#e3d8ca] bg-[#faf5ed]"
      }`}
    >
      <div className="flex gap-4">
        <button
          type="button"
          disabled={disabled}
          onClick={() =>
            onChange(
              isCompleted ? "todo" : "completed",
            )
          }
          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition ${
            isCompleted
              ? "border-[#315d46] bg-[#315d46] text-white"
              : "border-[#bfae9a] bg-white text-[#7b1e2b]"
          }`}
          aria-label={
            isCompleted
              ? "Mark task incomplete"
              : "Mark task complete"
          }
        >
          {isCompleted ? "✓" : task.task_order}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <h3
              className={`text-sm font-semibold ${
                isCompleted
                  ? "text-[#315d46] line-through"
                  : ""
              }`}
            >
              {task.title}
            </h3>

            {!isCompleted && (
              <button
                type="button"
                disabled={disabled}
                onClick={() =>
                  onChange(
                    isInProgress
                      ? "todo"
                      : "in_progress",
                  )
                }
                className="text-left text-xs font-medium text-[#7b1e2b] hover:underline md:text-right"
              >
                {isInProgress
                  ? "Move to todo"
                  : "Start task"}
              </button>
            )}
          </div>

          {task.description && (
            <p className="mt-2 text-sm leading-6 text-[#6f655a]">
              {task.description}
            </p>
          )}

          {task.skill_focus?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {task.skill_focus.map(
                (skill) => (
                  <span
                    key={skill}
                    className="rounded-full border border-[#d6c7b6] bg-white/70 px-2.5 py-1 text-[11px] text-[#6f655a]"
                  >
                    {skill}
                  </span>
                ),
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionLabel({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="text-xs font-semibold tracking-[0.24em] text-[#7b1e2b]">
      {children}
    </div>
  );
}
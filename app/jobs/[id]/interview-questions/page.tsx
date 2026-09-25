"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type Question = {
  id: string;
  job_id: string;
  profile_id: string;
  question: string;
  category: string;
  difficulty: string | null;
  target_skill: string | null;
  why_asked: string | null;
  ideal_answer: string | null;
  key_points: string[] | null;
  follow_up_questions: string[] | null;
  source_type: string | null;
  status: string | null;
  confidence_score: number | null;
  created_at: string;
};

type Job = {
  id: string;
  title: string | null;
  company_name: string | null;
};

const CATEGORY_ORDER = [
  "technical",
  "system_design",
  "scenario",
  "project",
  "behavioral",
];

const CATEGORY_LABELS: Record<string, string> = {
  technical: "Technical",
  system_design: "System Design",
  scenario: "Scenario",
  project: "Project",
  behavioral: "Behavioral",
};

export default function InterviewQuestionsPage() {
  const params = useParams();
  const jobId = params.id as string;

  const [job, setJob] = useState<Job | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [expandedQuestion, setExpandedQuestion] =
    useState<string | null>(null);

  async function loadJob() {
    try {
      const response = await fetch("/api/jobs", {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Failed to load jobs.",
        );
      }

      const jobs: Job[] = Array.isArray(result)
        ? result
        : result.jobs ?? result.data ?? [];

      const currentJob = jobs.find(
        (item) => item.id === jobId,
      );

      if (currentJob) {
        setJob(currentJob);
      }
    } catch (err) {
      console.error("Failed to load job:", err);
    }
  }

  async function loadQuestions() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `/api/jobs/${jobId}/interview-questions`,
        {
          cache: "no-store",
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Failed to load interview questions.",
        );
      }

      setQuestions(result.questions ?? []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load interview questions.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function generateQuestions() {
    try {
      setGenerating(true);
      setError("");
      setSuccess("");

      const response = await fetch(
        `/api/jobs/${jobId}/interview-questions`,
        {
          method: "POST",
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Failed to generate interview questions.",
        );
      }

      setQuestions(result.questions ?? []);

      setSuccess(
        `${result.count ?? result.questions?.length ?? 0} interview questions generated.`,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to generate interview questions.",
      );
    } finally {
      setGenerating(false);
    }
  }

  useEffect(() => {
    if (!jobId) {
      return;
    }

    Promise.all([
      loadJob(),
      loadQuestions(),
    ]);
  }, [jobId]);

  const groupedQuestions = useMemo(() => {
    const groups: Record<string, Question[]> = {};

    for (const question of questions) {
      const category =
        question.category || "technical";

      if (!groups[category]) {
        groups[category] = [];
      }

      groups[category].push(question);
    }

    return groups;
  }, [questions]);

  const orderedCategories = CATEGORY_ORDER.filter(
    (category) => groupedQuestions[category]?.length,
  );

  for (const category of Object.keys(groupedQuestions)) {
    if (!orderedCategories.includes(category)) {
      orderedCategories.push(category);
    }
  }

  const categoryCounts = orderedCategories.map(
    (category) => ({
      category,
      count: groupedQuestions[category]?.length ?? 0,
    }),
  );

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-6 py-10 lg:px-8">
        {/* Header */}
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link
              href={`/jobs/${jobId}`}
              className="text-sm font-medium text-primary hover:underline"
            >
              ← Back to Job
            </Link>

            <p className="mt-6 text-sm font-semibold uppercase tracking-[0.2em] text-primary">
              Phase 6 · Interview Preparation
            </p>

            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-secondary sm:text-5xl">
              Interview Question Bank
            </h1>

            {job && (
              <p className="mt-3 text-lg text-muted-foreground">
                {job.title || "Untitled Position"}
                {job.company_name
                  ? ` · ${job.company_name}`
                  : ""}
              </p>
            )}

            <p className="mt-4 max-w-3xl leading-7 text-muted-foreground">
              Questions are generated from this job&apos;s
              requirements, your skill gaps, resume, and
              project context so the preparation is specific
              to this role.
            </p>
          </div>

          <button
            type="button"
            onClick={generateQuestions}
            disabled={generating}
            className="inline-flex h-11 shrink-0 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {generating
              ? "Generating..."
              : questions.length > 0
                ? "Regenerate Questions"
                : "Generate Questions"}
          </button>
        </div>

        {/* Messages */}
        {error && (
          <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">
            <p className="font-medium">
              Could not load interview questions
            </p>

            <p className="mt-1 text-sm">
              {error}
            </p>
          </div>
        )}

        {success && !error && (
          <div className="mt-8 rounded-2xl border border-[#d8c7b0] bg-[#fffaf3] p-5 text-[#6b1f2a]">
            {success}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="mt-10 rounded-2xl border border-border bg-card p-8">
            <p className="text-muted-foreground">
              Loading interview questions...
            </p>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && questions.length === 0 && (
          <section className="mt-10 rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <p className="text-xl font-semibold text-secondary">
              No interview questions yet
            </p>

            <p className="mx-auto mt-3 max-w-2xl leading-7 text-muted-foreground">
              Generate a role-specific question bank using the
              job requirements, your skill gaps, resume, and
              projects.
            </p>

            <button
              type="button"
              onClick={generateQuestions}
              disabled={generating}
              className="mt-7 inline-flex h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {generating
                ? "Generating..."
                : "Generate Interview Questions →"}
            </button>
          </section>
        )}

        {/* Summary */}
        {!loading && questions.length > 0 && (
          <>
            <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
              <div className="rounded-2xl border border-border bg-card p-5 lg:col-span-1">
                <p className="text-sm text-muted-foreground">
                  Total
                </p>

                <p className="mt-2 text-3xl font-semibold text-secondary">
                  {questions.length}
                </p>
              </div>

              {categoryCounts.map(
                ({ category, count }) => (
                  <div
                    key={category}
                    className="rounded-2xl border border-border bg-card p-5"
                  >
                    <p className="text-sm text-muted-foreground">
                      {CATEGORY_LABELS[category] ||
                        category}
                    </p>

                    <p className="mt-2 text-3xl font-semibold text-secondary">
                      {count}
                    </p>
                  </div>
                ),
              )}
            </section>

            {/* Question groups */}
            <div className="mt-10 space-y-8">
              {orderedCategories.map((category) => {
                const categoryQuestions =
                  groupedQuestions[category] ?? [];

                return (
                  <section
                    key={category}
                    className="rounded-2xl border border-border bg-card p-6 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold uppercase tracking-[0.15em] text-primary">
                          {CATEGORY_LABELS[category] ||
                            category}
                        </p>

                        <h2 className="mt-2 text-2xl font-semibold text-secondary">
                          {categoryQuestions.length}{" "}
                          questions
                        </h2>
                      </div>

                      <span className="rounded-full bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
                        {categoryQuestions.length}
                      </span>
                    </div>

                    <div className="mt-6 space-y-3">
                      {categoryQuestions.map(
                        (question, index) => {
                          const expanded =
                            expandedQuestion ===
                            question.id;

                          return (
                            <article
                              key={question.id}
                              className="rounded-xl border border-border bg-background"
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedQuestion(
                                    expanded
                                      ? null
                                      : question.id,
                                  )
                                }
                                className="w-full px-5 py-5 text-left"
                              >
                                <div className="flex items-start gap-4">
                                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#efe5d5] text-xs font-semibold text-[#6b1f2a]">
                                    {index + 1}
                                  </span>

                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      {question.difficulty && (
                                        <span className="rounded-full border border-border px-2 py-1 text-xs text-muted-foreground">
                                          {
                                            question.difficulty
                                          }
                                        </span>
                                      )}

                                      {question.target_skill && (
                                        <span className="rounded-full bg-[#efe5d5] px-2 py-1 text-xs text-[#6b1f2a]">
                                          {
                                            question.target_skill
                                          }
                                        </span>
                                      )}
                                    </div>

                                    <p className="mt-3 text-base font-medium leading-7 text-secondary">
                                      {question.question}
                                    </p>
                                  </div>

                                  <span className="shrink-0 text-muted-foreground">
                                    {expanded
                                      ? "−"
                                      : "+"}
                                  </span>
                                </div>
                              </button>

                              {expanded && (
                                <div className="border-t border-border px-5 py-5">
                                  {question.why_asked && (
                                    <div>
                                      <p className="text-sm font-semibold text-secondary">
                                        Why this is asked
                                      </p>

                                      <p className="mt-2 leading-7 text-muted-foreground">
                                        {
                                          question.why_asked
                                        }
                                      </p>
                                    </div>
                                  )}

                                  {question.ideal_answer && (
                                    <div className="mt-6">
                                      <p className="text-sm font-semibold text-secondary">
                                        Ideal answer direction
                                      </p>

                                      <div className="mt-2 whitespace-pre-wrap rounded-xl bg-card p-4 leading-7 text-muted-foreground">
                                        {
                                          question.ideal_answer
                                        }
                                      </div>
                                    </div>
                                  )}

                                  {question.key_points &&
                                    question.key_points.length >
                                      0 && (
                                      <div className="mt-6">
                                        <p className="text-sm font-semibold text-secondary">
                                          Key points to cover
                                        </p>

                                        <ul className="mt-3 space-y-2">
                                          {question.key_points.map(
                                            (point) => (
                                              <li
                                                key={point}
                                                className="rounded-lg bg-card px-4 py-3 text-sm leading-6 text-muted-foreground"
                                              >
                                                {point}
                                              </li>
                                            ),
                                          )}
                                        </ul>
                                      </div>
                                    )}

                                  {question.follow_up_questions &&
                                    question
                                      .follow_up_questions
                                      .length >
                                      0 && (
                                      <div className="mt-6">
                                        <p className="text-sm font-semibold text-secondary">
                                          Possible follow-ups
                                        </p>

                                        <ul className="mt-3 space-y-2">
                                          {question.follow_up_questions.map(
                                            (followUp) => (
                                              <li
                                                key={
                                                  followUp
                                                }
                                                className="rounded-lg border border-border px-4 py-3 text-sm leading-6 text-muted-foreground"
                                              >
                                                {followUp}
                                              </li>
                                            ),
                                          )}
                                        </ul>
                                      </div>
                                    )}
                                </div>
                              )}
                            </article>
                          );
                        },
                      )}
                    </div>
                  </section>
                );
              })}
            </div>

            {/* Mock interview CTA */}
            <section className="mt-10 rounded-2xl bg-secondary p-8">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#b85c6b]">
                Coming next
              </p>

              <h2 className="mt-3 text-3xl font-semibold text-[#f7f2ea]">
                Ready for the actual interview?
              </h2>

              <p className="mt-3 max-w-2xl leading-7 text-[#cdbfb2]">
                These questions will become the foundation
                for the AI mock interviewer in Phase 7.
              </p>

              <div className="mt-6">
                <Link
                    href={`/jobs/${jobId}/mock-interview`}
                    className="inline-flex h-11 items-center justify-center rounded-md bg-[#f7f2ea] px-5 text-sm font-medium text-[#6b1f2a] transition hover:bg-[#efe5d5]"
                    >
                    Start Mock Interview →
                </Link>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
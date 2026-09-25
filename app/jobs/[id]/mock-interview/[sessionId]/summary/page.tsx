"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";

type SummaryResponse = {
  success?: boolean;

  error?: string;

  metrics?: {
    totalQuestions: number;
    answeredQuestions: number;
    skippedQuestions: number;
    overallScore: number;
  };

  topicPerformance?: {
    skill: string;
    questions: number;
    averageScore: number;
  }[];

  strengths?: string[];

  weaknesses?: string[];

  summary?: string;

  answers?: {
    id: string;
    question: string;
    category: string;
    targetSkill: string;
    answer: string;
    score: number;
    correctness: number | null;
    structure: number | null;
    specificity: number | null;
    communication: number | null;
    feedback: string | null;
    strongerAnswer: string | null;
    skipped: boolean;
  }[];
};

export default function InterviewSummaryPage({
  params,
}: {
  params: Promise<{
    id: string;
    sessionId: string;
  }>;
}) {
  const {
    id: jobId,
    sessionId,
  } = use(params);

  const [data, setData] =
    useState<SummaryResponse | null>(
      null,
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(
      null,
    );

  const [openAnswer, setOpenAnswer] =
    useState<string | null>(
      null,
    );

  useEffect(() => {
    const loadSummary =
      async () => {
        try {
          setLoading(true);

          const response =
            await fetch(
              `/api/jobs/${jobId}/mock-interview/${sessionId}/summary`,
            );

          const result: SummaryResponse =
            await response.json();

          if (!response.ok) {
            throw new Error(
              result.error ??
                "Unable to load interview summary.",
            );
          }

          setData(result);
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load interview summary.",
          );
        } finally {
          setLoading(false);
        }
      };

    void loadSummary();
  }, [jobId, sessionId]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f2ea] text-[#321e24]">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <p className="text-sm text-[#7c6068]">
            Building your interview report...
          </p>
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-screen bg-[#f7f2ea] text-[#321e24]">
        <div className="mx-auto max-w-4xl px-6 py-20">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800">
            {error ??
              "Interview report could not be loaded."}
          </div>
        </div>
      </main>
    );
  }

  const metrics =
    data.metrics;

  return (
    <main className="min-h-screen bg-[#f7f2ea] text-[#321e24]">
      <div className="mx-auto max-w-6xl px-6 py-10 lg:px-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link
              href={`/jobs/${jobId}/mock-interview`}
              className="text-sm text-[#7c6068] hover:text-[#6b1f2a]"
            >
              ← Back to Mock Interview
            </Link>

            <p className="mt-6 text-sm font-semibold uppercase tracking-[0.2em] text-[#6b1f2a]">
              Interview Performance
            </p>

            <h1 className="mt-2 text-4xl font-semibold tracking-tight">
              Your interview report
            </h1>
          </div>

          <Link
            href={`/jobs/${jobId}/interview-questions`}
            className="rounded-xl border border-[#d8c5ba] bg-[#fffaf4] px-5 py-3 text-sm font-medium hover:bg-white"
          >
            Question Bank
          </Link>
        </div>

        <section className="mt-8 grid gap-4 sm:grid-cols-4">
          <MetricCard
            label="Overall Score"
            value={`${(
              metrics?.overallScore ??
              0
            ).toFixed(1)}/5`}
          />

          <MetricCard
            label="Answered"
            value={`${metrics?.answeredQuestions ?? 0}`}
          />

          <MetricCard
            label="Skipped"
            value={`${metrics?.skippedQuestions ?? 0}`}
          />

          <MetricCard
            label="Coverage"
            value={`${metrics?.totalQuestions ?? 0}`}
          />
        </section>

        {data.summary && (
          <section className="mt-8 rounded-3xl border border-[#dfd0c3] bg-[#fffaf4] p-8 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.15em] text-[#6b1f2a]">
              AI assessment
            </p>

            <p className="mt-4 max-w-4xl text-lg leading-8 text-[#514049]">
              {data.summary}
            </p>
          </section>
        )}

        <section className="mt-8 grid gap-6 lg:grid-cols-2">
          <ReportList
            title="Strengths"
            items={data.strengths ?? []}
            positive
          />

          <ReportList
            title="Areas to improve"
            items={data.weaknesses ?? []}
          />
        </section>

        <section className="mt-8 rounded-3xl border border-[#dfd0c3] bg-[#fffaf4] p-8 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.15em] text-[#6b1f2a]">
                Topic performance
              </p>

              <h2 className="mt-2 text-2xl font-semibold">
                How you performed by skill
              </h2>
            </div>
          </div>

          <div className="mt-6 space-y-5">
            {(data.topicPerformance ?? []).map(
              (topic) => (
                <div
                  key={topic.skill}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium">
                        {topic.skill}
                      </p>

                      <p className="text-xs text-[#8a7478]">
                        {topic.questions} question
                        {topic.questions !==
                        1
                          ? "s"
                          : ""}
                      </p>
                    </div>

                    <span className="font-semibold">
                      {topic.averageScore.toFixed(
                        1,
                      )}
                      /5
                    </span>
                  </div>

                  <div className="mt-2 h-2 rounded-full bg-[#e5d9cf]">
                    <div
                      className="h-full rounded-full bg-[#6b1f2a]"
                      style={{
                        width: `${Math.min(
                          100,
                          topic.averageScore *
                            20,
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              ),
            )}
          </div>
        </section>

        <section className="mt-8">
          <p className="text-sm font-semibold uppercase tracking-[0.15em] text-[#6b1f2a]">
            Question review
          </p>

          <h2 className="mt-2 text-2xl font-semibold">
            Review your answers
          </h2>

          <div className="mt-5 space-y-4">
            {(data.answers ?? []).map(
              (item, index) => {
                const open =
                  openAnswer ===
                  item.id;

                return (
                  <div
                    key={item.id}
                    className="overflow-hidden rounded-2xl border border-[#dfd0c3] bg-[#fffaf4]"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setOpenAnswer(
                          open
                            ? null
                            : item.id,
                        )
                      }
                      className="flex w-full items-start justify-between gap-5 p-6 text-left hover:bg-white"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full bg-[#efe3d8] px-3 py-1 text-xs">
                            Q{index + 1}
                          </span>

                          <span className="rounded-full bg-[#efe3d8] px-3 py-1 text-xs">
                            {
                              item.category
                            }
                          </span>

                          <span className="rounded-full bg-[#efe3d8] px-3 py-1 text-xs">
                            {
                              item.targetSkill
                            }
                          </span>

                          {item.skipped && (
                            <span className="rounded-full bg-red-50 px-3 py-1 text-xs text-red-700">
                              skipped
                            </span>
                          )}
                        </div>

                        <p className="mt-3 font-medium leading-7">
                          {item.question}
                        </p>
                      </div>

                      <div className="shrink-0 text-right">
                        <p className="text-2xl font-semibold text-[#6b1f2a]">
                          {item.skipped
                            ? "—"
                            : item.score.toFixed(
                                1,
                              )}
                        </p>

                        <p className="text-xs text-[#8a7478]">
                          /5
                        </p>
                      </div>
                    </button>

                    {open && (
                      <div className="border-t border-[#e5d8ce] p-6">
                        <div className="rounded-2xl bg-white p-5">
                          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#6b1f2a]">
                            Your answer
                          </p>

                          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#514049]">
                            {item.answer}
                          </p>
                        </div>

                        {!item.skipped && (
                          <>
                            <div className="mt-4 grid gap-3 sm:grid-cols-4">
                              <SmallScore
                                label="Correctness"
                                value={
                                  item.correctness
                                }
                              />

                              <SmallScore
                                label="Structure"
                                value={
                                  item.structure
                                }
                              />

                              <SmallScore
                                label="Specificity"
                                value={
                                  item.specificity
                                }
                              />

                              <SmallScore
                                label="Communication"
                                value={
                                  item.communication
                                }
                              />
                            </div>

                            {item.feedback && (
                              <div className="mt-4 rounded-2xl bg-[#f2e7dc] p-5">
                                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#6b1f2a]">
                                  Feedback
                                </p>

                                <p className="mt-2 text-sm leading-7 text-[#514049]">
                                  {
                                    item.feedback
                                  }
                                </p>
                              </div>
                            )}

                            {item.strongerAnswer && (
                              <div className="mt-4 rounded-2xl bg-[#321e24] p-5 text-[#fffaf4]">
                                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#dccbc0]">
                                  Stronger answer
                                </p>

                                <p className="mt-2 text-sm leading-7 text-[#efe1d7]">
                                  {
                                    item.strongerAnswer
                                  }
                                </p>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              },
            )}
          </div>
        </section>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href={`/jobs/${jobId}/mock-interview`}
            className="rounded-xl bg-[#6b1f2a] px-5 py-3 text-sm font-medium text-white hover:bg-[#571821]"
          >
            Start Another Interview
          </Link>

          <Link
            href={`/jobs/${jobId}`}
            className="rounded-xl border border-[#d8c5ba] bg-[#fffaf4] px-5 py-3 text-sm font-medium hover:bg-white"
          >
            Back to Job
          </Link>
        </div>
      </div>
    </main>
  );
}

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-[#dfd0c3] bg-[#fffaf4] p-5">
      <p className="text-xs uppercase tracking-[0.15em] text-[#8a7478]">
        {label}
      </p>

      <p className="mt-2 text-2xl font-semibold">
        {value}
      </p>
    </div>
  );
}

function ReportList({
  title,
  items,
  positive,
}: {
  title: string;
  items: string[];
  positive?: boolean;
}) {
  return (
    <div className="rounded-3xl border border-[#dfd0c3] bg-[#fffaf4] p-7">
      <h2 className="text-xl font-semibold">
        {title}
      </h2>

      <div className="mt-5 space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-[#806a72]">
            No observations yet.
          </p>
        ) : (
          items.map(
            (item, index) => (
              <div
                key={`${item}-${index}`}
                className={`rounded-2xl p-4 text-sm leading-6 ${
                  positive
                    ? "bg-[#edf1e8]"
                    : "bg-[#f5e8e2]"
                }`}
              >
                {item}
              </div>
            ),
          )
        )}
      </div>
    </div>
  );
}

function SmallScore({
  label,
  value,
}: {
  label: string;
  value: number | null;
}) {
  return (
    <div className="rounded-xl bg-[#f7f2ea] p-4">
      <p className="text-xs text-[#8a7478]">
        {label}
      </p>

      <p className="mt-1 font-semibold">
        {value ?? "—"}
        {value !== null
          ? "/5"
          : ""}
      </p>
    </div>
  );
}
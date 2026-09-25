/* app/page.tsx */

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Job = {
  id: string;
  company_name: string | null;
  title: string | null;
  source_url?: string | null;
  status?: string | null;
  readiness_score?: number | null;
  created_at?: string;
};

type SkillGap = {
  requiredSkill: string;
  requirementType: "must_have" | "nice_to_have";
  matchStatus: "matched" | "partial" | "missing";
  gapType: "blocking" | "minor" | null;
};

type InterviewPerformance = {
  skill_name: string;
  question_count: number;
  average_score: number;
  performance_level:
    | "strong"
    | "developing"
    | "weak"
    | "insufficient";
};

type Project = {
  id: string;
  title: string;
  status: string;
  difficulty: string;
  estimated_weeks: number;
  target_skills: string[];
};

type DashboardData = {
  jobs: Job[];
  latestJob: Job | null;
  gaps: SkillGap[];
  interviewPerformance: InterviewPerformance[];
  projects: Project[];
};

const EMPTY: DashboardData = {
  jobs: [],
  latestJob: null,
  gaps: [],
  interviewPerformance: [],
  projects: [],
};

const surface =
  "rounded-[28px] border border-[#dfd0c3] bg-[#fffaf4] shadow-[0_14px_45px_rgba(107,31,42,.07)] backdrop-blur-2xl";

export default function DashboardPage() {
  const [data, setData] =
    useState<DashboardData>(EMPTY);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      try {
        setLoading(true);
        setError("");

        const jobsResponse =
          await fetch("/api/jobs");

        const jobsData =
          await jobsResponse.json();

        if (
          !jobsResponse.ok ||
          !jobsData.success
        ) {
          throw new Error(
            jobsData.error ||
              "Unable to load jobs.",
          );
        }

        const jobs: Job[] =
          jobsData.jobs ?? [];

        if (jobs.length === 0) {
          if (!cancelled) {
            setData(EMPTY);
            setLoading(false);
          }
          return;
        }

        const latestJob =
          [...jobs].sort(
            (a, b) =>
              new Date(
                b.created_at ?? 0,
              ).getTime() -
              new Date(
                a.created_at ?? 0,
              ).getTime(),
          )[0] ?? null;

        let gaps: SkillGap[] = [];
        let interviewPerformance:
          InterviewPerformance[] =
          [];
        let projects: Project[] = [];

        if (latestJob) {
          const [
            practiceResponse,
            projectsResponse,
          ] = await Promise.all([
            fetch(
              `/api/jobs/${latestJob.id}/practice-data`,
            ),
            fetch(
              `/api/jobs/${latestJob.id}/projects`,
            ),
          ]);

          if (practiceResponse.ok) {
            const practice =
              await practiceResponse.json();

            gaps =
              Array.isArray(
                practice.gaps,
              )
                ? practice.gaps
                : [];

            interviewPerformance =
              Array.isArray(
                practice.interviewPerformance,
              )
                ? practice.interviewPerformance
                : [];
          }

          if (projectsResponse.ok) {
            const projectData =
              await projectsResponse.json();

            projects =
              Array.isArray(
                projectData.projects,
              )
                ? projectData.projects
                : [];
          }
        }

        if (!cancelled) {
          setData({
            jobs,
            latestJob,
            gaps,
            interviewPerformance,
            projects,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load dashboard.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, []);

  const topGaps = useMemo(() => {
    return data.gaps
      .filter(
        (gap) =>
          gap.matchStatus ===
          "missing",
      )
      .sort((a, b) => {
        const aWeight =
          a.requirementType ===
          "must_have"
            ? 0
            : 1;

        const bWeight =
          b.requirementType ===
          "must_have"
            ? 0
            : 1;

        return (
          aWeight - bWeight ||
          a.requiredSkill.localeCompare(
            b.requiredSkill,
          )
        );
      })
      .slice(0, 5);
  }, [data.gaps]);

  const readiness =
    data.latestJob?.readiness_score ??
    0;

  const interviewScore =
    data.interviewPerformance.length >
    0
      ? data.interviewPerformance.reduce(
          (sum, item) =>
            sum + item.average_score,
          0,
        ) /
        data.interviewPerformance.length
      : null;

  const interviewAssessed =
    data.interviewPerformance.length;

  const strongInterviewAreas =
    data.interviewPerformance.filter(
      (item) =>
        item.performance_level ===
        "strong",
    ).length;

  const pipeline = [
    {
      title: "Job",
      subtitle: "Target role saved",
      done: Boolean(
        data.latestJob,
      ),
      href: data.latestJob
        ? `/jobs/${data.latestJob.id}/requirements`
        : "/jobs/new",
    },
    {
      title: "Requirements",
      subtitle:
        data.gaps.length > 0
          ? `${data.gaps.length} skills evaluated`
          : "Analyze the role",
      done: data.gaps.length > 0,
      href: data.latestJob
        ? `/jobs/${data.latestJob.id}`
        : "/jobs/new",
    },
    {
      title: "Skill gaps",
      subtitle:
        topGaps.length > 0
          ? `${topGaps.length} priority gaps`
          : "See what to improve",
      done: data.gaps.length > 0,
      href: data.latestJob
        ? `/jobs/${data.latestJob.id}/skill-gaps`
        : "/jobs",
    },
    {
      title: "Resume",
      subtitle: "Tailor without inventing",
      done: Boolean(
        data.latestJob,
      ),
      href: data.latestJob
        ? `/jobs/${data.latestJob.id}/resume`
        : "/jobs",
    },
    {
      title: "Projects",
      subtitle: `${data.projects.length} recommended`,
      done: data.projects.length > 0,
      href: data.latestJob
        ? `/jobs/${data.latestJob.id}/projects`
        : "/jobs",
    },
    {
      title: "Interview",
      subtitle:
        interviewAssessed > 0
          ? `${interviewAssessed} areas assessed`
          : "Practice with AI",
      done:
        interviewAssessed > 0,
      href: data.latestJob
        ? `/jobs/${data.latestJob.id}/mock-interview`
        : "/jobs",
    },
  ];

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f2ea] text-[#321e24]">
        <div className="mx-auto max-w-7xl px-6 py-14">
          <div className="h-8 w-44 animate-pulse rounded-xl bg-[#e6ddd3]" />
          <div className="mt-4 h-14 max-w-xl animate-pulse rounded-2xl bg-[#e6ddd3]" />
          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-64 animate-pulse rounded-[28px] bg-[#e6ddd3]"
              />
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (!data.latestJob) {
    return (
      <main className="min-h-screen bg-[#f7f2ea] text-[#321e24]">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <div className={`${surface} p-10`}>
            <p className="text-sm font-semibold text-[#6b1f2a]">
              CAREER COMMAND CENTER
            </p>

            <h1 className="mt-3 max-w-3xl text-5xl font-semibold tracking-[-0.04em]">
              One place to prepare for the
              job you actually want.
            </h1>

            <p className="mt-5 max-w-2xl text-lg leading-8 text-[#806a72]">
              Add a job and turn the posting into
              requirements, skill gaps, a tailored
              resume, projects and an AI interview loop.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/jobs/new"
                className="inline-flex h-11 items-center justify-center rounded-full bg-[#8e1b2b] px-5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(142,27,43,.18)] transition hover:-translate-y-0.5 hover:bg-[#751524]"
              >
                Add your first job →
              </Link>

              <Link
                href="/settings"
                className="inline-flex h-11 items-center justify-center rounded-full border border-[#d8c5ba] bg-white px-5 text-sm font-semibold"
              >
                Set up profile
              </Link>
            </div>

            <div className="mt-10 grid gap-3 md:grid-cols-3">
              {[
                [
                  "01",
                  "Understand",
                  "Extract exactly what the role asks for.",
                ],
                [
                  "02",
                  "Close gaps",
                  "Turn missing skills into projects and practice.",
                ],
                [
                  "03",
                  "Rehearse",
                  "Run a realistic text or voice interview.",
                ],
              ].map(
                ([number, title, body]) => (
                  <div
                    key={title}
                    className="rounded-3xl bg-[#f4eadf] p-5"
                  >
                    <span className="text-xs font-semibold text-[#6b1f2a]">
                      {number}
                    </span>

                    <h2 className="mt-5 text-lg font-semibold">
                      {title}
                    </h2>

                    <p className="mt-2 text-sm leading-6 text-[#806a72]">
                      {body}
                    </p>
                  </div>
                ),
              )}
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f2ea] text-[#321e24]">
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-5 rounded-2xl border border-[#e6c9bd] bg-[#fff1ed] px-5 py-4 text-sm text-[#6b1f2a]">
            {error}
          </div>
        )}

        <section className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold tracking-[0.16em] text-[#6b1f2a]">
              CAREER COMMAND CENTER
            </p>

            <h1 className="mt-2 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
              Good morning. Let&apos;s get
              you interview-ready.
            </h1>

            <p className="mt-3 max-w-2xl text-base leading-7 text-[#806a72]">
              Your latest job, gaps, projects and
              interview performance — in one quiet workspace.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/jobs/new"
              className="inline-flex h-11 items-center justify-center rounded-full bg-[#8e1b2b] px-5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(142,27,43,.18)] transition hover:-translate-y-0.5 hover:bg-[#751524]"
            >
              + New job
            </Link>

            <Link
              href="/jobs"
              className="inline-flex h-11 items-center justify-center rounded-full border border-[#d8c5ba] bg-white px-5 text-sm font-semibold"
            >
              All jobs
            </Link>
          </div>
        </section>

        <section className="mt-8 grid gap-5 lg:grid-cols-[1.45fr_.85fr]">
          <div className={`${surface} overflow-hidden p-7 sm:p-8`}>
            <div className="flex flex-col gap-7 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#5a9b62] shadow-[0_0_0_4px_rgba(52,199,89,.08)]" />
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#806a72]">
                    Current target
                  </span>
                </div>

                <h2 className="mt-4 truncate text-3xl font-semibold tracking-[-0.03em]">
                  {data.latestJob.title}
                </h2>

                <p className="mt-2 text-base text-[#806a72]">
                  {data.latestJob.company_name}
                </p>

                <div className="mt-6 flex flex-wrap gap-2">
                  <span className="rounded-full border border-[#e5e5ea] bg-[#f4eadf] px-3 py-1 text-xs font-medium text-[#806a72]">
                    {data.gaps.length} skills assessed
                  </span>

                  <span className="rounded-full border border-[#e5e5ea] bg-[#f4eadf] px-3 py-1 text-xs font-medium text-[#806a72]">
                    {data.projects.length} projects
                  </span>

                  <span className="rounded-full border border-[#e5e5ea] bg-[#f4eadf] px-3 py-1 text-xs font-medium text-[#806a72]">
                    {interviewAssessed > 0
                      ? `${interviewAssessed} interview areas`
                      : "Interview not started"}
                  </span>
                </div>
              </div>

              <Link
                href={`/jobs/${data.latestJob.id}`}
                className="inline-flex h-11 shrink-0 items-center justify-center rounded-full border border-[#d8c5ba] bg-white px-5 text-sm font-semibold"
              >
                Open job →
              </Link>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <MiniStat
                label="Must-have gaps"
                value={`${data.gaps.filter(
                  (g) =>
                    g.requirementType ===
                      "must_have" &&
                    g.matchStatus ===
                      "missing",
                ).length}`}
              />

              <MiniStat
                label="Interview areas"
                value={`${interviewAssessed}`}
              />

              <MiniStat
                label="Projects queued"
                value={`${data.projects.length}`}
              />
            </div>
          </div>

          <div className={`${surface} flex items-center gap-6 p-7`}>
            <ReadinessRing value={readiness} />

            <div>
              <p className="text-sm text-[#806a72]">
                Role readiness
              </p>

              <p className="mt-1 text-3xl font-semibold tracking-[-0.03em]">
                {readiness}%
              </p>

              <p className="mt-2 text-sm leading-6 text-[#806a72]">
                Based on the current skill-gap analysis
                for this role.
              </p>

              <Link
                href={`/jobs/${data.latestJob.id}/skill-profile`}
                className="mt-4 inline-flex text-sm font-semibold text-[#6b1f2a]"
              >
                View skill profile →
              </Link>
            </div>
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-3 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#806a72]">
                Your preparation
              </p>

              <h2 className="mt-1 text-xl font-semibold">
                Continue where you left off
              </h2>
            </div>

            <span className="text-sm text-[#957f86]">
              6-stage preparation loop
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {pipeline.map(
              (step, index) => (
                <Link
                  key={step.title}
                  href={step.href}
                  className="group rounded-[22px] border border-white bg-white/75 p-5 shadow-[0_8px_26px_rgba(0,0,0,.04)] transition hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_14px_35px_rgba(0,0,0,.08)]"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#6b1f2a]">
                      0{index + 1}
                    </span>

                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        step.done
                          ? "bg-[#5a9b62]"
                          : "bg-[#d2d2d7]"
                      }`}
                    />
                  </div>

                  <p className="mt-5 text-lg font-semibold">
                    {step.title}
                  </p>

                  <p className="mt-2 text-sm leading-5 text-[#806a72]">
                    {step.subtitle}
                  </p>

                  <span className="mt-5 block text-sm font-semibold text-[#6b1f2a] opacity-0 transition group-hover:opacity-100">
                    Open →
                  </span>
                </Link>
              ),
            )}
          </div>
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-2">
          <div className={`${surface} p-7`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6b1f2a]">
                  Needs attention
                </p>

                <h2 className="mt-2 text-2xl font-semibold">
                  Priority skill gaps
                </h2>
              </div>

              <Link
                href={`/jobs/${data.latestJob.id}/skill-profile`}
                className="text-sm font-semibold text-[#6b1f2a]"
              >
                See all
              </Link>
            </div>

            <div className="mt-5 divide-y divide-[#e6ddd3]">
              {topGaps.length ===
              0 ? (
                <div className="rounded-2xl bg-[#f4eadf] p-5 text-sm text-[#806a72]">
                  No missing skills are currently flagged.
                </div>
              ) : (
                topGaps.map(
                  (gap) => (
                    <div
                      key={
                        gap.requiredSkill
                      }
                      className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold">
                          {gap.requiredSkill}
                        </p>

                        <p className="mt-1 text-xs text-[#957f86]">
                          {gap.requirementType ===
                          "must_have"
                            ? "Must-have"
                            : "Nice-to-have"}{" "}
                          ·{" "}
                          {gap.gapType ===
                          "blocking"
                            ? "Blocking gap"
                            : "Minor gap"}
                        </p>
                      </div>

                      <span className="shrink-0 rounded-full border border-[#e6c9bd] bg-[#fff1ed] px-3 py-1 text-xs font-medium text-[#6b1f2a]">
                        Missing
                      </span>
                    </div>
                  ),
                )
              )}
            </div>
          </div>

          <div className={`${surface} p-7`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6b1f2a]">
                  Interview
                </p>

                <h2 className="mt-2 text-2xl font-semibold">
                  Recent performance
                </h2>
              </div>

              <Link
                href={`/jobs/${data.latestJob.id}/mock-interview`}
                className="inline-flex h-10 items-center justify-center rounded-full border border-[#d8c5ba] bg-white px-4 text-sm font-semibold"
              >
                Practice
              </Link>
            </div>

            {interviewScore ===
            null ? (
              <div className="mt-6 rounded-2xl bg-[#f4eadf] p-5">
                <p className="font-semibold">
                  No interview evidence yet.
                </p>

                <p className="mt-2 text-sm leading-6 text-[#806a72]">
                  Start a text or voice interview and
                  the results will feed back into your skill profile.
                </p>

                <Link
                  href={`/jobs/${data.latestJob.id}/mock-interview`}
                  className="mt-4 inline-flex text-sm font-semibold text-[#6b1f2a]"
                >
                  Start mock interview →
                </Link>
              </div>
            ) : (
              <div className="mt-6">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-4xl font-semibold">
                      {interviewScore.toFixed(
                        1,
                      )}
                      <span className="text-xl font-normal text-[#957f86]">
                        /5
                      </span>
                    </p>

                    <p className="mt-2 text-sm text-[#806a72]">
                      {interviewAssessed} skill areas assessed
                    </p>
                  </div>

                  <p className="text-sm font-semibold text-[#34a853]">
                    {strongInterviewAreas} strong
                  </p>
                </div>

                <div className="mt-6 space-y-3">
                  {data.interviewPerformance
                    .slice(0, 3)
                    .map(
                      (item) => (
                        <div
                          key={
                            item.skill_name
                          }
                        >
                          <div className="flex justify-between text-sm">
                            <span className="font-medium">
                              {item.skill_name}
                            </span>

                            <span className="text-[#806a72]">
                              {item.average_score.toFixed(
                                1,
                              )}
                              /5
                            </span>
                          </div>

                          <div className="mt-2 h-1.5 rounded-full bg-[#e6ddd3]">
                            <div
                              className="h-full rounded-full bg-[#8e1b2b]"
                              style={{
                                width: `${Math.min(
                                  100,
                                  item.average_score *
                                    20,
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      ),
                    )}
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
          <div className={`${surface} p-7`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6b1f2a]">
                  Build next
                </p>

                <h2 className="mt-2 text-2xl font-semibold">
                  Project queue
                </h2>
              </div>

              <Link
                href={`/jobs/${data.latestJob.id}/projects`}
                className="text-sm font-semibold text-[#6b1f2a]"
              >
                View all
              </Link>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {data.projects
                .slice(0, 4)
                .map(
                  (project) => (
                    <Link
                      key={
                        project.id
                      }
                      href={`/jobs/${data.latestJob!.id}/projects/${project.id}`}
                      className="group rounded-2xl bg-[#f4eadf] p-5 transition hover:bg-[#efe4d8]"
                    >
                      <div className="flex justify-between gap-3">
                        <span className="text-xs font-semibold text-[#6b1f2a]">
                          {project.difficulty}
                        </span>

                        <span className="text-xs text-[#957f86]">
                          {project.estimated_weeks}w
                        </span>
                      </div>

                      <h3 className="mt-4 font-semibold">
                        {project.title}
                      </h3>

                      <p className="mt-2 text-sm text-[#806a72]">
                        {project.target_skills
                          .slice(0, 3)
                          .join(" · ")}
                      </p>

                      <p className="mt-4 text-sm font-semibold text-[#6b1f2a]">
                        Open project →
                      </p>
                    </Link>
                  ),
                )}

              {data.projects.length ===
                0 && (
                <div className="md:col-span-2 rounded-2xl bg-[#f4eadf] p-5 text-sm text-[#806a72]">
                  No project recommendations yet.
                </div>
              )}
            </div>
          </div>

          <div className={`${surface} p-7`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6b1f2a]">
                  Recent roles
                </p>

                <h2 className="mt-2 text-2xl font-semibold">
                  Your jobs
                </h2>
              </div>

              <Link
                href="/jobs"
                className="text-sm font-semibold text-[#6b1f2a]"
              >
                Manage
              </Link>
            </div>

            <div className="mt-5 space-y-2">
              {data.jobs
                .slice(0, 5)
                .map(
                  (job) => (
                    <Link
                      key={job.id}
                      href={`/jobs/${job.id}`}
                      className="group flex items-center justify-between gap-4 rounded-2xl px-4 py-3 transition hover:bg-[#f4eadf]"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {job.title}
                        </p>

                        <p className="mt-1 text-xs text-[#957f86]">
                          {job.company_name}
                        </p>
                      </div>

                      <span className="text-sm font-semibold text-[#6b1f2a]">
                        {job.readiness_score ??
                          0}
                        %
                      </span>
                    </Link>
                  ),
                )}
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-[28px] border border-[#dfd0c3] bg-[#fffaf4] p-7 shadow-[0_12px_36px_rgba(0,0,0,.05)] backdrop-blur-xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6b1f2a]">
                Workspace
              </p>

              <h2 className="mt-2 text-2xl font-semibold">
                Everything you need for this role
              </h2>
            </div>

            <p className="text-sm text-[#957f86]">
              One job · one preparation loop
            </p>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <QuickTool
              title="Tailored resume"
              body="Generate and audit your role-specific resume."
              href={`/jobs/${data.latestJob.id}/resume`}
            />

            <QuickTool
              title="Question bank"
              body="Review technical, scenario and behavioral questions."
              href={`/jobs/${data.latestJob.id}/interview-questions`}
            />

            <QuickTool
              title="Skill profile"
              body="See profile evidence alongside interview evidence."
              href={`/jobs/${data.latestJob.id}/skill-profile`}
            />

            <QuickTool
              title="Mock interview"
              body="Practice in text or voice with adaptive questioning."
              href={`/jobs/${data.latestJob.id}/mock-interview`}
            />
          </div>
        </section>
      </div>
    </main>
  );
}

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-[#f4eadf] px-4 py-3">
      <p className="text-xs text-[#957f86]">
        {label}
      </p>

      <p className="mt-1 text-xl font-semibold">
        {value}
      </p>
    </div>
  );
}

function ReadinessRing({
  value,
}: {
  value: number;
}) {
  return (
    <div
      className="grid h-32 w-32 shrink-0 place-items-center rounded-full"
      style={{
        background:
          `conic-gradient(#8e1b2b ${
            value * 3.6
          }deg, #e5e5ea 0deg)`,
      }}
    >
      <div className="grid h-24 w-24 place-items-center rounded-full bg-white">
        <span className="text-2xl font-semibold">
          {value}%
        </span>
      </div>
    </div>
  );
}

function QuickTool({
  title,
  body,
  href,
}: {
  title: string;
  body: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl bg-[#f4eadf] p-5 transition hover:bg-[#efe4d8]"
    >
      <h3 className="font-semibold">
        {title}
      </h3>

      <p className="mt-2 text-sm leading-6 text-[#806a72]">
        {body}
      </p>

      <p className="mt-4 text-sm font-semibold text-[#6b1f2a]">
        Open →
      </p>
    </Link>
  );
}

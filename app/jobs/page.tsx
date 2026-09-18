"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Job = {
  id: string;
  title: string | null;
  company_name: string | null;
  source_url: string | null;
  status: string | null;
  readiness_score: number | null;
  created_at: string;
};

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadJobs() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/jobs", {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Failed to load jobs.",
        );
      }

      const jobsData = Array.isArray(result)
        ? result
        : result.jobs ?? result.data ?? [];

      setJobs(jobsData);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load jobs.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadJobs();
  }, []);

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-6 py-12 lg:px-8">
        {/* Header */}
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
              Jobs
            </p>

            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-secondary sm:text-5xl">
              Your job analyses
            </h1>

            <p className="mt-4 max-w-2xl text-muted-foreground">
              Review your saved jobs, readiness scores, skill gaps,
              resumes, projects, and interview preparation.
            </p>
          </div>

          <Link
            href="/jobs/new"
            className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Analyze a Job →
          </Link>
        </div>

        {/* Loading */}
        {loading && (
          <div className="mt-10 rounded-2xl border border-border bg-card p-8">
            <p className="text-muted-foreground">
              Loading your jobs...
            </p>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="mt-10 rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
            <p className="font-medium">
              Could not load jobs
            </p>

            <p className="mt-2 text-sm">
              {error}
            </p>

            <button
              type="button"
              onClick={loadJobs}
              className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Try again
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && jobs.length === 0 && (
          <div className="mt-10 rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <p className="text-lg font-semibold text-secondary">
              No jobs analyzed yet
            </p>

            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
              Start by adding a job description. The system will
              extract requirements, calculate skill gaps, tailor
              your resume, recommend projects, and prepare interview
              questions.
            </p>

            <Link
              href="/jobs/new"
              className="mt-6 inline-flex h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground"
            >
              Analyze your first job →
            </Link>
          </div>
        )}

        {/* Jobs */}
        {!loading && !error && jobs.length > 0 && (
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {jobs.map((job) => {
              const readiness = job.readiness_score ?? 0;

              return (
                <Link
                  key={job.id}
                  href={`/jobs/${job.id}`}
                  className="group rounded-2xl border border-border bg-card p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary">
                        Job analysis
                      </p>

                      <h2 className="mt-2 truncate text-xl font-semibold text-secondary">
                        {job.title || "Untitled Position"}
                      </h2>

                      <p className="mt-1 text-sm text-muted-foreground">
                        {job.company_name || "Company not specified"}
                      </p>
                    </div>

                    <div className="shrink-0 rounded-xl bg-background px-3 py-2 text-center">
                      <p className="text-xs text-muted-foreground">
                        Readiness
                      </p>

                      <p className="mt-1 text-xl font-semibold text-secondary">
                        {readiness}%
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{
                        width: `${Math.min(
                          Math.max(readiness, 0),
                          100,
                        )}%`,
                      }}
                    />
                  </div>

                  <div className="mt-5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
                        {job.status || "saved"}
                      </span>

                      <span className="text-xs text-muted-foreground">
                        {new Date(
                          job.created_at,
                        ).toLocaleDateString()}
                      </span>
                    </div>

                    <span className="text-sm font-medium text-primary transition-transform group-hover:translate-x-1">
                      Open →
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
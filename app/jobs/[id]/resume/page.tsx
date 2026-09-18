"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { Button } from "@/components/ui/button";

type ResumeData = {
  id: string;
  job_id: string;
  tailored_text: string;
  ats_score: number | null;
  unsupported_claims: string[];
  suspicious_changes: string[];
};

type JobData = {
  id: string;
  title: string | null;
  company_name: string | null;
};

export default function ResumePage() {
  const params = useParams();
  const jobId = params.id as string;

  const [job, setJob] = useState<JobData | null>(null);
  const [resume, setResume] = useState<ResumeData | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function loadResume() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          `/api/jobs/${jobId}/resume-data`,
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.error || "Failed to load resume.",
          );
        }

        setJob(result.job);
        setResume(result.resume);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load resume.",
        );
      } finally {
        setLoading(false);
      }
    }

    if (jobId) {
      loadResume();
    }
  }, [jobId]);

  async function copyResume() {
    if (!resume?.tailored_text) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        resume.tailored_text,
      );

      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      setError("Could not copy the resume.");
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-background px-6 py-12">
        <div className="mx-auto max-w-5xl">
          <p className="text-muted-foreground">
            Loading tailored resume...
          </p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-background px-6 py-12">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
            {error}
          </div>

          <Link
            href={`/jobs/${jobId}`}
            className="mt-6 inline-flex"
          >
            <Button>Back to Job</Button>
          </Link>
        </div>
      </main>
    );
  }

  if (!job || !resume) {
    return (
      <main className="min-h-screen bg-background px-6 py-12">
        <div className="mx-auto max-w-5xl">
          <p className="text-muted-foreground">
            Resume not generated yet.
          </p>

          <Link
            href={`/jobs/${jobId}`}
            className="mt-6 inline-flex"
          >
            <Button>Back to Job</Button>
          </Link>
        </div>
      </main>
    );
  }

  const unsupportedClaims =
    resume.unsupported_claims ?? [];

  const suspiciousChanges =
    resume.suspicious_changes ?? [];

  const atsScore = resume.ats_score ?? 0;

  return (
    <main className="min-h-screen bg-background px-6 py-12">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
              Tailored Resume
            </p>

            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-secondary sm:text-5xl">
              {job.title || "Untitled Position"}
            </h1>

            {job.company_name && (
              <p className="mt-2 text-lg text-muted-foreground">
                {job.company_name}
              </p>
            )}
          </div>

          <Link href={`/jobs/${jobId}`}>
            <Button variant="outline">
              Back to Job
            </Button>
          </Link>
        </div>

        {/* Summary */}
        <section className="mt-10 grid gap-4 md:grid-cols-3">
          {/* ATS */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <p className="text-sm font-medium text-muted-foreground">
              ATS coverage
            </p>

            <p className="mt-2 text-4xl font-semibold text-secondary">
              {atsScore}%
            </p>

            <div className="mt-5 h-3 overflow-hidden rounded-full bg-[#e5d9ca]">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{
                  width: `${Math.min(
                    Math.max(atsScore, 0),
                    100,
                  )}%`,
                }}
              />
            </div>

            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              Keyword coverage calculated against the job
              requirements.
            </p>
          </div>

          {/* Unsupported */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <p className="text-sm font-medium text-muted-foreground">
              Unsupported requirements
            </p>

            <p className="mt-2 text-4xl font-semibold text-secondary">
              {unsupportedClaims.length}
            </p>

            <p className="mt-2 text-sm leading-5 text-muted-foreground">
              Requirements that the current resume does not
              clearly demonstrate.
            </p>
          </div>

          {/* Integrity */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <p className="text-sm font-medium text-muted-foreground">
              Resume integrity
            </p>

            <p className="mt-2 text-xl font-semibold text-secondary">
              Review before applying
            </p>

            <p className="mt-2 text-sm leading-5 text-muted-foreground">
              Verify every statement against your actual
              experience.
            </p>
          </div>
        </section>

        {/* Unsupported requirements */}
        {unsupportedClaims.length > 0 && (
          <section className="mt-6 rounded-2xl border border-[#d8c7b0] bg-[#fffaf3] p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.15em] text-primary">
              Important
            </p>

            <h2 className="mt-2 text-xl font-semibold text-secondary">
              Requirements not supported by your resume
            </h2>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              These requirements were identified from the job
              but were not supported by your existing resume.
              Do not claim them as experience unless you
              genuinely have that experience.
            </p>

            <div className="mt-5 space-y-2">
              {unsupportedClaims.map((claim) => (
                <div
                  key={claim}
                  className="rounded-lg border border-[#d8c7b0] bg-[#efe5d5] px-4 py-3 text-sm leading-6 text-[#6b1f2a]"
                >
                  {claim}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Factuality audit */}
        {suspiciousChanges.length > 0 && (
          <section className="mt-6 rounded-2xl border border-[#d8c7b0] bg-[#fffaf3] p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.15em] text-primary">
              Review changes
            </p>

            <h2 className="mt-2 text-xl font-semibold text-secondary">
              Potentially unsupported changes
            </h2>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              The factuality audit found changes that deserve a
              manual comparison with your base resume.
            </p>

            <div className="mt-5 space-y-2">
              {suspiciousChanges.map((change) => (
                <div
                  key={change}
                  className="rounded-lg border border-[#d8c7b0] bg-[#efe5d5] px-4 py-3 text-sm leading-6 text-[#6b1f2a]"
                >
                  {change}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Resume */}
        <section className="mt-6 rounded-2xl border border-border bg-card p-8 shadow-sm print:border-0 print:shadow-none print:p-0">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.15em] text-primary">
                Generated version
              </p>

              <h2 className="mt-2 text-2xl font-semibold text-secondary">
                Tailored resume
              </h2>

              <p className="mt-1 text-sm text-muted-foreground">
                Optimized for this specific job without intentionally
                adding unsupported experience.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={copyResume}
              >
                {copied ? "Copied!" : "Copy Resume"}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => window.print()}
              >
                Save as PDF
              </Button>

              <a
                href={`/api/jobs/${jobId}/resume-docx`}
                download
              >
                <Button type="button">
                  Download DOCX
                </Button>
              </a>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-border bg-background p-8 print:mt-0 print:border-0 print:p-0">
            <pre className="whitespace-pre-wrap font-mono text-sm leading-7 text-secondary print:text-black">
              {resume.tailored_text}
            </pre>
          </div>
        </section>

        {/* Footer */}
        <div className="mt-6 flex justify-between print:hidden">
          <Link href={`/jobs/${jobId}`}>
            <Button variant="outline">
              ← Back to Analysis
            </Button>
          </Link>

          <span className="rounded-full border border-border bg-card px-4 py-2 text-xs text-muted-foreground">
            Resume variant
          </span>
        </div>
      </div>
    </main>
  );
}
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function NewJobPage() {
  const router = useRouter();

  const [companyName, setCompanyName] = useState("");
  const [title, setTitle] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [rawJdText, setRawJdText] = useState("");

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");
    setStatus("");

    if (!rawJdText.trim()) {
      setError("Please paste the job description.");
      return;
    }

    if (rawJdText.trim().length < 200) {
      setError(
        "Please paste the complete job description (at least 200 characters).",
      );
      return;
    }

    try {
      setLoading(true);

      // STEP 1: Save the job
      setStatus("Saving job...");

      const jobResponse = await fetch("/api/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyName,
          title,
          sourceUrl,
          rawJdText,
        }),
      });

      const jobText = await jobResponse.text();

      let jobResult: {
        success?: boolean;
        job?: { id: string };
        error?: string;
      };

      try {
        jobResult = JSON.parse(jobText);
      } catch {
        throw new Error(
          `Job API returned an invalid response (${jobResponse.status}).`,
        );
      }

      if (!jobResponse.ok || !jobResult.job?.id) {
        throw new Error(
          jobResult.error || "Failed to save the job.",
        );
      }

      const jobId = jobResult.job.id;

      // STEP 2: Run AI analysis
      setStatus("Analyzing requirements with AI...");

      const analysisResponse = await fetch(
        `/api/jobs/${jobId}/analyze`,
        {
          method: "POST",
        },
      );

      const analysisText = await analysisResponse.text();

      let analysisResult: {
        success?: boolean;
        error?: string;
      };

      try {
        analysisResult = JSON.parse(analysisText);
      } catch {
        throw new Error(
          `Analysis API returned an invalid response (${analysisResponse.status}).`,
        );
      }

      if (!analysisResponse.ok || !analysisResult.success) {
        throw new Error(
          analysisResult.error || "Failed to analyze the job.",
        );
      }

      // STEP 3: Open the analyzed job
      setStatus("Analysis complete. Opening results...");

      router.push(`/jobs/${jobId}`);
    } catch (err) {
      console.error("Job analysis flow error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-background px-6 py-12">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
          New Job
        </p>

        <h1 className="mt-3 text-4xl font-semibold text-secondary">
          Analyze a job
        </h1>

        <p className="mt-4 text-muted-foreground">
          Add a job description and we&apos;ll turn it into a
          personalized preparation plan.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-10 space-y-6 rounded-2xl border border-border bg-card p-6 shadow-sm"
        >
          <div>
            <label className="mb-2 block text-sm font-medium text-secondary">
              Company
            </label>

            <Input
              value={companyName}
              onChange={(event) =>
                setCompanyName(event.target.value)
              }
              placeholder="e.g. Amazon"
              disabled={loading}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-secondary">
              Job title
            </label>

            <Input
              value={title}
              onChange={(event) =>
                setTitle(event.target.value)
              }
              placeholder="e.g. DevOps Engineer"
              disabled={loading}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-secondary">
              Job URL
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                optional
              </span>
            </label>

            <Input
              value={sourceUrl}
              onChange={(event) =>
                setSourceUrl(event.target.value)
              }
              placeholder="https://..."
              disabled={loading}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-secondary">
              Job description
            </label>

            <Textarea
              value={rawJdText}
              onChange={(event) =>
                setRawJdText(event.target.value)
              }
              placeholder="Paste the complete job description here..."
              className="min-h-80 resize-none bg-background"
              disabled={loading}
            />
          </div>

          {status && !error && (
            <div className="rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm text-secondary">
              {status}
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={loading}
            >
              {loading ? "Analyzing..." : "Analyze Job"}
            </Button>
          </div>
        </form>
      </div>
    </main>
  );
}
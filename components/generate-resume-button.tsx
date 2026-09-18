"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

export function GenerateResumeButton({
  jobId,
}: {
  jobId: string;
}) {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function generateResume() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `/api/jobs/${jobId}/resume`,
        {
          method: "POST",
        },
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
            "Failed to generate tailored resume.",
        );
      }

      router.push(`/jobs/${jobId}/resume`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to generate resume.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Button
        type="button"
        onClick={generateResume}
        disabled={loading}
      >
        {loading
          ? "Generating resume..."
          : "Generate tailored resume"}
      </Button>

      {error && (
        <p className="mt-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
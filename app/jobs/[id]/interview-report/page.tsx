import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function InterviewReportPage({
  params,
}: PageProps) {
  const { id } = await params;

  const supabase = await createClient();

  const { data: job } =
    await supabase
      .from("jobs")
      .select(
        "id, title, company_name",
      )
      .eq("id", id)
      .single();

  if (!job) {
    notFound();
  }

  const {
    data: session,
  } = await supabase
    .from("interview_sessions")
    .select(
      "id, status, created_at, overall_score",
    )
    .eq("job_id", id)
    .not("overall_score", "is", null)
    .order("created_at", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (session) {
    redirect(
      `/jobs/${id}/mock-interview/${session.id}/summary`,
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f2ea] text-[#321e24]">
      <div className="mx-auto max-w-4xl px-6 py-16">
        <div className="rounded-3xl border border-[#dfd0c3] bg-[#fffaf4] p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#6b1f2a]">
            Interview Report
          </p>

          <h1 className="mt-3 text-4xl font-semibold">
            No completed report yet
          </h1>

          <p className="mt-4 max-w-2xl text-[#7c6068]">
            Complete or end a mock interview first.
            The report will be generated automatically
            from your saved answers.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href={`/jobs/${id}/mock-interview`}
              className="rounded-full bg-[#6b1f2a] px-5 py-2.5 text-sm font-semibold text-white"
            >
              Start Mock Interview →
            </Link>

            <Link
              href={`/jobs/${id}/interview-questions`}
              className="rounded-full border border-[#d8c5ba] bg-white px-5 py-2.5 text-sm font-semibold"
            >
              Question Bank
            </Link>

            <Link
              href={`/jobs/${id}`}
              className="rounded-full border border-[#d8c5ba] bg-white px-5 py-2.5 text-sm font-semibold"
            >
              Job Overview
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

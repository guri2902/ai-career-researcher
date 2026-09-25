import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type SkillGap = {
  required_skill: string;
  requirement_type:
    | "must_have"
    | "nice_to_have";
  match_status:
    | "matched"
    | "partial"
    | "missing";
  candidate_skill: string | null;
  match_score: number;
  gap_type:
    | "blocking"
    | "minor"
    | null;
  covered_by_parent_requirement: boolean;
};

export default async function SkillGapsPage({
  params,
}: PageProps) {
  const { id } = await params;

  const supabase = await createClient();

  const { data: job } = await supabase
    .from("jobs")
    .select(
      "id, title, company_name, readiness_score",
    )
    .eq("id", id)
    .single();

  if (!job) {
    notFound();
  }

  const { data: rows } =
    await supabase
      .from("skill_gaps")
      .select("*")
      .eq("job_id", id)
      .order(
        "requirement_type",
        { ascending: true },
      )
      .order(
        "match_status",
        { ascending: true },
      );

  const gaps =
    (rows ?? []) as SkillGap[];

  const blocking = gaps.filter(
    (gap) =>
      gap.gap_type === "blocking" &&
      gap.match_status !== "matched" &&
      !gap.covered_by_parent_requirement,
  );

  const matched = gaps.filter(
    (gap) =>
      gap.match_status === "matched" &&
      !gap.covered_by_parent_requirement,
  );

  const partial = gaps.filter(
    (gap) =>
      gap.match_status === "partial",
  );

  const missing = gaps.filter(
    (gap) =>
      gap.match_status === "missing",
  );

  return (
    <main className="min-h-screen bg-[#f7f2ea] text-[#321e24]">
      <div className="mx-auto max-w-7xl px-6 py-10 lg:px-8">
        <Link
          href={`/jobs/${id}`}
          className="text-sm text-[#7c6068] hover:text-[#6b1f2a]"
        >
          ← Back to Job
        </Link>

        <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#6b1f2a]">
              Skill Gap Analysis
            </p>

            <h1 className="mt-2 text-4xl font-semibold tracking-tight">
              Where you stand
            </h1>

            <p className="mt-2 text-lg text-[#7c6068]">
              {job.title} ·{" "}
              {job.company_name}
            </p>
          </div>

          <div className="rounded-3xl border border-[#dfd0c3] bg-[#fffaf4] px-6 py-5">
            <p className="text-xs uppercase tracking-[0.15em] text-[#8a7478]">
              Readiness
            </p>
            <p className="mt-1 text-3xl font-semibold text-[#6b1f2a]">
              {job.readiness_score ?? 0}%
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-4">
          <Stat
            label="Blocking gaps"
            value={blocking.length}
          />
          <Stat
            label="Missing"
            value={missing.length}
          />
          <Stat
            label="Partial"
            value={partial.length}
          />
          <Stat
            label="Matched"
            value={matched.length}
          />
        </div>

        <div className="mt-8 rounded-3xl border border-[#dfd0c3] bg-[#fffaf4] p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#6b1f2a]">
                Priority gaps
              </p>

              <h2 className="mt-2 text-2xl font-semibold">
                Skills to work on first
              </h2>
            </div>

            <Link
              href={`/jobs/${id}/skill-profile`}
              className="text-sm font-semibold text-[#6b1f2a]"
            >
              Unified Skill Profile →
            </Link>
          </div>

          <div className="mt-5 space-y-3">
            {blocking.length === 0 ? (
              <p className="rounded-2xl bg-[#edf4ea] p-5 text-sm text-[#50624d]">
                No blocking skill gaps currently identified.
              </p>
            ) : (
              blocking.map((gap) => (
                <GapRow
                  key={
                    gap.required_skill
                  }
                  gap={gap}
                  priority
                />
              ))
            )}
          </div>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-3">
          <GapGroup
            title="Missing"
            description="Required skills not currently evidenced in your profile."
            items={missing}
          />

          <GapGroup
            title="Partial"
            description="You have some evidence, but the match is incomplete."
            items={partial}
          />

          <GapGroup
            title="Matched"
            description="Skills currently supported by your profile."
            items={matched}
          />
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={`/jobs/${id}/projects`}
            className="rounded-full bg-[#6b1f2a] px-5 py-2.5 text-sm font-semibold text-white"
          >
            Build Projects →
          </Link>

          <Link
            href={`/jobs/${id}/mock-interview`}
            className="rounded-full bg-[#321e24] px-5 py-2.5 text-sm font-semibold text-white"
          >
            Practice Interview →
          </Link>

          <Link
            href={`/jobs/${id}/resume`}
            className="rounded-full border border-[#d8c5ba] bg-white px-5 py-2.5 text-sm font-semibold"
          >
            Tailor Resume
          </Link>
        </div>
      </div>
    </main>
  );
}

function GapGroup({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: SkillGap[];
}) {
  return (
    <section className="rounded-3xl border border-[#dfd0c3] bg-[#fffaf4] p-6">
      <h2 className="text-xl font-semibold">
        {title}
      </h2>

      <p className="mt-2 text-sm leading-6 text-[#806a72]">
        {description}
      </p>

      <div className="mt-5 space-y-3">
        {items.length === 0 ? (
          <p className="rounded-2xl bg-[#f6eee6] p-4 text-sm text-[#806a72]">
            None.
          </p>
        ) : (
          items.map((gap) => (
            <GapRow
              key={gap.required_skill}
              gap={gap}
            />
          ))
        )}
      </div>
    </section>
  );
}

function GapRow({
  gap,
  priority = false,
}: {
  gap: SkillGap;
  priority?: boolean;
}) {
  const label =
    gap.match_status === "matched"
      ? "Matched"
      : gap.match_status === "partial"
        ? "Partial"
        : "Missing";

  const statusClass =
    gap.match_status ===
    "matched"
      ? "bg-[#edf4ea] text-[#50624d]"
      : gap.match_status ===
          "partial"
        ? "bg-[#f5f0df] text-[#765c32]"
        : "bg-[#fff1ed] text-[#8a2d32]";

  return (
    <div
      className={`flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between ${
        priority
          ? "border-[#e6c9bd] bg-[#fff7f3]"
          : "border-[#e6ddd3] bg-white"
      }`}
    >
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold">
            {gap.required_skill}
          </p>

          <span className="rounded-full bg-[#f0e8df] px-2.5 py-1 text-[11px] font-medium">
            {gap.requirement_type ===
            "must_have"
              ? "Must-have"
              : "Nice-to-have"}
          </span>
        </div>

        <p className="mt-1 text-xs text-[#8a7478]">
          Match score:{" "}
          {Number(
            gap.match_score ?? 0,
          ).toFixed(0)}
          %
          {gap.candidate_skill
            ? ` · Candidate evidence: ${gap.candidate_skill}`
            : ""}
        </p>
      </div>

      <span
        className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${statusClass}`}
      >
        {label}
      </span>
    </div>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-[#dfd0c3] bg-[#fffaf4] p-5">
      <p className="text-xs uppercase tracking-[0.12em] text-[#8a7478]">
        {label}
      </p>

      <p className="mt-2 text-2xl font-semibold">
        {value}
      </p>
    </div>
  );
}

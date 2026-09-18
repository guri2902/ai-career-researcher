import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { GenerateResumeButton } from "@/components/generate-resume-button";
type JobPageProps = {
  params: Promise<{
    id: string;
  }>;
};

type SkillGap = {
  id: string;
  required_skill: string;
  requirement_type: "must_have" | "nice_to_have";
  match_status: "matched" | "partial" | "missing";
  candidate_skill: string | null;
  gap_type: "blocking" | "minor" | null;
  match_score: number;
  covered_by_parent_requirement: boolean;
};

export default async function JobPage({
  params,
}: JobPageProps) {
  const { id } = await params;

  const supabase = await createClient();

  // ─────────────────────────────────────────
  // Load job
  // ─────────────────────────────────────────

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", id)
    .single();

  if (jobError || !job) {
    notFound();
  }

  // ─────────────────────────────────────────
  // Load requirements
  // ─────────────────────────────────────────

  const { data: requirements } = await supabase
    .from("requirements")
    .select("*")
    .eq("job_id", id)
    .single();

  // ─────────────────────────────────────────
  // Load skill gaps
  // ─────────────────────────────────────────

  const { data: skillGaps } = await supabase
    .from("skill_gaps")
    .select("*")
    .eq("job_id", id)
    .order("requirement_type", {
      ascending: true,
    });

  const gaps: SkillGap[] = skillGaps ?? [];

  const matched = gaps.filter(
    (gap) =>
        gap.match_status === "matched" &&
        !gap.covered_by_parent_requirement,
    );

    const coveredByParent = gaps.filter(
    (gap) => gap.covered_by_parent_requirement,
    );

  const partial = gaps.filter(
    (gap) => gap.match_status === "partial",
  );

  const blocking = gaps.filter(
    (gap) => gap.gap_type === "blocking",
  );

  const minor = gaps.filter(
    (gap) => gap.gap_type === "minor",
  );

  const readinessScore = job.readiness_score ?? 0;

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-6 py-12 lg:px-8">
        {/* Header */}
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
              Job Analysis
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

          <Link href="/dashboard">
            <Button variant="outline">
              Back to Dashboard
            </Button>
          </Link>
        </div>

        {/* Readiness overview */}
        <section className="mt-10 grid gap-4 lg:grid-cols-4">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm lg:col-span-2">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Skill readiness
                </p>

                <p className="mt-2 text-5xl font-semibold tracking-tight text-secondary">
                  {readinessScore}%
                </p>
              </div>

              <span className="rounded-full bg-[#efe5d5] px-3 py-1.5 text-xs font-medium text-primary">
                Skill match
              </span>
            </div>

            <div className="mt-6 h-3 overflow-hidden rounded-full bg-[#e5d9ca]">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{
                  width: `${Math.min(
                    Math.max(readinessScore, 0),
                    100,
                  )}%`,
                }}
              />
            </div>

            <p className="mt-3 text-sm text-muted-foreground">
              This score currently reflects skill matching only.
              Resume quality, experience, and interview performance
              will be added in later phases.
            </p>
          </div>

          <StatCard
            label="Matched"
            value={matched.length}
            description="Requirements covered"
          />

          <StatCard
            label="Blocking gaps"
            value={blocking.length}
            description="Must-have gaps"
          />
        </section>

        <section className="mt-4 grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Partial matches"
            value={partial.length}
            description="Needs stronger evidence"
          />

          <StatCard
            label="Minor gaps"
            value={minor.length}
            description="Nice-to-have gaps"
          />

          <StatCard
            label="Experience"
            value={
              requirements?.years_experience ||
              "Not specified"
            }
            description="From the job description"
          />
        </section>

        {/* Main analysis */}
        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          {/* Gaps */}
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm lg:col-span-2">
            <div>
              <h2 className="text-2xl font-semibold text-secondary">
                Skill gap analysis
              </h2>

              <p className="mt-2 text-muted-foreground">
                See what the role requires versus what your current
                profile demonstrates.
              </p>
            </div>

            {/* Blocking */}
            <GapSection
              title="Blocking gaps"
              description="Must-have requirements where your profile does not currently provide enough evidence."
              gaps={blocking}
              type="blocking"
            />

            {/* Partial */}
            <GapSection
              title="Partial matches"
              description="Related evidence exists, but the match is not strong enough to count as fully covered."
              gaps={partial}
              type="partial"
            />

            {/* Minor */}
            <GapSection
              title="Minor gaps"
              description="Nice-to-have requirements that are not currently covered."
              gaps={minor}
              type="minor"
            />

            {/* Matched */}
            <div className="mt-10 border-t border-border pt-8">
              <h3 className="text-lg font-semibold text-secondary">
                Matched requirements
              </h3>
            
            {coveredByParent.length > 0 && (
                <div className="mt-8 border-t border-border pt-8">
                    <h3 className="text-lg font-semibold text-secondary">
                    Covered by broader skills
                    </h3>

                    <p className="mt-2 text-sm text-muted-foreground">
                    These broader requirements are satisfied through a more
                    specific skill in your profile.
                    </p>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {coveredByParent.map((gap) => (
                        <div
                        key={gap.id}
                        className="rounded-xl border border-border bg-background p-4"
                        >
                        <p className="font-medium text-secondary">
                            {gap.required_skill}
                        </p>

                        <p className="mt-1 text-xs text-muted-foreground">
                            Covered by {gap.candidate_skill || "a specific skill"}
                        </p>
                        </div>
                    ))}
                    </div>
                </div>
                )}

              <p className="mt-2 text-sm text-muted-foreground">
                Requirements already supported by your current
                profile.
              </p>

              {matched.length === 0 ? (
                <p className="mt-5 text-sm text-muted-foreground">
                  No complete matches yet.
                </p>
              ) : (
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {matched.map((gap) => (
                    <MatchedSkill key={gap.id} gap={gap} />
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Requirements */}
          <aside className="space-y-6">
            <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-secondary">
                Job requirements
              </h2>

              <RequirementGroup
                title="Must have"
                items={requirements?.must_have_skills ?? []}
              />

              <RequirementGroup
                title="Nice to have"
                items={requirements?.nice_to_have_skills ?? []}
              />

              <RequirementGroup
                title="Tools"
                items={requirements?.tools ?? []}
              />

              <RequirementGroup
                title="Soft skills"
                items={requirements?.soft_skills ?? []}
              />
            </section>

            <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <p className="text-sm font-medium text-muted-foreground">
                Seniority
              </p>

              <p className="mt-2 text-2xl font-semibold text-secondary">
                {requirements?.seniority_level ||
                  "Not specified"}
              </p>
            </section>

            {requirements?.ambiguous_requirements?.length > 0 && (
              <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-secondary">
                  Needs clarification
                </h2>

                <ul className="mt-4 space-y-3">
                  {requirements.ambiguous_requirements.map(
                    (item: string) => (
                      <li
                        key={item}
                        className="rounded-lg bg-background p-3 text-sm leading-6 text-muted-foreground"
                      >
                        {item}
                      </li>
                    ),
                  )}
                </ul>
              </section>
            )}
          </aside>
        </div>

        {/* Next phases */}
        <section className="mt-8 rounded-2xl border border-border bg-secondary p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#b85c6b]">
            Coming next
          </p>

          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#f7f2ea]">
            Turn these gaps into a preparation plan.
          </h2>

          <p className="mt-3 max-w-2xl leading-7 text-[#cdbfb2]">
            Resume tailoring, targeted portfolio projects, and
            interview preparation will use these exact gaps in the
            next phases.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <GenerateResumeButton jobId={job.id} />

            {job && (
            <Link href={`/jobs/${job.id}/resume`}>
                <Button variant="outline">
                View current resume
                </Button>
            </Link>
            )}
            <Link href={`/jobs/${job.id}/projects`}>
              <Button variant="outline">
                Projects to Build
              </Button>
            </Link>
            <PhasePill label="Interview questions" />
          </div>
        </section>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  description,
}: {
  label: string;
  value: number | string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <p className="text-sm font-medium text-muted-foreground">
        {label}
      </p>

      <p className="mt-2 text-3xl font-semibold text-secondary">
        {value}
      </p>

      <p className="mt-1 text-xs text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function GapSection({
  title,
  description,
  gaps,
  type,
}: {
  title: string;
  description: string;
  gaps: SkillGap[];
  type: "blocking" | "partial" | "minor";
}) {
  return (
    <div className="mt-8">
      <h3 className="text-lg font-semibold text-secondary">
        {title}
      </h3>

      <p className="mt-1 text-sm text-muted-foreground">
        {description}
      </p>

      {gaps.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-border bg-background p-5 text-sm text-muted-foreground">
          No {type === "blocking" ? "blocking " : ""}gaps in this
          category.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {gaps.map((gap) => (
            <GapRow key={gap.id} gap={gap} type={type} />
          ))}
        </div>
      )}
    </div>
  );
}

function GapRow({
  gap,
  type,
}: {
  gap: SkillGap;
  type: "blocking" | "partial" | "minor";
}) {
  const icon =
    type === "blocking"
      ? "×"
      : type === "partial"
        ? "!"
        : "○";

  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-border bg-background p-4">
      <div className="flex min-w-0 items-start gap-3">
        <span
          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
            type === "blocking"
              ? "bg-[#6b1f2a] text-[#f7f2ea]"
              : type === "partial"
                ? "bg-[#b18a54] text-[#fffaf3]"
                : "bg-[#d8c7b0] text-[#3a2a24]"
          }`}
        >
          {icon}
        </span>

        <div className="min-w-0">
          <p className="font-medium text-secondary">
            {gap.required_skill}
          </p>

          {gap.candidate_skill && (
            <p className="mt-1 text-xs text-muted-foreground">
              Candidate evidence: {gap.candidate_skill}
            </p>
          )}
        </div>
      </div>

      <span className="shrink-0 text-xs font-medium text-muted-foreground">
        {gap.requirement_type === "must_have"
          ? "Must have"
          : "Nice to have"}
      </span>
    </div>
  );
}

function MatchedSkill({
  gap,
}: {
  gap: SkillGap;
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#172a3a] text-xs font-semibold text-[#f7f2ea]">
          ✓
        </span>

        <div>
          <p className="font-medium text-secondary">
            {gap.required_skill}
          </p>

          {gap.candidate_skill && (
            <p className="mt-1 text-xs text-muted-foreground">
              Matched by {gap.candidate_skill}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function RequirementGroup({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <div className="mt-7">
      <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
        {title}
      </h3>

      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          None identified.
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {items.map((item) => (
            <span
              key={item}
              className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-secondary"
            >
              {item}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function PhasePill({
  label,
}: {
  label: string;
}) {
  return (
    <span className="rounded-full border border-[#536574] bg-[#172a3a] px-4 py-2 text-sm text-[#f7f2ea]">
      {label}
    </span>
  );
}
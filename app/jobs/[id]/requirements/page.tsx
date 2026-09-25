import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type Requirements = {
  must_have_skills: string[];
  nice_to_have_skills: string[];
  years_experience: string | null;
  tools: string[];
  soft_skills: string[];
  seniority_level: string | null;
  ambiguous_requirements: string[];
};

export default async function RequirementsPage({
  params,
}: PageProps) {
  const { id } = await params;

  const supabase = await createClient();

  const { data: job } = await supabase
    .from("jobs")
    .select(
      "id, title, company_name",
    )
    .eq("id", id)
    .single();

  if (!job) {
    notFound();
  }

  const { data: requirements } =
    await supabase
      .from("requirements")
      .select("*")
      .eq("job_id", id)
      .maybeSingle();

  const data =
    (requirements ??
      null) as Requirements | null;

  return (
    <main className="min-h-screen bg-[#f7f2ea] text-[#321e24]">
      <div className="mx-auto max-w-6xl px-6 py-10 lg:px-8">
        <Link
          href={`/jobs/${id}`}
          className="text-sm text-[#7c6068] hover:text-[#6b1f2a]"
        >
          ← Back to Job
        </Link>

        <div className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#6b1f2a]">
            Requirements
          </p>

          <h1 className="mt-2 text-4xl font-semibold tracking-tight">
            {job.title}
          </h1>

          <p className="mt-2 text-lg text-[#7c6068]">
            {job.company_name}
          </p>
        </div>

        {!data ? (
          <div className="mt-8 rounded-3xl border border-[#dfd0c3] bg-[#fffaf4] p-8">
            <h2 className="text-xl font-semibold">
              Requirements have not been extracted yet.
            </h2>

            <p className="mt-2 text-sm leading-6 text-[#806a72]">
              Run job analysis first. The extracted
              requirements will appear here.
            </p>

            <Link
              href={`/jobs/${id}`}
              className="mt-5 inline-flex rounded-full bg-[#6b1f2a] px-5 py-2.5 text-sm font-semibold text-white"
            >
              Open Job Analysis
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            <Section
              title="Must-have skills"
              items={data.must_have_skills}
              tone="required"
            />

            <Section
              title="Nice-to-have skills"
              items={data.nice_to_have_skills}
              tone="optional"
            />

            <Section
              title="Tools & technologies"
              items={data.tools}
            />

            <div className="rounded-3xl border border-[#dfd0c3] bg-[#fffaf4] p-7">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#6b1f2a]">
                Role details
              </p>

              <div className="mt-5 space-y-4">
                <Detail
                  label="Experience"
                  value={
                    data.years_experience ||
                    "Not specified"
                  }
                />

                <Detail
                  label="Seniority"
                  value={
                    data.seniority_level ||
                    "Not specified"
                  }
                />
              </div>
            </div>

            <Section
              title="Soft skills"
              items={data.soft_skills}
            />

            <Section
              title="Ambiguous requirements"
              items={
                data.ambiguous_requirements
              }
              tone="warning"
            />
          </div>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={`/jobs/${id}/skill-gaps`}
            className="rounded-full bg-[#321e24] px-5 py-2.5 text-sm font-semibold text-white"
          >
            View Skill Gaps →
          </Link>

          <Link
            href={`/jobs/${id}/resume`}
            className="rounded-full border border-[#d8c5ba] bg-white px-5 py-2.5 text-sm font-semibold"
          >
            Tailor Resume
          </Link>

          <Link
            href={`/jobs/${id}/interview-questions`}
            className="rounded-full border border-[#d8c5ba] bg-white px-5 py-2.5 text-sm font-semibold"
          >
            Question Bank
          </Link>
        </div>
      </div>
    </main>
  );
}

function Section({
  title,
  items,
  tone = "default",
}: {
  title: string;
  items: string[];
  tone?: "required" | "optional" | "warning" | "default";
}) {
  const tones = {
    required:
      "border-[#e6c9bd] bg-[#fff7f3]",
    optional:
      "border-[#e3d6be] bg-[#fbf7ef]",
    warning:
      "border-[#e6c9bd] bg-[#fff2ed]",
    default:
      "border-[#dfd0c3] bg-[#fffaf4]",
  };

  return (
    <section
      className={`rounded-3xl border p-7 ${tones[tone]}`}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#6b1f2a]">
        {title}
      </p>

      {items?.length ? (
        <div className="mt-5 flex flex-wrap gap-2">
          {items.map((item) => (
            <span
              key={item}
              className="rounded-full border border-[#ded2c8] bg-white px-3 py-1.5 text-sm"
            >
              {item}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-[#806a72]">
          None extracted.
        </p>
      )}
    </section>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-[#f6eee6] p-4">
      <p className="text-xs uppercase tracking-[0.12em] text-[#8a7478]">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium">
        {value}
      </p>
    </div>
  );
}

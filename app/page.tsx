import Link from "next/link";

const steps = [
  {
    number: "01",
    title: "Analyze the job",
    description:
      "Turn a job description into a structured map of skills, tools, experience, and expectations.",
  },
  {
    number: "02",
    title: "Find your gaps",
    description:
      "See exactly where your current experience matches the role and where you need to improve.",
  },
  {
    number: "03",
    title: "Prepare smarter",
    description:
      "Build a tailored resume, targeted projects, and interview questions designed around the role.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-7xl px-6 pb-20 pt-20 lg:px-8 lg:pb-28 lg:pt-24">
          <div className="max-w-4xl">
            <div className="mb-6 inline-flex rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-primary">
              Research. Prepare. Interview. Get hired.
            </div>

            <h1 className="max-w-4xl text-5xl font-semibold leading-[1.05] tracking-tight text-secondary sm:text-6xl lg:text-7xl">
              Stop applying blindly.
              <span className="block text-primary">
                Start preparing intelligently.
              </span>
            </h1>

            <p className="mt-7 max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl">
              AI Career Researcher turns a job description into a
              personalized career preparation plan — from skill gaps and
              resume tailoring to projects and interview practice.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/jobs/new"
                className="inline-flex h-12 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Analyze your first job
                <span className="ml-2">→</span>
              </Link>

              <Link
                href="/jobs"
                className="inline-flex h-12 items-center justify-center rounded-md border border-border bg-card px-6 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                View jobs
              </Link>
            </div>
          </div>

          {/* Pipeline */}
          <div className="mt-20 grid overflow-hidden rounded-2xl border border-border bg-card shadow-sm lg:grid-cols-6">
            {[
              "Job",
              "Requirements",
              "Skill Gaps",
              "Resume",
              "Projects",
              "Interview",
            ].map((item, index) => (
              <div
                key={item}
                className="relative flex items-center justify-center border-b border-border px-5 py-7 text-center last:border-b-0 lg:border-b-0 lg:border-r lg:last:border-r-0"
              >
                <div>
                  <div className="mb-2 text-xs font-semibold tracking-[0.2em] text-primary">
                    {String(index + 1).padStart(2, "0")}
                  </div>

                  <div className="font-medium text-secondary">{item}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-border/60 bg-[#efe5d5]">
        <div className="mx-auto max-w-7xl px-6 py-24 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
              How it works
            </p>

            <h2 className="mt-4 text-4xl font-semibold tracking-tight text-secondary sm:text-5xl">
              One job. One preparation plan.
            </h2>

            <p className="mt-5 text-lg leading-8 text-muted-foreground">
              Instead of sending the same resume everywhere, understand what
              each role actually expects and prepare specifically for it.
            </p>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {steps.map((step) => (
              <div
                key={step.number}
                className="rounded-2xl border border-border bg-card p-7"
              >
                <div className="text-sm font-semibold tracking-[0.2em] text-primary">
                  {step.number}
                </div>

                <h3 className="mt-6 text-xl font-semibold text-secondary">
                  {step.title}
                </h3>

                <p className="mt-3 leading-7 text-muted-foreground">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-secondary">
        <div className="mx-auto max-w-7xl px-6 py-20 text-center lg:px-8">
          <h2 className="text-4xl font-semibold tracking-tight text-[#f7f2ea] sm:text-5xl">
            Your next application should be your best-prepared one.
          </h2>

          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-[#cdbfb2]">
            Start with one job description and let the system show you exactly
            what to do next.
          </p>

          <div className="mt-8">
            <Link
              href="/jobs/new"
              className="inline-flex h-12 items-center justify-center rounded-md bg-[#f7f2ea] px-6 text-sm font-medium text-[#6b1f2a] transition-colors hover:bg-[#efe5d5]"
            >
              Analyze a Job →
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
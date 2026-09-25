"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const primaryLinks = [
  {
    href: "/",
    label: "Dashboard",
  },
  {
    href: "/jobs",
    label: "Jobs",
  },
  {
    href: "/jobs/new",
    label: "Add Job",
  },
  {
    href: "/settings",
    label: "Settings",
  },
];

export default function AppNav() {
  const pathname = usePathname();

  const jobMatch = pathname.match(
    /^\/jobs\/([^/]+)/,
  );

  const jobId =
    jobMatch?.[1] &&
    jobMatch[1] !== "new"
      ? jobMatch[1]
      : null;

  return (
    <header className="sticky top-0 z-50 border-b border-[#ddd4ca] bg-[#f7f2ea]/95 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-[70px] items-center gap-4">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-3"
          >
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#6b1f2a] text-xs font-bold text-white shadow-sm">
              RP
            </span>
            <span className="hidden text-[15px] font-semibold tracking-[-0.02em] text-[#321e24] sm:block">
              Role Pilot
            </span>
          </Link>

          <nav className="ml-3 hidden items-center gap-1 md:flex">
            {primaryLinks.map((link) => {
              const active =
                link.href === "/"
                  ? pathname === "/"
                  : pathname === link.href ||
                    pathname.startsWith(
                      `${link.href}/`,
                    );

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={[
                    "inline-flex h-10 items-center rounded-full px-4 text-sm font-medium transition-all",
                    active
                      ? "bg-[#321e24] text-white shadow-sm"
                      : "text-[#6f5b60] hover:bg-white hover:text-[#321e24]",
                  ].join(" ")}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-xs text-[#8a7478] lg:inline">
              Career workspace
            </span>

            <Link
              href="/settings"
              className="grid h-10 w-10 place-items-center rounded-full border border-[#d9c9bd] bg-white text-xs font-semibold text-[#6b1f2a] shadow-sm transition hover:bg-[#faf7f2]"
              title="Settings"
            >
              GS
            </Link>
          </div>
        </div>

        <div className="overflow-x-auto pb-2 md:hidden">
          <nav className="flex w-max items-center gap-2">
            {primaryLinks.map((link) => {
              const active =
                link.href === "/"
                  ? pathname === "/"
                  : pathname === link.href ||
                    pathname.startsWith(
                      `${link.href}/`,
                    );

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={[
                    "inline-flex h-9 items-center rounded-full border px-4 text-sm font-medium transition",
                    active
                      ? "border-[#321e24] bg-[#321e24] text-white"
                      : "border-[#ded2c8] bg-white text-[#6f5b60]",
                  ].join(" ")}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {jobId && (
          <div className="border-t border-[#e5ddd5] py-2">
            <div className="overflow-x-auto">
              <nav className="flex w-max items-center gap-2">
                <Link
                  href="/jobs"
                  className="mr-1 inline-flex h-9 shrink-0 items-center rounded-full border border-[#ded2c8] bg-white px-4 text-sm font-medium text-[#6f5b60] transition hover:bg-[#f0e8df] hover:text-[#321e24]"
                >
                  ← Jobs
                </Link>

                <div className="h-5 w-px bg-[#ddd4ca]" />

                <JobNavButton
                  href={`/jobs/${jobId}`}
                  label="Overview"
                  active={
                    pathname === `/jobs/${jobId}`
                  }
                />

                <JobNavButton
                  href={`/jobs/${jobId}/requirements`}
                  label="Requirements"
                  active={
                    pathname ===
                      `/jobs/${jobId}/requirements` ||
                    pathname.startsWith(
                      `/jobs/${jobId}/requirements/`,
                    )
                  }
                />

                <JobNavButton
                  href={`/jobs/${jobId}/skill-gaps`}
                  label="Skill Gaps"
                  active={
                    pathname ===
                      `/jobs/${jobId}/skill-gaps` ||
                    pathname.startsWith(
                      `/jobs/${jobId}/skill-gaps/`,
                    )
                  }
                />

                <JobNavButton
                  href={`/jobs/${jobId}/resume`}
                  label="Resume"
                  active={
                    pathname ===
                      `/jobs/${jobId}/resume` ||
                    pathname.startsWith(
                      `/jobs/${jobId}/resume/`,
                    )
                  }
                />

                <JobNavButton
                  href={`/jobs/${jobId}/projects`}
                  label="Projects"
                  active={
                    pathname ===
                      `/jobs/${jobId}/projects` ||
                    pathname.startsWith(
                      `/jobs/${jobId}/projects/`,
                    )
                  }
                />

                <JobNavButton
                  href={`/jobs/${jobId}/interview-questions`}
                  label="Question Bank"
                  active={
                    pathname ===
                      `/jobs/${jobId}/interview-questions` ||
                    pathname.startsWith(
                      `/jobs/${jobId}/interview-questions/`,
                    )
                  }
                />

                <JobNavButton
                  href={`/jobs/${jobId}/mock-interview`}
                  label="Mock Interview"
                  active={
                    pathname ===
                      `/jobs/${jobId}/mock-interview` ||
                    pathname.startsWith(
                      `/jobs/${jobId}/mock-interview/`,
                    )
                  }
                  accent
                />

                <JobNavButton
                  href={`/jobs/${jobId}/interview-report`}
                  label="Interview Report"
                  active={
                    pathname ===
                      `/jobs/${jobId}/interview-report` ||
                    pathname.startsWith(
                      `/jobs/${jobId}/interview-report/`,
                    )
                  }
                />

                <JobNavButton
                  href={`/jobs/${jobId}/skill-profile`}
                  label="Skill Profile"
                  active={
                    pathname ===
                      `/jobs/${jobId}/skill-profile` ||
                    pathname.startsWith(
                      `/jobs/${jobId}/skill-profile/`,
                    )
                  }
                />
              </nav>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

function JobNavButton({
  href,
  label,
  active,
  accent = false,
}: {
  href: string;
  label: string;
  active: boolean;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      className={[
        "inline-flex h-9 shrink-0 items-center rounded-full px-4 text-sm font-medium transition-all",
        active
          ? accent
            ? "bg-[#6b1f2a] text-white shadow-sm"
            : "bg-[#321e24] text-white shadow-sm"
          : "border border-[#ded2c8] bg-white text-[#6f5b60] hover:bg-[#f7f2ea] hover:text-[#321e24]",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

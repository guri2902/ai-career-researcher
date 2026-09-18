"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const MAIN_NAV = [
  {
    label: "Dashboard",
    href: "/",
  },
  {
    label: "Jobs",
    href: "/jobs",
  },
  {
    label: "New Job",
    href: "/jobs/new",
  },
  {
    label: "Profile",
    href: "/settings",
  },
];

export default function AppNav() {
  const pathname = usePathname();
  const router = useRouter();

  const parts = pathname.split("/").filter(Boolean);

  const isJobRoute =
    parts[0] === "jobs" &&
    parts.length >= 2 &&
    parts[1] !== "new";

  const jobId = isJobRoute ? parts[1] : null;

  const jobBase = jobId ? `/jobs/${jobId}` : null;

  const jobNav = jobBase
    ? [
        {
          label: "Overview",
          href: jobBase,
        },
        {
          label: "Resume",
          href: `${jobBase}/resume`,
        },
        {
          label: "Projects",
          href: `${jobBase}/projects`,
        },
        {
          label: "Interview",
          href: `${jobBase}/interview-questions`,
        },
      ]
    : [];

  function isMainActive(href: string) {
    if (href === "/") {
      return pathname === "/";
    }

    if (href === "/jobs") {
      return pathname === "/jobs" || pathname.startsWith("/jobs/");
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function isJobActive(href: string) {
    if (!pathname || !href) {
      return false;
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
      {/* Main navigation */}
      <div className="mx-auto flex min-h-16 max-w-7xl items-center gap-6 px-6">
        <Link
          href="/"
          className="shrink-0 text-lg font-semibold tracking-tight text-secondary"
        >
          AI Career Researcher
        </Link>

        <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {MAIN_NAV.map((item) => {
            const active = isMainActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-secondary text-[#f7f2ea]"
                    : "text-muted-foreground hover:bg-muted hover:text-secondary"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Job-specific navigation */}
      {jobId && jobBase && (
        <div className="border-t border-border bg-card/60">
          <div className="mx-auto flex min-h-12 max-w-7xl items-center gap-2 overflow-x-auto px-6">
            <button
              type="button"
              onClick={() => router.back()}
              className="mr-2 whitespace-nowrap rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-secondary"
            >
              ← Back
            </button>

            {jobNav.map((item) => {
              const active = isJobActive(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    active
                      ? "bg-secondary text-[#f7f2ea]"
                      : "text-muted-foreground hover:bg-muted hover:text-secondary"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
}
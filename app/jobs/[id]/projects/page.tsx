"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { Button } from "@/components/ui/button";

type Project = {
  id: string;

  title: string;

  problem_statement: string;

  why_this_project: string;

  difficulty: string;

  estimated_weeks: number;

  target_skills: string[];

  tech_stack: string[];

  features: string[];

  implementation_steps: string[];

  deliverables: string[];

  architecture: string;

  github_structure: string;

  interview_value: string;

  status: string;
};

type Job = {
  id: string;

  title: string;

  company_name: string;
};

type SkillGapMatch = {
  requiredSkill: string;

  canonicalSkill?: string;

  requirementType:
    | "must_have"
    | "nice_to_have";

  matchStatus:
    | "matched"
    | "partial"
    | "missing";

  candidateSkill:
    | string
    | null;

  gapType:
    | "blocking"
    | "minor"
    | null;

  matchScore: number;

  coveredByParentRequirement?: boolean;
};

type InterviewPerformance = {
  skill_name: string;

  question_count: number;

  average_score: number;

  performance_level:
    | "strong"
    | "developing"
    | "weak"
    | "insufficient";
};

type ProjectPriority = {
  score: number;

  priority:
    | "high"
    | "medium"
    | "low";

  matchedSkills: string[];

  reasons: string[];

  highPrioritySkills: string[];
};

function normalizeSkill(
  value: string,
): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "");
}

function getSkillAliases(
  skill: string,
): string[] {
  const normalized =
    normalizeSkill(skill);

  const aliases =
    new Set<string>([
      normalized,
    ]);

  if (
    normalized === "node" ||
    normalized === "nodejs" ||
    normalized === "nodejsjavascript"
  ) {
    aliases.add("nodejs");
  }

  if (
    normalized === "k8s" ||
    normalized === "kubernetes"
  ) {
    aliases.add("kubernetes");
  }

  if (
    normalized === "postgres" ||
    normalized === "postgresql"
  ) {
    aliases.add("postgresql");
  }

  if (
    normalized === "js" ||
    normalized === "javascript"
  ) {
    aliases.add("javascript");
  }

  if (
    normalized === "ts" ||
    normalized === "typescript"
  ) {
    aliases.add("typescript");
  }

  if (
    normalized === "reactjs" ||
    normalized === "react"
  ) {
    aliases.add("react");
  }

  if (
    normalized === "nextjs" ||
    normalized === "next"
  ) {
    aliases.add("nextjs");
  }

  if (
    normalized === "cicd" ||
    normalized === "continuousintegrationcontinuousdelivery"
  ) {
    aliases.add("cicd");
  }

  return Array.from(
    aliases,
  );
}

function findGapForSkill(
  skill: string,
  gaps: SkillGapMatch[],
): SkillGapMatch | null {
  const aliases =
    getSkillAliases(skill);

  for (const gap of gaps) {
    const gapAliases =
      getSkillAliases(
        gap.requiredSkill,
      );

    const matched =
      aliases.some((alias) =>
        gapAliases.includes(
          alias,
        ),
      );

    if (matched) {
      return gap;
    }
  }

  return null;
}

function calculateProjectPriority(
  project: Project,
  gaps: SkillGapMatch[],
  interviewData: InterviewPerformance[],
): ProjectPriority {
  if (
    project.target_skills.length === 0
  ) {
    return {
      score: 5,
      priority: "low",
      matchedSkills: [],
      reasons: [
        "This project has no target skills linked to the current job analysis.",
      ],
      highPrioritySkills: [],
    };
  }

  const performanceMap =
    new Map<
      string,
      InterviewPerformance
    >();

  for (const item of interviewData) {
    performanceMap.set(
      normalizeSkill(
        item.skill_name,
      ),
      item,
    );
  }

  const perSkillScores: number[] =
    [];

  const matchedSkills: string[] =
    [];

  const reasons: string[] =
    [];

  const highPrioritySkills: string[] =
    [];

  for (const skill of project.target_skills) {
    const gap =
      findGapForSkill(
        skill,
        gaps,
      );

    if (!gap) {
      continue;
    }

    matchedSkills.push(skill);

    let skillScore = 0;

    // Job importance
    if (
      gap.requirementType ===
      "must_have"
    ) {
      skillScore += 30;
    } else {
      skillScore += 10;
    }

    // Resume/profile gap
    if (
      gap.matchStatus ===
      "missing"
    ) {
      skillScore += 30;

      reasons.push(
        `${skill} is missing from the current profile`,
      );
    } else if (
      gap.matchStatus ===
      "partial"
    ) {
      skillScore += 15;

      reasons.push(
        `${skill} has only partial profile evidence`,
      );
    }

    // Blocking importance
    if (
      gap.gapType ===
      "blocking"
    ) {
      skillScore += 15;

      if (
        gap.requirementType ===
        "must_have"
      ) {
        highPrioritySkills.push(
          skill,
        );
      }
    } else if (
      gap.gapType ===
      "minor"
    ) {
      skillScore += 5;
    }

    // Interview evidence
    const performance =
      performanceMap.get(
        normalizeSkill(skill),
      );

    if (performance) {
      if (
        performance.performance_level ===
        "weak"
      ) {
        skillScore += 20;

        reasons.push(
          `${skill} was weak in interview performance`,
        );
      } else if (
        performance.performance_level ===
        "developing"
      ) {
        skillScore += 10;

        reasons.push(
          `${skill} is still developing in interview performance`,
        );
      }

      if (
        performance.question_count ===
        1
      ) {
        skillScore -= 3;
      }
    } else {
      // No interview evidence should not be treated
      // as a weakness; just give a small opportunity
      // bonus for building evidence.
      skillScore += 3;
    }

    // Covered parent requirements should not
    // receive the same weight as a real direct gap.
    if (
      gap.coveredByParentRequirement
    ) {
      skillScore -= 8;
    }

    perSkillScores.push(
      Math.max(
        0,
        Math.min(
          100,
          skillScore,
        ),
      ),
    );
  }

  if (
    perSkillScores.length === 0
  ) {
    return {
      score: 5,
      priority: "low",
      matchedSkills: [],
      reasons: [
        "No direct current skill gap matched this project's target skills.",
      ],
      highPrioritySkills: [],
    };
  }

  /*
   * Average the impact of each target skill.
   * This prevents projects with many gaps from
   * automatically becoming 100/100.
   */
  const averageScore =
    perSkillScores.reduce(
      (sum, value) =>
        sum + value,
      0,
    ) /
    perSkillScores.length;

  /*
   * Give projects that address multiple high-impact
   * gaps a controlled bonus.
   */
  const coverageBonus =
    Math.min(
      12,
      highPrioritySkills.length *
        4,
    );

  const finalScore = Math.round(
    Math.min(
      95,
      averageScore +
        coverageBonus,
    ),
  );

  let priority:
    | "high"
    | "medium"
    | "low";

  if (finalScore >= 70) {
    priority = "high";
  } else if (
    finalScore >= 45
  ) {
    priority = "medium";
  } else {
    priority = "low";
  }

  return {
    score: finalScore,

    priority,

    matchedSkills,

    reasons:
      Array.from(
        new Set(reasons),
      ).slice(0, 5),

    highPrioritySkills:
      Array.from(
        new Set(
          highPrioritySkills,
        ),
      ),
  };
}

function getPriorityLabel(
  priority:
    | "high"
    | "medium"
    | "low",
) {
  switch (priority) {
    case "high":
      return "HIGH PRIORITY";

    case "medium":
      return "MEDIUM PRIORITY";

    default:
      return "LOW PRIORITY";
  }
}

function getPriorityClasses(
  priority:
    | "high"
    | "medium"
    | "low",
) {
  if (priority === "high") {
    return {
      badge:
        "bg-[#f5deda] text-[#8a2d32]",

      bar:
        "bg-[#8a2d32]",

      panel:
        "border-[#e6c9bd] bg-[#f8ece7]",
    };
  }

  if (
    priority === "medium"
  ) {
    return {
      badge:
        "bg-[#f1e7d5] text-[#765c32]",

      bar:
        "bg-[#8b6b3f]",

      panel:
        "border-[#e3d6be] bg-[#f7f0e2]",
    };
  }

  return {
    badge:
      "bg-[#e9eee5] text-[#56644e]",

    bar:
      "bg-[#66745c]",

    panel:
      "border-[#d5decf] bg-[#f1f5ec]",
  };
}

export default function ProjectsPage() {
  const params =
    useParams();

  const jobId =
    params.id as string;

  const [
    projects,
    setProjects,
  ] = useState<Project[]>(
    [],
  );

  const [
    skillGaps,
    setSkillGaps,
  ] = useState<SkillGapMatch[]>(
    [],
  );

  const [
    interviewPerformance,
    setInterviewPerformance,
  ] = useState<
    InterviewPerformance[]
  >([]);

  const [job, setJob] =
    useState<Job | null>(
      null,
    );

  const [loading, setLoading] =
    useState(true);

  const [generating, setGenerating] =
    useState(false);

  const [error, setError] =
    useState("");

  const loadProjects =
    useCallback(async () => {
      try {
        setLoading(true);

        setError("");

        const [
          projectsResponse,
          jobResponse,
          practiceDataResponse,
        ] =
          await Promise.all([
            fetch(
              `/api/jobs/${jobId}/projects`,
            ),

            fetch(
              `/api/jobs/${jobId}`,
            ),

            fetch(
              `/api/jobs/${jobId}/practice-data`,
            ),
          ]);

        // --------------------------------------------------
        // Projects
        // --------------------------------------------------

        const projectsData =
          await projectsResponse.json();

        if (
          !projectsResponse.ok ||
          !projectsData.success
        ) {
          throw new Error(
            projectsData.error ||
              "Failed to load projects.",
          );
        }

        setProjects(
          projectsData.projects ??
            [],
        );

        // --------------------------------------------------
        // Job
        // --------------------------------------------------

        if (
          jobResponse.ok
        ) {
          const jobData =
            await jobResponse.json();

          if (
            jobData.success
          ) {
            setJob(
              jobData.job,
            );
          }
        }

        // --------------------------------------------------
        // Skill gaps + interview performance
        // --------------------------------------------------

        if (
          practiceDataResponse.ok
        ) {
          const practiceData =
            await practiceDataResponse.json();

          setSkillGaps(
            Array.isArray(
              practiceData.gaps,
            )
              ? practiceData.gaps
              : [],
          );

          setInterviewPerformance(
            Array.isArray(
              practiceData.interviewPerformance,
            )
              ? practiceData.interviewPerformance
              : [],
          );
        } else {
          setSkillGaps([]);
          setInterviewPerformance([]);
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load projects.",
        );
      } finally {
        setLoading(false);
      }
    }, [jobId]);

  async function generateProjects() {
    try {
      setGenerating(true);

      setError("");

      const response =
        await fetch(
          `/api/jobs/${jobId}/projects`,
          {
            method: "POST",
          },
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            "Failed to generate projects.",
        );
      }

      setProjects(
        data.projects ??
          [],
      );

      // Refresh skill gaps and interview performance
      // so project priorities are immediately recalculated.
      try {
        const practiceDataResponse =
          await fetch(
            `/api/jobs/${jobId}/practice-data`,
          );

        if (
          practiceDataResponse.ok
        ) {
          const practiceData =
            await practiceDataResponse.json();

          setSkillGaps(
            Array.isArray(
              practiceData.gaps,
            )
              ? practiceData.gaps
              : [],
          );

          setInterviewPerformance(
            Array.isArray(
              practiceData.interviewPerformance,
            )
              ? practiceData.interviewPerformance
              : [],
          );
        }
      } catch {
        // Project generation succeeded even if
        // practice-data refresh failed.
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to generate projects.",
      );
    } finally {
      setGenerating(false);
    }
  }

  useEffect(() => {
    if (jobId) {
      void loadProjects();
    }
  }, [
    jobId,
    loadProjects,
  ]);

  const projectsWithPriority =
    useMemo(() => {
      return projects
        .map(
          (project) => ({
            project,

            priority:
              calculateProjectPriority(
                project,
                skillGaps,
                interviewPerformance,
              ),
          }),
        )
        .sort(
          (a, b) => {
            const priorityOrder: Record<
              string,
              number
            > = {
              high: 3,
              medium: 2,
              low: 1,
            };

            return (
              priorityOrder[
                b.priority
                  .priority
              ] -
                priorityOrder[
                  a.priority
                    .priority
                ] ||
              b.priority.score -
                a.priority
                  .score
            );
          },
        );
    }, [
      projects,
      skillGaps,
      interviewPerformance,
    ]);

  const highPriorityProjects =
    projectsWithPriority.filter(
      (item) =>
        item.priority.priority ===
        "high",
    ).length;

  const directlyTargetedProjects =
    projectsWithPriority.filter(
      (item) =>
        item.priority
          .matchedSkills
          .length > 0,
    ).length;

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f5efe5] px-6 py-12 text-[#152a3f]">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm text-[#6f655a]">
            Loading project recommendations...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5efe5] px-6 py-10 text-[#152a3f]">
      <div className="mx-auto max-w-6xl">

        {/* =================================================
            HEADER
            ================================================= */}

        <div className="mb-10 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 text-xs font-semibold tracking-[0.28em] text-[#7b1e2b]">
              PROJECTS TO BUILD
            </div>

            <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
              Close your skill gaps
            </h1>

            {job && (
              <p className="mt-3 text-base text-[#6f655a]">
                Projects generated specifically for{" "}
                <span className="font-medium text-[#152a3f]">
                  {job.title}
                </span>{" "}
                at{" "}
                <span className="font-medium text-[#152a3f]">
                  {job.company_name}
                </span>
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href={`/jobs/${jobId}`}
            >
              <Button variant="outline">
                Back to Job
              </Button>
            </Link>

            <Link
              href={`/jobs/${jobId}/skill-profile`}
            >
              <Button variant="outline">
                Skill Profile
              </Button>
            </Link>

            <Button
              onClick={
                generateProjects
              }
              disabled={
                generating
              }
              className="bg-[#7b1e2b] text-white hover:bg-[#661824]"
            >
              {generating
                ? "Generating..."
                : "Regenerate Projects"}
            </Button>
          </div>
        </div>

        {/* =================================================
            ERROR
            ================================================= */}

        {error && (
          <div className="mb-8 rounded-2xl border border-[#d7b8b8] bg-[#f8eaea] px-5 py-4 text-sm text-[#7b1e2b]">
            {error}
          </div>
        )}

        {/* =================================================
            PRIORITY SUMMARY
            ================================================= */}

        {projects.length > 0 && (
          <section className="mb-8 rounded-3xl border border-[#dfd3c4] bg-[#fbf7f0] p-7 shadow-sm">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-xs font-semibold tracking-[0.25em] text-[#7b1e2b]">
                  PRACTICE-ALIGNED PROJECTS
                </div>

                <h2 className="mt-2 text-2xl font-semibold">
                  Projects are prioritized around your skill gaps
                </h2>

                <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6f655a]">
                  Projects targeting missing or blocking
                  job requirements are surfaced first, so
                  your project work is connected directly
                  to the role you are preparing for.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
                <SummaryStat
                  label="High priority"
                  value={`${highPriorityProjects}`}
                />

                <SummaryStat
                  label="Gap targeted"
                  value={`${directlyTargetedProjects}`}
                />

                <SummaryStat
                  label="Total projects"
                  value={`${projects.length}`}
                />
              </div>
            </div>
          </section>
        )}

        {/* =================================================
            EMPTY STATE
            ================================================= */}

        {projects.length === 0 &&
          !error && (
            <section className="rounded-3xl border border-[#dfd3c4] bg-[#fbf7f0] p-10 text-center shadow-sm">
              <div className="mx-auto max-w-xl">
                <div className="mb-3 text-xs font-semibold tracking-[0.25em] text-[#7b1e2b]">
                  NO PROJECTS YET
                </div>

                <h2 className="text-2xl font-semibold">
                  Generate projects from your skill gaps
                </h2>

                <p className="mt-3 text-[#6f655a]">
                  The AI will analyze your missing and
                  partial skills and create practical
                  projects designed to close those gaps.
                </p>

                <div className="mt-6">
                  <Button
                    onClick={
                      generateProjects
                    }
                    disabled={
                      generating
                    }
                    className="bg-[#7b1e2b] text-white hover:bg-[#661824]"
                  >
                    {generating
                      ? "Generating..."
                      : "Generate Projects"}
                  </Button>
                </div>
              </div>
            </section>
          )}

        {/* =================================================
            PROJECT CARDS
            ================================================= */}

        {projectsWithPriority.length >
          0 && (
          <div className="grid gap-8 lg:grid-cols-3">
            {projectsWithPriority.map(
              (
                item,
                index,
              ) => {
                const project =
                  item.project;

                const priority =
                  item.priority;

                const priorityClasses =
                  getPriorityClasses(
                    priority.priority,
                  );

                return (
                  <article
                    key={
                      project.id
                    }
                    className="flex flex-col rounded-3xl border border-[#dfd3c4] bg-[#fbf7f0] p-6 shadow-sm"
                  >
                    {/* Project number + duration */}
                    <div className="mb-5 flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold tracking-[0.2em] text-[#7b1e2b]">
                        PROJECT{" "}
                        {String(
                          index + 1,
                        ).padStart(
                          2,
                          "0",
                        )}
                      </span>

                      <span className="rounded-full border border-[#d9cbbb] bg-[#f2e9dc] px-3 py-1 text-xs text-[#6f655a]">
                        {
                          project.estimated_weeks
                        }{" "}
                        {project.estimated_weeks ===
                        1
                          ? "week"
                          : "weeks"}
                      </span>
                    </div>

                    {/* Priority */}
                    <div className="mb-5 flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${priorityClasses.badge}`}
                      >
                        {getPriorityLabel(
                          priority.priority,
                        )}
                      </span>

                      <span className="rounded-full border border-[#d9cbbb] bg-[#f8f1e8] px-3 py-1 text-xs text-[#6f655a]">
                        Score{" "}
                        {
                          priority.score
                        }
                      </span>
                    </div>

                    {/* Title */}
                    <h2 className="text-2xl font-semibold leading-tight">
                      {
                        project.title
                      }
                    </h2>

                    <div className="mt-3 inline-flex w-fit rounded-full bg-[#eadfd0] px-3 py-1 text-xs font-medium text-[#6f655a]">
                      {
                        project.difficulty
                      }
                    </div>

                    {/* Priority reasoning */}
                    <div
                      className={`mt-5 rounded-2xl border p-4 ${priorityClasses.panel}`}
                    >
                      <p className="text-xs font-semibold uppercase tracking-[0.15em]">
                        Why this project is prioritized
                      </p>

                      {priority
                        .reasons
                        .length >
                        0 ? (
                        <div className="mt-3 space-y-1.5">
                          {priority.reasons
                            .slice(
                              0,
                              3,
                            )
                            .map(
                              (
                                reason,
                              ) => (
                                <p
                                  key={
                                    reason
                                  }
                                  className="text-sm leading-5"
                                >
                                  •{" "}
                                  {
                                    reason
                                  }
                                </p>
                              ),
                            )}
                        </div>
                      ) : (
                        <p className="mt-2 text-sm leading-6">
                          This project still provides
                          useful portfolio and interview
                          preparation value.
                        </p>
                      )}

                      {priority
                        .highPrioritySkills
                        .length >
                        0 && (
                        <div className="mt-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.12em]">
                            Highest-impact skills
                          </p>

                          <div className="mt-2 flex flex-wrap gap-2">
                            {priority.highPrioritySkills.map(
                              (
                                skill,
                              ) => (
                                <span
                                  key={
                                    skill
                                  }
                                  className="rounded-full bg-white/80 px-3 py-1 text-xs font-medium"
                                >
                                  {
                                    skill
                                  }
                                </span>
                              ),
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Priority bar */}
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-xs text-[#8a7478]">
                        <span>
                          Practice priority
                        </span>

                        <span>
                          {
                            priority.score
                          }
                          /100
                        </span>
                      </div>

                      <div className="mt-2 h-2 rounded-full bg-[#e5d8cb]">
                        <div
                          className={`h-full rounded-full ${priorityClasses.bar}`}
                          style={{
                            width: `${priority.score}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Problem */}
                    <div className="mt-6">
                      <h3 className="text-sm font-semibold">
                        Problem
                      </h3>

                      <p className="mt-2 text-sm leading-6 text-[#6f655a]">
                        {
                          project.problem_statement
                        }
                      </p>
                    </div>

                    {/* Why */}
                    <div className="mt-5">
                      <h3 className="text-sm font-semibold">
                        Why build this?
                      </h3>

                      <p className="mt-2 text-sm leading-6 text-[#6f655a]">
                        {
                          project.why_this_project
                        }
                      </p>
                    </div>

                    {/* Target skills */}
                    <div className="mt-6">
                      <h3 className="text-sm font-semibold">
                        Skills you will develop
                      </h3>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {project.target_skills.map(
                          (
                            skill,
                          ) => {
                            const matchedGap =
                              findGapForSkill(
                                skill,
                                skillGaps,
                              );

                            const isTargetedGap =
                              Boolean(
                                matchedGap &&
                                  (
                                    matchedGap.matchStatus ===
                                      "missing" ||
                                    matchedGap.matchStatus ===
                                      "partial"
                                  ),
                              );

                            return (
                              <span
                                key={
                                  skill
                                }
                                className={`rounded-full border px-3 py-1 text-xs ${
                                  isTargetedGap
                                    ? "border-[#b77a70] bg-[#f5e0da] font-medium text-[#7b1e2b]"
                                    : "border-[#c9b39b] bg-[#f4eadc] text-[#152a3f]"
                                }`}
                              >
                                {
                                  skill
                                }

                                {isTargetedGap &&
                                  " • gap"}
                              </span>
                            );
                          },
                        )}
                      </div>
                    </div>

                    {/* Tech stack */}
                    <div className="mt-6">
                      <h3 className="text-sm font-semibold">
                        Tech stack
                      </h3>

                      <p className="mt-2 text-sm leading-6 text-[#6f655a]">
                        {
                          project.tech_stack
                            .length >
                          0
                            ? project.tech_stack.join(
                                " • ",
                              )
                            : "Not specified"
                        }
                      </p>
                    </div>

                    {/* Status */}
                    {project.status && (
                      <div className="mt-5">
                        <span className="rounded-full border border-[#d9cbbb] bg-[#f8f1e8] px-3 py-1 text-xs text-[#6f655a]">
                          Status:{" "}
                          {
                            project.status
                          }
                        </span>
                      </div>
                    )}

                    {/* Project plan */}
                    <div className="mt-auto pt-8">
                      <Link
                        href={`/jobs/${jobId}/projects/${project.id}`}
                        className="block"
                      >
                        <Button className="w-full bg-[#152a3f] text-white hover:bg-[#0e2031]">
                          View Project Plan
                        </Button>
                      </Link>
                    </div>
                  </article>
                );
              },
            )}
          </div>
        )}

        {/* =================================================
            HOW THIS WORKS
            ================================================= */}

        {projects.length >
          0 && (
          <section className="mt-12 rounded-3xl border border-[#dfd3c4] bg-[#fbf7f0] p-8 shadow-sm">
            <div className="text-xs font-semibold tracking-[0.25em] text-[#7b1e2b]">
              HOW THIS FITS THE PIPELINE
            </div>

            <div className="mt-5 grid gap-5 md:grid-cols-5">
              {[
                "Job requirements",
                "Skill gaps",
                "Practice priorities",
                "Projects",
                "Mock interview",
              ].map(
                (
                  step,
                  index,
                ) => (
                  <div
                    key={
                      step
                    }
                    className="relative"
                  >
                    <div className="text-xs font-semibold text-[#7b1e2b]">
                      0
                      {index +
                        1}
                    </div>

                    <div className="mt-2 text-sm font-medium">
                      {
                        step
                      }
                    </div>

                    {index <
                      4 && (
                      <div className="mt-4 hidden h-px bg-[#d8cbbd] md:block" />
                    )}
                  </div>
                ),
              )}
            </div>

            <div className="mt-6 rounded-2xl bg-[#f3e9de] p-5">
              <p className="text-sm font-semibold">
                Current recommendation logic
              </p>

              <p className="mt-2 text-sm leading-6 text-[#6f655a]">
                Projects that target missing, partial,
                must-have or blocking skills receive higher
                practice priority. This keeps project work
                connected to the requirements of the selected
                job.
              </p>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function SummaryStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-[#d9cbbb] bg-[#f7efe5] px-4 py-3">
      <p className="text-xs uppercase tracking-[0.12em] text-[#8a7478]">
        {label}
      </p>

      <p className="mt-1 text-xl font-semibold text-[#152a3f]">
        {value}
      </p>
    </div>
  );
}
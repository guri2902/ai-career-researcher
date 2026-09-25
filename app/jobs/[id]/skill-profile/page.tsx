import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

type PracticePriority = {
  skill: string;
  priority: "high" | "medium" | "low";
  score: number;
  reason: string;
  action: string;
  evidenceConfidence: "low" | "medium" | "high";
};

type JobPageProps = {
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
};

type InterviewPerformance = {
  skill_name: string;

  question_count: number;

  average_score: number;

  correctness_score: number;

  structure_score: number;

  specificity_score: number;

  communication_score: number;

  performance_level:
    | "strong"
    | "developing"
    | "weak"
    | "insufficient";

  evidence_summary: string;

  strengths: string[];

  weaknesses: string[];
};

type UnifiedSkill = {
  skill: string;

  requirementType:
    | "must_have"
    | "nice_to_have"
    | "interview_only";

  resumeStatus:
    | "matched"
    | "partial"
    | "missing"
    | "not_assessed";

  candidateSkill:
    | string
    | null;

  matchScore:
    | number
    | null;

  gapType:
    | "blocking"
    | "minor"
    | null;

  interview:
    | InterviewPerformance
    | null;
};

function buildPracticePriorities(
  skills: UnifiedSkill[],
): PracticePriority[] {
  return skills
    .map((skill) => {
      let score = 0;

      const reasons: string[] = [];

      // --------------------------------------------------
      // Job importance
      // --------------------------------------------------

      if (
        skill.requirementType ===
        "must_have"
      ) {
        score += 40;

        reasons.push(
          "must-have job requirement",
        );
      } else if (
        skill.requirementType ===
        "nice_to_have"
      ) {
        score += 15;
      }

      // --------------------------------------------------
      // Resume / profile gap
      // --------------------------------------------------

      if (
        skill.resumeStatus ===
        "missing"
      ) {
        score += 30;

        reasons.push(
          "missing from profile",
        );
      } else if (
        skill.resumeStatus ===
        "partial"
      ) {
        score += 15;

        reasons.push(
          "partial profile evidence",
        );
      }

      // --------------------------------------------------
      // Interview evidence
      // --------------------------------------------------

      if (skill.interview) {
        if (
          skill.interview.performance_level ===
          "weak"
        ) {
          score += 30;

          reasons.push(
            "weak interview performance",
          );
        } else if (
          skill.interview.performance_level ===
          "developing"
        ) {
          score += 15;

          reasons.push(
            "developing interview performance",
          );
        }

        if (
          skill.interview.question_count ===
          1
        ) {
          reasons.push(
            "limited interview evidence",
          );
        }
      } else {
        score += 10;

        reasons.push(
          "not assessed in interview",
        );
      }

      // --------------------------------------------------
      // Evidence confidence
      // --------------------------------------------------

      let evidenceConfidence:
        | "low"
        | "medium"
        | "high" = "low";

      if (
        skill.interview &&
        skill.interview.question_count >=
          3
      ) {
        evidenceConfidence = "high";
      } else if (
        skill.interview &&
        skill.interview.question_count >=
          2
      ) {
        evidenceConfidence = "medium";
      }

      // --------------------------------------------------
      // Priority level
      // --------------------------------------------------

      let priority:
        | "high"
        | "medium"
        | "low";

      if (score >= 70) {
        priority = "high";
      } else if (score >= 40) {
        priority = "medium";
      } else {
        priority = "low";
      }

      // --------------------------------------------------
      // Recommended action
      // --------------------------------------------------

      let action =
        "Practice through another interview question.";

      if (
        skill.resumeStatus ===
          "missing" &&
        !skill.interview
      ) {
        action =
          "Build evidence through a project, learning task, or documented hands-on work.";
      } else if (
        skill.interview
          ?.performance_level ===
        "weak"
      ) {
        action =
          "Review the concept, then retest with another mock-interview question.";
      } else if (
        skill.interview
          ?.performance_level ===
        "developing"
      ) {
        action =
          "Practice deeper implementation and troubleshooting questions.";
      } else if (
        skill.resumeStatus ===
          "matched" &&
        skill.interview
          ?.performance_level ===
          "strong"
      ) {
        action =
          "Maintain this skill and move attention to higher-priority gaps.";
      }

      return {
        skill: skill.skill,

        priority,

        score,

        reason:
          reasons.length > 0
            ? reasons.join(" • ")
            : "No additional evidence available.",

        action,

        evidenceConfidence,
      };
    })
    .sort(
      (a, b) =>
        b.score - a.score,
    )
    .slice(0, 8);
}

function getResumeLabel(
  status: UnifiedSkill["resumeStatus"],
) {
  switch (status) {
    case "matched":
      return "Matched";

    case "partial":
      return "Partial";

    case "missing":
      return "Missing";

    default:
      return "Not assessed";
  }
}

function getInterviewLabel(
  performance:
    | InterviewPerformance
    | null,
) {
  if (!performance) {
    return "Not assessed";
  }

  switch (
    performance.performance_level
  ) {
    case "strong":
      return "Strong";

    case "developing":
      return "Developing";

    case "weak":
      return "Weak";

    default:
      return "Insufficient";
  }
}

function getCombinedInterpretation(
  skill: UnifiedSkill,
): {
  title: string;
  description: string;
  tone:
    | "positive"
    | "warning"
    | "neutral";
} {
  const resume =
    skill.resumeStatus;

  const interview =
    skill.interview
      ?.performance_level;

  if (
    resume === "matched" &&
    interview === "strong"
  ) {
    return {
      title:
        "Consistent evidence",

      description:
        "Your stored skill evidence and interview performance both support this skill.",

      tone: "positive",
    };
  }

  if (
    resume === "matched" &&
    interview === "weak"
  ) {
    return {
      title:
        "Interview needs practice",

      description:
        "Your profile contains evidence for this skill, but your interview performance needs more practice.",

      tone: "warning",
    };
  }

  if (
    resume === "missing" &&
    interview === "strong"
  ) {
    return {
      title:
        "Knowledge demonstrated",

      description:
        "You demonstrated knowledge during the interview, but the current resume/profile does not contain strong evidence for this skill.",

      tone: "neutral",
    };
  }

  if (
    resume === "missing" &&
    interview === "weak"
  ) {
    return {
      title:
        "Priority practice area",

      description:
        "The skill is missing from your current profile and the interview performance was also weak.",

      tone: "warning",
    };
  }

  if (
    resume === "partial" &&
    interview === "developing"
  ) {
    return {
      title:
        "Developing evidence",

      description:
        "You have some profile evidence and are developing interview-level understanding.",

      tone: "neutral",
    };
  }

  if (
    resume === "partial" &&
    interview === "strong"
  ) {
    return {
      title:
        "Strong interview evidence",

      description:
        "Your interview performance is strong, while the stored profile evidence could be expanded.",

      tone: "positive",
    };
  }

  if (skill.interview) {
    return {
      title:
        "Interview evidence available",

      description:
        "Interview performance is available and can be used alongside your existing profile evidence.",

      tone: "neutral",
    };
  }

  return {
    title:
      "More evidence needed",

    description:
      "There is not enough interview evidence yet to update your understanding of this skill.",

    tone: "neutral",
  };
}

function scoreWidth(
  score: number,
) {
  return `${Math.min(
    100,
    Math.max(
      0,
      score * 20,
    ),
  )}%`;
}

export default async function SkillProfilePage({
  params,
}: JobPageProps) {
  const { id } =
    await params;

  const supabase =
    await createClient();

  // --------------------------------------------------
  // Load job
  // --------------------------------------------------

  const {
    data: job,
    error: jobError,
  } = await supabase
    .from("jobs")
    .select(
      "id, title, company_name, readiness_score",
    )
    .eq("id", id)
    .single();

  if (
    jobError ||
    !job
  ) {
    notFound();
  }

  // --------------------------------------------------
  // Existing skill-gap evidence
  // --------------------------------------------------

  const {
    data: skillGaps,
  } = await supabase
    .from("skill_gaps")
    .select(
      `
      required_skill,
      requirement_type,
      match_status,
      candidate_skill,
      match_score,
      gap_type
      `,
    )
    .eq("job_id", id)
    .order(
      "requirement_type",
      {
        ascending: true,
      },
    );

  // --------------------------------------------------
  // Latest interview session
  // --------------------------------------------------

  const {
    data: latestPerformanceRow,
    } = await supabase
    .from("interview_skill_performance")
    .select(
        "session_id, created_at, id",
    )
    .eq("job_id", id)
    .order("created_at", {
        ascending: false,
    })
    .order("id", {
        ascending: false,
    })
    .limit(1)
    .maybeSingle();

    let interviewPerformance:
    | InterviewPerformance[]
    | null = null;

    if (latestPerformanceRow) {
    const {
        data: performance,
    } = await supabase
        .from(
        "interview_skill_performance",
        )
        .select("*")
        .eq(
        "session_id",
        latestPerformanceRow.session_id,
        )
        .order(
        "average_score",
        {
            ascending: false,
        },
        );

    interviewPerformance =
        (performance ??
        []) as InterviewPerformance[];
    }

  // --------------------------------------------------
  // Performance lookup
  // --------------------------------------------------

  const performanceMap =
    new Map<
      string,
      InterviewPerformance
    >();

  for (
    const performance of
      interviewPerformance ?? []
  ) {
    performanceMap.set(
      performance.skill_name
        .trim()
        .toLowerCase(),
      performance,
    );
  }

  // --------------------------------------------------
  // Skill-gap lookup
  // --------------------------------------------------

  const gapMap =
    new Map<
      string,
      SkillGap
    >();

  for (
    const gap of
      (skillGaps ??
        []) as SkillGap[]
  ) {
    gapMap.set(
      gap.required_skill
        .trim()
        .toLowerCase(),
      gap,
    );
  }

  // --------------------------------------------------
  // Build union of job skills + interview skills
  // --------------------------------------------------

  const skillNames =
    new Set<string>();

  for (
    const gap of
      (skillGaps ??
        []) as SkillGap[]
  ) {
    skillNames.add(
      gap.required_skill,
    );
  }

  for (
    const performance of
      interviewPerformance ??
      []
  ) {
    if (
      performance.skill_name
    ) {
      skillNames.add(
        performance.skill_name,
      );
    }
  }

  // --------------------------------------------------
  // Build unified skills
  // --------------------------------------------------

  const unifiedSkills: UnifiedSkill[] =
    Array.from(
      skillNames,
    )
      .map(
        (
          skillName,
        ): UnifiedSkill => {
          const key =
            skillName
              .trim()
              .toLowerCase();

          const gap =
            gapMap.get(key);

          const performance =
            performanceMap.get(
              key,
            ) ?? null;

          return {
            skill:
              skillName,

            requirementType:
              gap?.requirement_type ??
              "interview_only",

            resumeStatus:
              gap?.match_status ??
              "not_assessed",

            candidateSkill:
              gap?.candidate_skill ??
              null,

            matchScore:
              typeof gap?.match_score ===
              "number"
                ? gap.match_score
                : null,

            gapType:
              gap?.gap_type ??
              null,

            interview:
              performance,
          };
        },
      )
      .sort(
        (
          a,
          b,
        ) => {
          const aMissing =
            a.resumeStatus ===
            "missing"
              ? 0
              : 1;

          const bMissing =
            b.resumeStatus ===
            "missing"
              ? 0
              : 1;

          return (
            aMissing -
              bMissing ||
            b.requirementType.localeCompare(
              a.requirementType,
            ) ||
            a.skill.localeCompare(
              b.skill,
            )
          );
        },
      );

  // --------------------------------------------------
  // Summary metrics
  // --------------------------------------------------

  const strongCount =
    unifiedSkills.filter(
      (skill) =>
        skill.interview
          ?.performance_level ===
        "strong",
    ).length;

  const weakCount =
    unifiedSkills.filter(
      (skill) =>
        skill.interview
          ?.performance_level ===
        "weak",
    ).length;

  const assessedCount =
    unifiedSkills.filter(
      (skill) =>
        skill.interview !== null,
    ).length;

  // --------------------------------------------------
  // Practice priorities
  // --------------------------------------------------

  const practicePriorities =
    buildPracticePriorities(
      unifiedSkills,
    );

  return (
    <main className="min-h-screen bg-[#f7f2ea] text-[#321e24]">
      <div className="mx-auto max-w-7xl px-6 py-10 lg:px-8">

        {/* =================================================
            HEADER
            ================================================= */}

        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link
              href={`/jobs/${id}`}
              className="text-sm text-[#7c6068] hover:text-[#6b1f2a]"
            >
              ← Back to Job
            </Link>

            <p className="mt-6 text-sm font-semibold uppercase tracking-[0.2em] text-[#6b1f2a]">
              Unified Skill Profile
            </p>

            <h1 className="mt-2 text-4xl font-semibold tracking-tight">
              {job.title ??
                "Target role"}
            </h1>

            {job.company_name && (
              <p className="mt-2 text-lg text-[#7c6068]">
                {job.company_name}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href={`/jobs/${id}/interview-questions`}
              className="rounded-xl border border-[#d8c5ba] bg-[#fffaf4] px-5 py-3 text-sm font-medium hover:bg-white"
            >
              Interview Questions
            </Link>

            <Link
              href={`/jobs/${id}/mock-interview`}
              className="rounded-xl bg-[#6b1f2a] px-5 py-3 text-sm font-medium text-white hover:bg-[#571821]"
            >
              Mock Interview
            </Link>
          </div>
        </div>

        {/* =================================================
            EXPLANATION
            ================================================= */}

        <section className="mt-8 rounded-3xl border border-[#dfd0c3] bg-[#fffaf4] p-7 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.15em] text-[#6b1f2a]">
            How this works
          </p>

          <p className="mt-3 max-w-4xl leading-7 text-[#514049]">
            This page combines your existing job-skill
            evidence with interview performance. An
            interview score does not automatically mean you
            have hands-on experience; it is stored as a
            separate evidence signal.
          </p>
        </section>

        {/* =================================================
            SUMMARY CARDS
            ================================================= */}

        <section className="mt-8 grid gap-4 sm:grid-cols-4">
          <MetricCard
            label="Readiness"
            value={`${job.readiness_score ?? 0}%`}
          />

          <MetricCard
            label="Skills"
            value={`${unifiedSkills.length}`}
          />

          <MetricCard
            label="Interview assessed"
            value={`${assessedCount}`}
          />

          <MetricCard
            label="Strong interview areas"
            value={`${strongCount}`}
          />
        </section>

        {/* =================================================
            PRACTICE PRIORITIES
            ================================================= */}

        <section className="mt-10">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.15em] text-[#6b1f2a]">
              Practice priorities
            </p>

            <h2 className="mt-2 text-2xl font-semibold">
              What to work on next
            </h2>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#806a72]">
              Priorities combine job importance, profile gaps,
              interview performance and the amount of interview
              evidence available.
            </p>
          </div>

          <div className="mt-5 space-y-4">
            {practicePriorities.length ===
            0 ? (
              <div className="rounded-2xl border border-[#dfd0c3] bg-[#fffaf4] p-6">
                <p className="font-medium">
                  No practice priorities yet.
                </p>

                <p className="mt-2 text-sm leading-6 text-[#806a72]">
                  Run job analysis and complete an interview
                  to generate personalized practice priorities.
                </p>
              </div>
            ) : (
              practicePriorities.map(
                (
                  item,
                  index,
                ) => (
                  <div
                    key={
                      item.skill
                    }
                    className="rounded-2xl border border-[#dfd0c3] bg-[#fffaf4] p-6"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#321e24] text-xs font-semibold text-white">
                            {index +
                              1}
                          </span>

                          <h3 className="text-lg font-semibold">
                            {item.skill}
                          </h3>

                          <span
                            className={`rounded-full px-3 py-1 text-xs font-medium ${
                              item.priority ===
                              "high"
                                ? "bg-[#f5deda] text-[#8a2d32]"
                                : item.priority ===
                                    "medium"
                                  ? "bg-[#f1e7d5] text-[#765c32]"
                                  : "bg-[#e9eee5] text-[#56644e]"
                            }`}
                          >
                            {item.priority.toUpperCase()}
                          </span>
                        </div>

                        <p className="mt-3 text-sm text-[#806a72]">
                          {item.reason}
                        </p>
                      </div>

                      <div className="shrink-0 text-left sm:text-right">
                        <p className="text-xs uppercase tracking-[0.15em] text-[#8a7478]">
                          Evidence confidence
                        </p>

                        <p className="mt-1 text-sm font-semibold">
                          {item.evidenceConfidence}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5">
                      <div className="flex items-center justify-between text-xs text-[#8a7478]">
                        <span>
                          Priority score
                        </span>

                        <span>
                          {item.score}
                        </span>
                      </div>

                      <div className="mt-2 h-2 rounded-full bg-[#e5d9cf]">
                        <div
                          className={`h-full rounded-full ${
                            item.priority ===
                            "high"
                              ? "bg-[#8a2d32]"
                              : item.priority ===
                                  "medium"
                                ? "bg-[#8b6b3f]"
                                : "bg-[#66745c]"
                          }`}
                          style={{
                            width: `${Math.min(
                              100,
                              item.score,
                            )}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="mt-5 rounded-xl bg-[#f6eee6] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8a7478]">
                        Recommended action
                      </p>

                      <p className="mt-2 text-sm leading-6">
                        {item.action}
                      </p>
                    </div>
                  </div>
                ),
              )
            )}
          </div>
        </section>

        {/* =================================================
            MAIN SKILL EVIDENCE
            ================================================= */}

        <section className="mt-10">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.15em] text-[#6b1f2a]">
                Skill evidence
              </p>

              <h2 className="mt-2 text-2xl font-semibold">
                Resume + interview
              </h2>
            </div>

            <p className="text-sm text-[#8a7478]">
              {weakCount} weak interview area
              {weakCount === 1
                ? ""
                : "s"}
            </p>
          </div>

          <div className="mt-5 space-y-5">
            {unifiedSkills.map(
              (skill) => {
                const interpretation =
                  getCombinedInterpretation(
                    skill,
                  );

                return (
                  <SkillCard
                    key={
                      skill.skill
                    }
                    skill={
                      skill
                    }
                    interpretation={
                      interpretation
                    }
                  />
                );
              },
            )}
          </div>

          {unifiedSkills.length ===
            0 && (
            <div className="mt-5 rounded-2xl border border-[#dfd0c3] bg-[#fffaf4] p-7">
              <p className="font-medium">
                No skill evidence yet.
              </p>

              <p className="mt-2 text-sm text-[#806a72]">
                Run the job analysis and complete an
                interview to populate this page.
              </p>
            </div>
          )}
        </section>

        {/* =================================================
            INTERVIEW PERFORMANCE
            ================================================= */}

        {interviewPerformance &&
          interviewPerformance.length >
            0 && (
            <section className="mt-10">
              <p className="text-sm font-semibold uppercase tracking-[0.15em] text-[#6b1f2a]">
                Interview performance
              </p>

              <h2 className="mt-2 text-2xl font-semibold">
                What the interview measured
              </h2>

              <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {interviewPerformance.map(
                  (
                    performance,
                  ) => (
                    <div
                      key={
                        performance.skill_name
                      }
                      className="rounded-2xl border border-[#dfd0c3] bg-[#fffaf4] p-6"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-semibold">
                            {
                              performance.skill_name
                            }
                          </p>

                          <p className="mt-1 text-xs text-[#8a7478]">
                            {
                              performance.question_count
                            }{" "}
                            question
                            {performance.question_count !==
                            1
                              ? "s"
                              : ""}
                          </p>
                        </div>

                        <span className="text-xl font-semibold text-[#6b1f2a]">
                          {performance.average_score.toFixed(
                            1,
                          )}
                          /5
                        </span>
                      </div>

                      <div className="mt-4 h-2 rounded-full bg-[#e5d9cf]">
                        <div
                          className="h-full rounded-full bg-[#6b1f2a]"
                          style={{
                            width:
                              scoreWidth(
                                performance.average_score,
                              ),
                          }}
                        />
                      </div>

                      <p className="mt-4 text-sm leading-6 text-[#806a72]">
                        {
                          performance.evidence_summary
                        }
                      </p>

                      <div className="mt-4 flex items-center justify-between gap-3">
                        <span className="rounded-full bg-[#efe3d8] px-3 py-1 text-xs font-medium">
                          {getInterviewLabel(
                            performance,
                          )}
                        </span>

                        <span className="text-xs text-[#8a7478]">
                          {performance.question_count ===
                          1
                            ? "Low confidence"
                            : performance.question_count ===
                                2
                              ? "Medium confidence"
                              : "High confidence"}
                        </span>
                      </div>
                    </div>
                  ),
                )}
              </div>
            </section>
          )}

      </div>
    </main>
  );
}

function SkillCard({
  skill,
  interpretation,
}: {
  skill: UnifiedSkill;

  interpretation: {
    title: string;

    description: string;

    tone:
      | "positive"
      | "warning"
      | "neutral";
  };
}) {
  const toneClass =
    interpretation.tone ===
    "positive"
      ? "border-[#cfd9c7] bg-[#f1f5ec]"
      : interpretation.tone ===
          "warning"
        ? "border-[#e6c9bd] bg-[#f8ece7]"
        : "border-[#e0d3ca] bg-[#fbf5ee]";

  return (
    <article className="rounded-3xl border border-[#dfd0c3] bg-[#fffaf4] p-7 shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xl font-semibold">
              {skill.skill}
            </h3>

            <span className="rounded-full bg-[#efe3d8] px-3 py-1 text-xs font-medium">
              {skill.requirementType ===
              "must_have"
                ? "Must-have"
                : skill.requirementType ===
                    "nice_to_have"
                  ? "Nice-to-have"
                  : "Interview topic"}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-[#f2e8df] px-3 py-1">
              Resume:{" "}
              {getResumeLabel(
                skill.resumeStatus,
              )}
            </span>

            {skill.interview && (
              <span className="rounded-full bg-[#f2e8df] px-3 py-1">
                Interview:{" "}
                {getInterviewLabel(
                  skill.interview,
                )}
              </span>
            )}
          </div>
        </div>

        {skill.interview && (
          <div className="text-left lg:text-right">
            <p className="text-xs uppercase tracking-[0.15em] text-[#8a7478]">
              Interview score
            </p>

            <p className="mt-1 text-3xl font-semibold text-[#6b1f2a]">
              {skill.interview.average_score.toFixed(
                1,
              )}
              <span className="text-base text-[#8a7478]">
                /5
              </span>
            </p>
          </div>
        )}
      </div>

      <div
        className={`mt-6 rounded-2xl border p-5 ${toneClass}`}
      >
        <p className="font-semibold">
          {interpretation.title}
        </p>

        <p className="mt-2 text-sm leading-6 text-[#67535a]">
          {interpretation.description}
        </p>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <EvidenceColumn
          title="Profile evidence"
          value={
            skill.candidateSkill ??
            getResumeLabel(
              skill.resumeStatus,
            )
          }
        />

        <EvidenceColumn
          title="Interview evidence"
          value={
            skill.interview
              ? `${skill.interview.average_score.toFixed(
                  1,
                )}/5 — ${getInterviewLabel(
                  skill.interview,
                )}`
              : "No interview evidence yet"
          }
        />
      </div>

      {skill.interview &&
        skill.interview.weaknesses
          .length > 0 && (
          <div className="mt-5 rounded-2xl bg-[#f5e8e2] p-5">
            <p className="text-sm font-semibold">
              Interview improvement areas
            </p>

            <div className="mt-3 space-y-2">
              {skill.interview.weaknesses.map(
                (weakness) => (
                  <p
                    key={
                      weakness
                    }
                    className="text-sm leading-6 text-[#67535a]"
                  >
                    • {weakness}
                  </p>
                ),
              )}
            </div>
          </div>
        )}

      {skill.interview &&
        skill.interview.strengths
          .length > 0 && (
          <div className="mt-5 rounded-2xl bg-[#edf1e8] p-5">
            <p className="text-sm font-semibold">
              Interview strengths
            </p>

            <div className="mt-3 space-y-2">
              {skill.interview.strengths.map(
                (strength) => (
                  <p
                    key={
                      strength
                    }
                    className="text-sm leading-6 text-[#53604d]"
                  >
                    • {strength}
                  </p>
                ),
              )}
            </div>
          </div>
        )}
    </article>
  );
}

function EvidenceColumn({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-[#f8f1e9] p-5">
      <p className="text-xs uppercase tracking-[0.15em] text-[#8a7478]">
        {title}
      </p>

      <p className="mt-2 text-sm leading-6">
        {value}
      </p>
    </div>
  );
}

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-[#dfd0c3] bg-[#fffaf4] p-5">
      <p className="text-xs uppercase tracking-[0.15em] text-[#8a7478]">
        {label}
      </p>

      <p className="mt-2 text-2xl font-semibold">
        {value}
      </p>
    </div>
  );
}
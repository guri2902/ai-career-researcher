import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { tailorResume } from "@/lib/ai/tailor-resume";
import { calculateATSScore } from "@/lib/ai/ats-score";
import { auditResume } from "@/lib/ai/audit-resume";

export const runtime = "nodejs";

const MAX_REPAIR_ATTEMPTS = 2;
const MAX_AUDIT_ATTEMPTS = 2;

async function runAuditWithRetry({
  baseResume,
  tailoredResume,
}: {
  baseResume: string;
  tailoredResume: string;
}) {
  let lastError = "Unknown audit error.";

  for (let attempt = 1; attempt <= MAX_AUDIT_ATTEMPTS; attempt++) {
    try {
      return {
        success: true as const,
        result: await auditResume({
          baseResume,
          tailoredResume,
        }),
        error: null,
      };
    } catch (error) {
      lastError =
        error instanceof Error
          ? error.message
          : String(error);

      console.error(
        `Resume audit attempt ${attempt} failed:`,
        lastError,
      );
    }
  }

  return {
    success: false as const,
    result: null,
    error: lastError,
  };
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: jobId } = await params;

    const supabase = await createClient();

    // ─────────────────────────────────────
    // Candidate profile
    // ─────────────────────────────────────

    const { data: profile, error: profileError } =
      await supabase
        .from("candidate_profiles")
        .select("id, resume_text")
        .order("created_at", {
          ascending: true,
        })
        .limit(1)
        .maybeSingle();

    if (profileError) {
      return NextResponse.json(
        { error: profileError.message },
        { status: 500 },
      );
    }

    if (!profile) {
      return NextResponse.json(
        {
          error:
            "Candidate profile not found. Create your profile first.",
        },
        { status: 404 },
      );
    }

    if (!profile.resume_text?.trim()) {
      return NextResponse.json(
        {
          error: "Your base resume is empty.",
        },
        { status: 400 },
      );
    }

    // ─────────────────────────────────────
    // Requirements
    // ─────────────────────────────────────

    const { data: requirements, error: requirementsError } =
      await supabase
        .from("requirements")
        .select("*")
        .eq("job_id", jobId)
        .single();

    if (requirementsError || !requirements) {
      return NextResponse.json(
        {
          error:
            "Requirements not found. Analyze the job first.",
        },
        { status: 404 },
      );
    }

    // ─────────────────────────────────────
    // Skill gaps
    // ─────────────────────────────────────

    const { data: skillGaps, error: gapsError } =
      await supabase
        .from("skill_gaps")
        .select(
          `
          required_skill,
          requirement_type,
          match_status,
          candidate_skill,
          gap_type
          `,
        )
        .eq("job_id", jobId);

    if (gapsError) {
      return NextResponse.json(
        { error: gapsError.message },
        { status: 500 },
      );
    }

    let forbiddenClaims: string[] = [];

    let finalTailored:
      | Awaited<ReturnType<typeof tailorResume>>
      | null = null;

    let finalAudit: {
      unsupported_claims: string[];
      suspicious_changes: string[];
    } = {
      unsupported_claims: [],
      suspicious_changes: [],
    };

    let auditAvailable = true;

    // ─────────────────────────────────────
    // Generate → Audit → Repair
    // ─────────────────────────────────────

    for (
      let attempt = 1;
      attempt <= MAX_REPAIR_ATTEMPTS;
      attempt++
    ) {
      const tailored = await tailorResume({
        baseResume: profile.resume_text,

        requirements: {
          must_have_skills:
            requirements.must_have_skills ?? [],

          nice_to_have_skills:
            requirements.nice_to_have_skills ?? [],

          years_experience:
            requirements.years_experience,

          tools:
            requirements.tools ?? [],

          soft_skills:
            requirements.soft_skills ?? [],

          seniority_level:
            requirements.seniority_level,
        },

        skillGaps: skillGaps ?? [],

        forbiddenClaims,
      });

      finalTailored = tailored;

      const audit = await runAuditWithRetry({
        baseResume: profile.resume_text,
        tailoredResume: tailored.tailored_text,
      });

      // Audit unavailable: don't throw away a valid tailored resume.
      if (!audit.success || !audit.result) {
        auditAvailable = false;

        finalAudit = {
          unsupported_claims: [],
          suspicious_changes: [
            "Factuality audit was unavailable for this generation. Manually compare the tailored resume with your base resume before using it.",
          ],
        };

        break;
      }

      finalAudit = audit.result;

      const auditIssues = [
        ...audit.result.unsupported_claims,
        ...audit.result.suspicious_changes,
      ];

      // Clean result.
      if (auditIssues.length === 0) {
        break;
      }

      forbiddenClaims = [
        ...new Set([
          ...forbiddenClaims,
          ...auditIssues,
        ]),
      ];
    }

    if (!finalTailored) {
      throw new Error(
        "Resume generation did not complete.",
      );
    }

    // ─────────────────────────────────────
    // ATS
    // ─────────────────────────────────────

    const atsScore = calculateATSScore({
      resume: finalTailored.tailored_text,

      mustHaveSkills:
        requirements.must_have_skills ?? [],

      niceToHaveSkills:
        requirements.nice_to_have_skills ?? [],

      tools:
        requirements.tools ?? [],
    });

    // Requirements that the user's resume does not currently support.
    const unsupportedClaims = [
      ...new Set(
        finalTailored.unsupported_claims,
      ),
    ];

    // Actual factuality audit findings.
    const suspiciousChanges = [
      ...new Set([
        ...finalAudit.unsupported_claims,
        ...finalAudit.suspicious_changes,
      ]),
    ];

    // ─────────────────────────────────────
    // Save
    // ─────────────────────────────────────

    const { data, error: saveError } =
      await supabase
        .from("resume_variants")
        .upsert(
          {
            job_id: jobId,
            profile_id: profile.id,

            tailored_text:
              finalTailored.tailored_text,

            diff_from_base: null,

            ats_score: atsScore,

            unsupported_claims:
              unsupportedClaims,

            suspicious_changes:
              suspiciousChanges,

            updated_at:
              new Date().toISOString(),
          },
          {
            onConflict:
              "job_id,profile_id",
          },
        )
        .select()
        .single();

    if (saveError) {
      return NextResponse.json(
        { error: saveError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,

      resume: data,

      audit: {
        available: auditAvailable,
        repairAttempts:
          MAX_REPAIR_ATTEMPTS,
        auditAttempts:
          MAX_AUDIT_ATTEMPTS,
      },
    });
  } catch (error) {
    console.error(
      "Resume generation error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate tailored resume.",
      },
      { status: 500 },
    );
  }
}
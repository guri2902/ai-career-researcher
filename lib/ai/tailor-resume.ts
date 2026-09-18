import { openrouter } from "@/lib/ai/openrouter";

export type TailoredResumeResult = {
  tailored_text: string;
  unsupported_claims: string[];
};

type TailorResumeInput = {
  baseResume: string;

  requirements: {
    must_have_skills: string[];
    nice_to_have_skills: string[];
    years_experience: string | null;
    tools: string[];
    soft_skills: string[];
    seniority_level: string | null;
  };

  skillGaps: {
    required_skill: string;
    requirement_type: string;
    match_status: string;
    candidate_skill: string | null;
    gap_type: string | null;
  }[];

  forbiddenClaims?: string[];
};

function cleanResumeText(text: string): string {
  return text
    .trim()
    .replace(/^```(?:text|markdown)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function extractJson(text: string): string {
  let cleaned = text.trim();

  cleaned = cleaned
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace !== -1) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  return cleaned;
}

export async function tailorResume({
  baseResume,
  requirements,
  skillGaps,
  forbiddenClaims = [],
}: TailorResumeInput): Promise<TailoredResumeResult> {
  const repairInstructions =
    forbiddenClaims.length > 0
      ? `
A previous factuality audit found these unsupported additions.
DO NOT repeat them:

${forbiddenClaims
  .map((claim) => `- ${claim}`)
  .join("\n")}
`
      : "";

  const prompt = `
You are a strict resume editor.

Tailor the ORIGINAL RESUME for the TARGET JOB.

TRUTHFULNESS IS MORE IMPORTANT THAN KEYWORD COVERAGE.

RULES:

1. The original resume is the ONLY source of candidate facts.
2. Never invent experience.
3. Never invent technologies.
4. Never invent frameworks.
5. Never invent cloud services.
6. Never invent certifications.
7. Never invent metrics.
8. Never invent responsibilities.
9. Never invent projects.
10. Never invent dates or years.
11. Never turn a general skill into a specific implementation claim.
12. Never add a technology just because the job requires it.
13. Never add "cloud-native", "enterprise-grade", "production-grade",
    "highly scalable", "highly available", or similar claims unless
    supported by the original resume.
14. Preserve actual facts exactly.
15. You may reorder sections.
16. You may improve grammar.
17. You may make existing bullets more concise.
18. You may prioritize relevant existing information.
19. You may combine facts already present in the original.
20. Preserve the candidate's real identity and contact details.
21. Do not add a job title or company header for the target job.
22. Preserve normal spaces between every word.
23. Never concatenate words.
24. Use plain-text resume formatting.
25. Use bullet points beginning with "•".
26. Use blank lines between resume sections.
27. Do not output markdown code fences.
28. Do not output commentary before or after the resume.

IMPORTANT EXAMPLES:

If original says:
"SQL"

Do NOT write:
"PostgreSQL"

If original says:
"AWS"

Do NOT write:
"AWS EC2" unless EC2 is explicitly in the original.

If original says:
"REST APIs" in Technical Skills,

do NOT automatically claim:
"Built the TradingAI platform using REST APIs."

If original says:
"Testing",

do NOT automatically claim:
"Automated testing."

If original says:
"Python",

do NOT automatically claim:
"Python production services at scale."

${repairInstructions}

Return ONLY this JSON:

{
  "tailored_text": "FULL RESUME",
  "unsupported_claims": []
}

The unsupported_claims array should contain only TARGET JOB REQUIREMENTS
that are not supported by the original resume.

ORIGINAL RESUME:
<base_resume>
${baseResume}
</base_resume>

TARGET JOB REQUIREMENTS:

Must-have:
${JSON.stringify(requirements.must_have_skills)}

Nice-to-have:
${JSON.stringify(requirements.nice_to_have_skills)}

Years:
${requirements.years_experience ?? "Not specified"}

Tools:
${JSON.stringify(requirements.tools)}

Soft skills:
${JSON.stringify(requirements.soft_skills)}

Seniority:
${requirements.seniority_level ?? "Not specified"}

CURRENT SKILL GAPS:
${JSON.stringify(skillGaps, null, 2)}
`;

  const response =
    await openrouter.chat.completions.create({
      model: "inclusionai/ling-3.0-flash-fin:free",
      max_tokens: 6000,
      messages: [
        {
          role: "system",
          content:
            "You are a strict factual resume editor. Never invent facts.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

  const content = response.choices[0]?.message?.content;

  if (!content || typeof content !== "string") {
    throw new Error(
      "OpenRouter returned no resume response.",
    );
  }

  const jsonText = extractJson(content);

  let parsed: unknown;

  try {
    parsed = JSON.parse(jsonText);
  } catch {
    console.error(
      "Invalid resume JSON:",
      content,
    );

    throw new Error(
      "OpenRouter returned invalid resume JSON.",
    );
  }

  const result = parsed as {
    tailored_text?: unknown;
    unsupported_claims?: unknown;
  };

  if (
    typeof result.tailored_text !== "string" ||
    !result.tailored_text.trim()
  ) {
    throw new Error(
      "OpenRouter did not return a tailored resume.",
    );
  }

  return {
    tailored_text: cleanResumeText(
      result.tailored_text,
    ),

    unsupported_claims: Array.isArray(
      result.unsupported_claims,
    )
      ? result.unsupported_claims.filter(
          (value): value is string =>
            typeof value === "string",
        )
      : [],
  };
}
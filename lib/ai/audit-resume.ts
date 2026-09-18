import { openrouter } from "@/lib/ai/openrouter";

export type ResumeAuditResult = {
  unsupported_claims: string[];
  suspicious_changes: string[];
};

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

export async function auditResume({
  baseResume,
  tailoredResume,
}: {
  baseResume: string;
  tailoredResume: string;
}): Promise<ResumeAuditResult> {
  const prompt = `
You are a STRICT resume factuality auditor.

Compare the ORIGINAL RESUME with the TAILORED RESUME.

Your ONLY job is to identify factual claims that appear in the
tailored resume but are NOT supported by the original resume.

IMPORTANT DISTINCTION:

Do NOT report job requirements that are merely missing from the resume.

Example:

Original resume:
"Python, SQL, AWS"

Job requires:
"React, Kubernetes"

That is NOT an unsupported claim.

Only report a problem if the TAILORED resume itself claims React or
Kubernetes experience.

Flag additions such as:

- a technology not supported by the original
- a framework not supported by the original
- a cloud service not supported by the original
- a certification not supported by the original
- an employer not supported by the original
- a project not supported by the original
- a responsibility not supported by the original
- a metric not supported by the original
- a year/date not supported by the original
- a specific implementation detail not supported by the original
- an exaggerated characterization that changes factual meaning

Do NOT flag:

- grammar improvements
- sentence rewording
- reordering existing information
- shorter versions of existing statements
- skills already explicitly present in the original resume
- facts that are clearly equivalent to information in the original

VERY IMPORTANT:

"REST APIs" in a technical-skills section does NOT automatically prove
that a specific project used REST APIs.

"SQL" does NOT automatically prove PostgreSQL.

"AWS" does NOT automatically prove a specific AWS service.

"Testing" does NOT automatically prove automated testing.

Return ONLY JSON:

{
  "unsupported_claims": [
    "Exact unsupported claim from the tailored resume"
  ],
  "suspicious_changes": [
    "Description of a factual change that deserves review"
  ]
}

ORIGINAL RESUME:
<original_resume>
${baseResume}
</original_resume>

TAILORED RESUME:
<tailored_resume>
${tailoredResume}
</tailored_resume>
`;

  const response =
    await openrouter.chat.completions.create({
      model: "inclusionai/ling-3.0-flash-fin:free",
      max_tokens: 3000,
      messages: [
        {
          role: "system",
          content:
            "You are a strict factuality auditor. Never assume facts that are not explicitly supported.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

  const content = response.choices[0]?.message?.content;

  if (!content || typeof content !== "string") {
    throw new Error("OpenRouter returned no audit response.");
  }

  const jsonText = extractJson(content);

  let parsed: unknown;

  try {
    parsed = JSON.parse(jsonText);
  } catch {
    console.error("Invalid audit response:", content);
    throw new Error(
      "OpenRouter returned invalid audit JSON.",
    );
  }

  const result = parsed as {
    unsupported_claims?: unknown;
    suspicious_changes?: unknown;
  };

  return {
    unsupported_claims: Array.isArray(
      result.unsupported_claims,
    )
      ? result.unsupported_claims.filter(
          (value): value is string =>
            typeof value === "string",
        )
      : [],

    suspicious_changes: Array.isArray(
      result.suspicious_changes,
    )
      ? result.suspicious_changes.filter(
          (value): value is string =>
            typeof value === "string",
        )
      : [],
  };
}
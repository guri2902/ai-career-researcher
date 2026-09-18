import { openrouter } from "@/lib/ai/openrouter";

export type ExtractedRequirements = {
  must_have_skills: string[];
  nice_to_have_skills: string[];
  years_experience: string | null;
  tools: string[];
  soft_skills: string[];
  seniority_level: string | null;
  ambiguous_requirements: string[];
};

export async function extractRequirements(
  jdText: string,
): Promise<ExtractedRequirements> {
  const response = await openrouter.chat.completions.create({
    model: "openrouter/free",

    messages: [
      {
        role: "system",
        content: `
You are an expert job-description analysis system.

Analyze job descriptions and extract only requirements that are explicitly
stated or strongly implied.

Do not invent technologies, skills, years of experience, responsibilities,
or qualifications.

Return ONLY valid JSON.

The JSON must contain exactly these keys:

{
  "must_have_skills": [],
  "nice_to_have_skills": [],
  "years_experience": null,
  "tools": [],
  "soft_skills": [],
  "seniority_level": null,
  "ambiguous_requirements": []
}

Rules:

must_have_skills:
Essential or explicitly required skills.

nice_to_have_skills:
Preferred, bonus, optional, or nice-to-have skills.

years_experience:
The required years of experience exactly or accurately summarized.
Use null when not specified.

tools:
Technologies, frameworks, platforms, software, cloud services and tools.

soft_skills:
Communication, leadership, collaboration, problem solving, etc.
Only include them when supported by the job description.

seniority_level:
Examples: junior, mid-level, senior, lead, manager.
Use null if unsupported.

ambiguous_requirements:
Vague, unclear, contradictory, or difficult-to-interpret requirements.
`,
      },
      {
        role: "user",
        content: `Analyze this job description:

<job_description>
${jdText}
</job_description>`,
      },
    ],

    response_format: {
      type: "json_object",
    },
  });

  const content = response.choices[0]?.message?.content;

  if (!content || typeof content !== "string") {
    throw new Error("OpenRouter returned an empty response.");
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("OpenRouter returned invalid JSON.");
  }

  const data = parsed as Partial<ExtractedRequirements>;

  return {
    must_have_skills: Array.isArray(data.must_have_skills)
      ? data.must_have_skills.filter(
          (value): value is string => typeof value === "string",
        )
      : [],

    nice_to_have_skills: Array.isArray(data.nice_to_have_skills)
      ? data.nice_to_have_skills.filter(
          (value): value is string => typeof value === "string",
        )
      : [],

    years_experience:
      typeof data.years_experience === "string"
        ? data.years_experience
        : null,

    tools: Array.isArray(data.tools)
      ? data.tools.filter(
          (value): value is string => typeof value === "string",
        )
      : [],

    soft_skills: Array.isArray(data.soft_skills)
      ? data.soft_skills.filter(
          (value): value is string => typeof value === "string",
        )
      : [],

    seniority_level:
      typeof data.seniority_level === "string"
        ? data.seniority_level
        : null,

    ambiguous_requirements: Array.isArray(
      data.ambiguous_requirements,
    )
      ? data.ambiguous_requirements.filter(
          (value): value is string => typeof value === "string",
        )
      : [],
  };
}
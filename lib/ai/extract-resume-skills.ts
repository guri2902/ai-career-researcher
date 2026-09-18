import { openrouter } from "@/lib/ai/openrouter";

export type ExtractedResumeSkill = {
  skill_name: string;
  evidence: string;
};

export async function extractResumeSkills(
  resumeText: string,
): Promise<ExtractedResumeSkill[]> {
  const response = await openrouter.chat.completions.create({
    model: "openrouter/free",
    messages: [
      {
        role: "system",
        content: `
You are a resume skill extraction engine.

Extract technical, professional, and role-relevant skills that are
actually supported by the resume.

Rules:
- Do not invent skills.
- Only extract skills supported by explicit resume evidence.
- Normalize obvious variations where appropriate.
  Example: "Amazon Web Services" -> "AWS".
- Do not extract generic words like "software", "work", or "experience".
- Include tools, technologies, frameworks, cloud platforms, databases,
  programming languages, DevOps tools, data tools, and relevant professional
  skills.
- Do not estimate proficiency.
- Return ONLY valid JSON.

Return exactly:

{
  "skills": [
    {
      "skill_name": "AWS",
      "evidence": "Used AWS EC2 and S3 in project..."
    }
  ]
}
`,
      },
      {
        role: "user",
        content: `Extract skills from this resume:

<resume>
${resumeText}
</resume>`,
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

  const data = parsed as {
    skills?: unknown;
  };

  if (!Array.isArray(data.skills)) {
    return [];
  }

  return data.skills.filter(
    (skill): skill is ExtractedResumeSkill =>
      typeof skill === "object" &&
      skill !== null &&
      typeof (skill as { skill_name?: unknown }).skill_name ===
        "string" &&
      typeof (skill as { evidence?: unknown }).evidence ===
        "string",
  );
}
import { openrouter } from "@/lib/ai/openrouter";

export type ProjectGenerationInput = {
  jobTitle: string;
  companyName: string;
  requirements: {
    must_have_skills: string[];
    nice_to_have_skills: string[];
    tools: string[];
    years_experience: string | null;
    seniority_level: string | null;
  };
  skillGaps: {
    required_skill: string;
    requirement_type: "must_have" | "nice_to_have";
    match_status: "matched" | "partial" | "missing";
    gap_type: "blocking" | "minor";
    match_score: number;
    covered_by_parent_requirement?: boolean;
  }[];
  candidateSkills: string[];
};

export type GeneratedProject = {
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
};

function cleanModelResponse(text: string): string {
  return text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function findBalancedJson(
  text: string,
  startIndex: number,
  openChar: string,
  closeChar: string,
): string | null {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = startIndex; i < text.length; i++) {
    const char = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === "\\") {
        escaped = true;
        continue;
      }

      if (char === '"') {
        inString = false;
      }

      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === openChar) {
      depth++;
      continue;
    }

    if (char === closeChar) {
      depth--;

      if (depth === 0) {
        return text.slice(startIndex, i + 1);
      }
    }
  }

  return null;
}

function tryParseJson(text: string): unknown | null {
  const cleaned = cleanModelResponse(text);

  // Case 1: model returned a JSON array.
  const arrayStart = cleaned.indexOf("[");
  if (arrayStart !== -1) {
    const arrayCandidate = findBalancedJson(
      cleaned,
      arrayStart,
      "[",
      "]",
    );

    if (arrayCandidate) {
      try {
        return JSON.parse(arrayCandidate);
      } catch {
        // Continue with cleanup attempts below.
        const repaired = arrayCandidate.replace(
          /,\s*([}\]])/g,
          "$1",
        );

        try {
          return JSON.parse(repaired);
        } catch {
          // Continue.
        }
      }
    }
  }

  // Case 2: model returned an object containing "projects".
  const objectStart = cleaned.indexOf("{");

  if (objectStart !== -1) {
    const objectCandidate = findBalancedJson(
      cleaned,
      objectStart,
      "{",
      "}",
    );

    if (objectCandidate) {
      try {
        const parsed = JSON.parse(objectCandidate);

        if (
          parsed &&
          typeof parsed === "object" &&
          "projects" in parsed
        ) {
          return (parsed as { projects: unknown }).projects;
        }
      } catch {
        const repaired = objectCandidate.replace(
          /,\s*([}\]])/g,
          "$1",
        );

        try {
          const parsed = JSON.parse(repaired);

          if (
            parsed &&
            typeof parsed === "object" &&
            "projects" in parsed
          ) {
            return (parsed as { projects: unknown }).projects;
          }
        } catch {
          // Continue.
        }
      }
    }
  }

  return null;
}

function extractJson(text: string): unknown {
  const parsed = tryParseJson(text);

  if (parsed !== null) {
    return parsed;
  }

  throw new Error("AI response contained invalid JSON.");
}

function validateProjects(value: unknown): GeneratedProject[] {
  if (!Array.isArray(value)) {
    throw new Error("AI project response must be an array.");
  }

  if (value.length < 3) {
    throw new Error(
      `AI generated only ${value.length} projects. Exactly 3 are required.`,
    );
  }

  return value.slice(0, 3).map((project, index) => {
    if (!project || typeof project !== "object") {
      throw new Error(`Project ${index + 1} is invalid.`);
    }

    const item = project as Record<string, unknown>;

    const requiredString = (field: string) => {
      const value = item[field];

      if (typeof value !== "string" || !value.trim()) {
        throw new Error(
          `Project ${index + 1} is missing "${field}".`,
        );
      }

      return value.trim();
    };

    const requiredStringArray = (field: string) => {
      const value = item[field];

      if (
        !Array.isArray(value) ||
        value.some((entry) => typeof entry !== "string")
      ) {
        throw new Error(
          `Project ${index + 1} has invalid "${field}".`,
        );
      }

      return value.map((entry) => entry.trim()).filter(Boolean);
    };

    const estimatedWeeks = item.estimated_weeks;

    if (
      typeof estimatedWeeks !== "number" ||
      !Number.isInteger(estimatedWeeks) ||
      estimatedWeeks < 1 ||
      estimatedWeeks > 12
    ) {
      throw new Error(
        `Project ${index + 1} has invalid "estimated_weeks".`,
      );
    }

    return {
      title: requiredString("title"),
      problem_statement: requiredString("problem_statement"),
      why_this_project: requiredString("why_this_project"),
      difficulty: requiredString("difficulty"),
      estimated_weeks: estimatedWeeks,

      target_skills: requiredStringArray("target_skills"),
      tech_stack: requiredStringArray("tech_stack"),

      features: requiredStringArray("features"),
      implementation_steps: requiredStringArray(
        "implementation_steps",
      ),
      deliverables: requiredStringArray("deliverables"),

      architecture: requiredString("architecture"),
      github_structure: requiredString("github_structure"),
      interview_value: requiredString("interview_value"),
    };
  });
}

function buildPrompt(
  input: ProjectGenerationInput,
  retry: boolean,
): string {
  const missingSkills = input.skillGaps
    .filter(
      (gap) =>
        gap.match_status === "missing" &&
        !gap.covered_by_parent_requirement,
    )
    .sort((a, b) => {
      const gapPriority = (
        gap: ProjectGenerationInput["skillGaps"][number],
      ) => (gap.gap_type === "blocking" ? 2 : 1);

      const requirementPriority = (
        gap: ProjectGenerationInput["skillGaps"][number],
      ) =>
        gap.requirement_type === "must_have"
          ? 2
          : 1;

      return (
        gapPriority(b) - gapPriority(a) ||
        requirementPriority(b) - requirementPriority(a) ||
        b.match_score - a.match_score
      );
    });

  const partialSkills = input.skillGaps.filter(
    (gap) =>
      gap.match_status === "partial" &&
      !gap.covered_by_parent_requirement,
  );

  const missingSkillNames = missingSkills.map(
    (gap) => gap.required_skill,
  );

  const partialSkillNames = partialSkills.map(
    (gap) => gap.required_skill,
  );

  return `
You are an expert career researcher and technical project architect.

Generate exactly 3 practical portfolio projects for a candidate targeting this job.

TARGET JOB
Title: ${input.jobTitle}
Company: ${input.companyName}

JOB REQUIREMENTS
Must-have skills:
${input.requirements.must_have_skills.join(", ") || "None"}

Nice-to-have skills:
${input.requirements.nice_to_have_skills.join(", ") || "None"}

Tools:
${input.requirements.tools.join(", ") || "None"}

Experience:
${input.requirements.years_experience || "Not specified"}

Seniority:
${input.requirements.seniority_level || "Not specified"}

CANDIDATE CURRENT SKILLS
${input.candidateSkills.join(", ") || "None"}

MISSING SKILLS
${missingSkillNames.join(", ") || "None"}

PARTIAL SKILLS
${partialSkillNames.join(", ") || "None"}

PROJECT REQUIREMENTS

- Generate exactly 3 projects.
- Prioritize missing blocking and must-have skills.
- Projects must be realistic for one developer.
- Projects must solve meaningful real-world problems.
- Do not generate generic to-do, calculator, weather, or basic CRUD projects.
- Projects should be substantial enough to discuss in technical interviews.
- Projects should collectively cover as many important skill gaps as practical.
- Use the candidate's existing skills as foundations where useful.
- You MAY introduce missing technologies because these projects are intended to close skill gaps.
- Do not claim the candidate has already built these projects.
- Treat every project as a FUTURE learning/portfolio project.
- Explain why each project is relevant to this specific job.
- Include a practical architecture.
- Include a realistic GitHub repository structure.
- Include ordered implementation steps.
- Include concrete deliverables.
- Estimated duration must be 1-12 weeks.
- Keep project scope realistic.
- Do not invent facts about the candidate.

${retry ? `
IMPORTANT:
Your previous response failed strict JSON validation.

This time:
- Return JSON and NOTHING ELSE.
- Do not use markdown.
- Do not use code fences.
- Do not add explanations before or after the JSON.
- Use double quotes for every JSON key and string.
- Do not use trailing commas.
- Ensure the JSON is syntactically valid before returning it.
` : ""}

RETURN FORMAT

Return ONLY this JSON array:

[
  {
    "title": "Project name",
    "problem_statement": "Real-world problem.",
    "why_this_project": "Why this project is relevant to the target job and closes skill gaps.",
    "difficulty": "Intermediate",
    "estimated_weeks": 4,
    "target_skills": [
      "Skill 1",
      "Skill 2"
    ],
    "tech_stack": [
      "Technology 1",
      "Technology 2"
    ],
    "features": [
      "Feature 1",
      "Feature 2",
      "Feature 3"
    ],
    "implementation_steps": [
      "Step 1",
      "Step 2",
      "Step 3"
    ],
    "deliverables": [
      "Deliverable 1",
      "Deliverable 2"
    ],
    "architecture": "System architecture explanation.",
    "github_structure": "Practical GitHub repository structure.",
    "interview_value": "Technical interview topics this project enables the candidate to discuss."
  }
]
`;
}

async function requestProjects(
  input: ProjectGenerationInput,
  retry: boolean,
): Promise<GeneratedProject[]> {
  const completion = await openrouter.chat.completions.create({
    model: "inclusionai/ling-3.0-flash-fin:free",
    messages: [
      {
        role: "system",
        content:
          "Return only valid JSON. No markdown. No code fences. No commentary.",
      },
      {
        role: "user",
        content: buildPrompt(input, retry),
      },
    ],
    temperature: retry ? 0.2 : 0.35,
    max_tokens: 7000,
  });

  const responseText =
    completion.choices?.[0]?.message?.content;

  if (!responseText || typeof responseText !== "string") {
    throw new Error(
      "OpenRouter returned no project generation response.",
    );
  }

  console.log(
    `Project generation attempt ${retry ? 2 : 1} response length:`,
    responseText.length,
  );

  const parsed = extractJson(responseText);

  return validateProjects(parsed);
}

export async function generateProjects(
  input: ProjectGenerationInput,
): Promise<GeneratedProject[]> {
  let firstError: Error | null = null;

  try {
    return await requestProjects(input, false);
  } catch (error) {
    firstError =
      error instanceof Error
        ? error
        : new Error("First project generation attempt failed.");

    console.warn(
      "First project generation attempt failed:",
      firstError.message,
    );
  }

  try {
    return await requestProjects(input, true);
  } catch (error) {
    const secondError =
      error instanceof Error
        ? error
        : new Error("Second project generation attempt failed.");

    console.error(
      "Second project generation attempt failed:",
      secondError.message,
    );

    throw new Error(
      `Project generation failed after 2 attempts. First error: ${firstError?.message ?? "unknown"}. Second error: ${secondError.message}`,
    );
  }
}
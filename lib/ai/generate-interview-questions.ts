import { openrouter } from "@/lib/ai/openrouter";

export type InterviewGenerationInput = {
  jobTitle: string;
  companyName: string;

  resumeText: string;

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

  projects: {
    id: string;
    title: string;
    problem_statement: string;
    target_skills: string[];
    tech_stack: string[];
    architecture: string;
    implementation_steps: string[];
    interview_value: string;
    status: string;
  }[];
};

export type GeneratedInterviewQuestion = {
  question: string;

  category:
    | "technical"
    | "project"
    | "behavioral"
    | "system_design"
    | "scenario";

  difficulty: "easy" | "medium" | "hard";

  target_skill: string;

  why_asked: string;

  ideal_answer: string;

  key_points: string[];

  follow_up_questions: string[];

  source_type:
    | "job_requirement"
    | "skill_gap"
    | "resume"
    | "project"
    | "mixed";
};

type BatchConfig = {
  name: string;
  count: number;
  category: GeneratedInterviewQuestion["category"];
  instruction: string;
};

const BATCHES: BatchConfig[] = [
  {
    name: "technical-1",
    count: 4,
    category: "technical",
    instruction:
      "Generate 4 technical questions focused on core job requirements, implementation concepts, and troubleshooting.",
  },
  {
    name: "technical-2",
    count: 4,
    category: "technical",
    instruction:
      "Generate 4 technical questions focused on missing/partial skills, debugging, trade-offs, and deeper implementation concepts.",
  },
  {
    name: "system-design",
    count: 4,
    category: "system_design",
    instruction:
      "Generate 4 system design questions based on realistic systems relevant to this role.",
  },
  {
    name: "scenario",
    count: 4,
    category: "scenario",
    instruction:
      "Generate 4 realistic production/scenario questions involving incidents, debugging, scaling, failures, or operational trade-offs.",
  },
  {
    name: "project",
    count: 4,
    category: "project",
    instruction:
      "Generate 4 project-focused questions using only the supplied project context. Cover architecture, implementation, testing, deployment, scalability, and trade-offs.",
  },
  {
    name: "behavioral",
    count: 4,
    category: "behavioral",
    instruction:
      "Generate 4 behavioral questions grounded in the candidate's supplied resume experience. Prefer STAR-style prompts.",
  },
];

function cleanModelResponse(text: string): string {
  return text
    .trim()
    .replace(/^\uFEFF/, "")
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

function repairJsonText(text: string): string {
  return text
    .replace(/^\uFEFF/, "")
    .replace(/,\s*([}\]])/g, "$1")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .trim();
}

function tryParseJson(text: string): unknown | null {
  const cleaned = cleanModelResponse(text);

  // First try the whole response directly.
  try {
    return JSON.parse(cleaned);
  } catch {
    // Continue with extraction.
  }

  // Try a balanced JSON array.
  const arrayStart = cleaned.indexOf("[");

  if (arrayStart !== -1) {
    const candidate = findBalancedJson(
      cleaned,
      arrayStart,
      "[",
      "]",
    );

    if (candidate) {
      try {
        return JSON.parse(candidate);
      } catch {
        try {
          return JSON.parse(repairJsonText(candidate));
        } catch {
          // Continue.
        }
      }
    }
  }

  // Try an object containing { questions: [...] }.
  const objectStart = cleaned.indexOf("{");

  if (objectStart !== -1) {
    const candidate = findBalancedJson(
      cleaned,
      objectStart,
      "{",
      "}",
    );

    if (candidate) {
      try {
        const parsed = JSON.parse(candidate);

        if (
          parsed &&
          typeof parsed === "object" &&
          "questions" in parsed
        ) {
          return (
            parsed as {
              questions: unknown;
            }
          ).questions;
        }
      } catch {
        try {
          const repaired = repairJsonText(candidate);
          const parsed = JSON.parse(repaired);

          if (
            parsed &&
            typeof parsed === "object" &&
            "questions" in parsed
          ) {
            return (
              parsed as {
                questions: unknown;
              }
            ).questions;
          }
        } catch {
          // Continue.
        }
      }
    }
  }

  // Last-resort support for a response that contains multiple
  // JSON objects without a wrapping array.
  const objects: string[] = [];
  let cursor = 0;

  while (cursor < cleaned.length) {
    const nextObject = cleaned.indexOf("{", cursor);

    if (nextObject === -1) {
      break;
    }

    const candidate = findBalancedJson(
      cleaned,
      nextObject,
      "{",
      "}",
    );

    if (!candidate) {
      break;
    }

    objects.push(candidate);
    cursor = nextObject + candidate.length;
  }

  if (objects.length > 0) {
    const parsedObjects: unknown[] = [];

    for (const objectText of objects) {
      try {
        parsedObjects.push(JSON.parse(objectText));
      } catch {
        try {
          parsedObjects.push(
            JSON.parse(
              repairJsonText(objectText),
            ),
          );
        } catch {
          return null;
        }
      }
    }

    if (parsedObjects.length > 0) {
      return parsedObjects;
    }
  }

  return null;
}

function extractJson(text: string): unknown {
  const parsed = tryParseJson(text);

  if (parsed !== null) {
    return parsed;
  }

  throw new Error(
    "AI response contained invalid interview-question JSON.",
  );
}

function normalizeCategory(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  const aliases: Record<string, string> = {
    technical: "technical",
    tech: "technical",
    technical_question: "technical",
    technical_questions: "technical",

    project: "project",
    projects: "project",
    project_question: "project",
    project_questions: "project",

    behavioral: "behavioral",
    behaviour: "behavioral",
    behavioural: "behavioral",
    behavioral_question: "behavioral",
    behavioral_questions: "behavioral",

    system_design: "system_design",
    systemdesign: "system_design",
    system_design_question: "system_design",
    architecture: "system_design",
    architecture_question: "system_design",

    scenario: "scenario",
    scenarios: "scenario",
    scenario_question: "scenario",
    troubleshooting: "scenario",
    situational: "scenario",
    situational_question: "scenario",
  };

  return aliases[normalized] ?? normalized;
}

function normalizeDifficulty(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  if (
    normalized === "easy" ||
    normalized === "beginner"
  ) {
    return "easy";
  }

  if (
    normalized === "hard" ||
    normalized === "advanced" ||
    normalized === "difficult"
  ) {
    return "hard";
  }

  return "medium";
}

function normalizeSourceType(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  const aliases: Record<string, string> = {
    job_requirement: "job_requirement",
    job_requirements: "job_requirement",
    requirement: "job_requirement",
    requirements: "job_requirement",
    jd: "job_requirement",
    job_description: "job_requirement",

    skill_gap: "skill_gap",
    skill_gaps: "skill_gap",
    gap: "skill_gap",
    missing_skill: "skill_gap",
    missing_skills: "skill_gap",

    resume: "resume",
    candidate_resume: "resume",
    candidate_profile: "resume",
    experience: "resume",
    work_experience: "resume",

    project: "project",
    projects: "project",
    project_context: "project",

    mixed: "mixed",
    multiple: "mixed",
    combined: "mixed",

    certification: "mixed",
    certifications: "mixed",
    certificate: "mixed",
    technology: "job_requirement",
    tool: "job_requirement",
    education: "resume",
  };

  return aliases[normalized] ?? "mixed";
}

function validateQuestions(
  value: unknown,
  expectedCount: number,
): GeneratedInterviewQuestion[] {
  if (!Array.isArray(value)) {
    throw new Error(
      "AI interview response must be a JSON array.",
    );
  }

  if (value.length !== expectedCount) {
    throw new Error(
      `AI generated ${value.length} questions; expected ${expectedCount}.`,
    );
  }

  const allowedCategories = new Set([
    "technical",
    "project",
    "behavioral",
    "system_design",
    "scenario",
  ]);

  const allowedDifficulties = new Set([
    "easy",
    "medium",
    "hard",
  ]);

  const allowedSources = new Set([
    "job_requirement",
    "skill_gap",
    "resume",
    "project",
    "mixed",
  ]);

  const requiredString = (
    item: Record<string, unknown>,
    field: string,
    index: number,
  ) => {
    const value = item[field];

    if (
      typeof value !== "string" ||
      !value.trim()
    ) {
      throw new Error(
        `Question ${index + 1} is missing "${field}".`,
      );
    }

    return value.trim();
  };

  const requiredStringArray = (
    item: Record<string, unknown>,
    field: string,
    index: number,
  ) => {
    const value = item[field];

    if (
      !Array.isArray(value) ||
      value.some(
        (entry) => typeof entry !== "string",
      )
    ) {
      throw new Error(
        `Question ${index + 1} has invalid "${field}".`,
      );
    }

    return value
      .map((entry) => entry.trim())
      .filter(Boolean);
  };

  return value.map((question, index) => {
    if (
      !question ||
      typeof question !== "object"
    ) {
      throw new Error(
        `Question ${index + 1} is invalid.`,
      );
    }

    const item =
      question as Record<string, unknown>;

    const rawCategory = requiredString(
      item,
      "category",
      index,
    );

    const category =
      normalizeCategory(rawCategory);

    const rawDifficulty = requiredString(
      item,
      "difficulty",
      index,
    );

    const difficulty =
      normalizeDifficulty(rawDifficulty);

    const rawSourceType = requiredString(
      item,
      "source_type",
      index,
    );

    const sourceType =
      normalizeSourceType(rawSourceType);

    if (!allowedCategories.has(category)) {
      throw new Error(
        `Question ${index + 1} has invalid category "${rawCategory}".`,
      );
    }

    if (!allowedDifficulties.has(difficulty)) {
      throw new Error(
        `Question ${index + 1} has invalid difficulty "${rawDifficulty}".`,
      );
    }

    if (!allowedSources.has(sourceType)) {
      throw new Error(
        `Question ${index + 1} has invalid source_type "${rawSourceType}".`,
      );
    }

    return {
      question: requiredString(
        item,
        "question",
        index,
      ),

      category:
        category as GeneratedInterviewQuestion["category"],

      difficulty:
        difficulty as GeneratedInterviewQuestion["difficulty"],

      target_skill: requiredString(
        item,
        "target_skill",
        index,
      ),

      why_asked: requiredString(
        item,
        "why_asked",
        index,
      ),

      ideal_answer: requiredString(
        item,
        "ideal_answer",
        index,
      ),

      key_points: requiredStringArray(
        item,
        "key_points",
        index,
      ),

      follow_up_questions:
        requiredStringArray(
          item,
          "follow_up_questions",
          index,
        ),

      source_type:
        sourceType as GeneratedInterviewQuestion["source_type"],
    };
  });
}

function applyBatchCategory(
  questions: GeneratedInterviewQuestion[],
  batch: BatchConfig,
): GeneratedInterviewQuestion[] {
  return questions.map((question) => ({
    ...question,
    category: batch.category,
  }));
}

function getMissingSkills(
  input: InterviewGenerationInput,
) {
  return input.skillGaps
    .filter(
      (gap) =>
        gap.match_status === "missing" &&
        !gap.covered_by_parent_requirement,
    )
    .sort((a, b) => {
      const gapPriority = (
        gap: InterviewGenerationInput["skillGaps"][number],
      ) =>
        gap.gap_type === "blocking" ? 2 : 1;

      const requirementPriority = (
        gap: InterviewGenerationInput["skillGaps"][number],
      ) =>
        gap.requirement_type === "must_have"
          ? 2
          : 1;

      return (
        gapPriority(b) - gapPriority(a) ||
        requirementPriority(b) -
          requirementPriority(a) ||
        b.match_score - a.match_score
      );
    });
}

function getPartialSkills(
  input: InterviewGenerationInput,
) {
  return input.skillGaps.filter(
    (gap) =>
      gap.match_status === "partial" &&
      !gap.covered_by_parent_requirement,
  );
}

function buildProjectText(
  input: InterviewGenerationInput,
) {
  return input.projects
    .slice(0, 5)
    .map(
      (project, index) => `
PROJECT ${index + 1}
Title: ${project.title}
Status: ${project.status}
Target skills: ${project.target_skills.join(", ")}
Tech stack: ${project.tech_stack.join(", ")}
Problem: ${project.problem_statement}
Architecture: ${project.architecture}
Interview value: ${project.interview_value}
`,
    )
    .join("\n");
}

function buildPrompt(
  input: InterviewGenerationInput,
  batch: BatchConfig,
  retry: boolean,
) {
  const missingSkills = getMissingSkills(input);
  const partialSkills = getPartialSkills(input);

  const categoryLabel =
    batch.category === "system_design"
      ? "system design"
      : batch.category;

  return `
You are an expert technical interviewer.

Generate exactly ${batch.count} ${categoryLabel} interview questions.

BATCH PURPOSE
${batch.instruction}

TARGET JOB
Title: ${input.jobTitle}
Company: ${input.companyName}

JOB REQUIREMENTS

Must-have:
${input.requirements.must_have_skills.join(", ") || "None"}

Nice-to-have:
${input.requirements.nice_to_have_skills.join(", ") || "None"}

Tools:
${input.requirements.tools.join(", ") || "None"}

Experience:
${input.requirements.years_experience || "Not specified"}

Seniority:
${input.requirements.seniority_level || "Not specified"}

CANDIDATE RESUME

${input.resumeText}

MISSING SKILLS

${
  missingSkills
    .map((gap) => gap.required_skill)
    .join(", ") || "None"
}

PARTIAL SKILLS

${
  partialSkills
    .map((gap) => gap.required_skill)
    .join(", ") || "None"
}

PROJECTS

${buildProjectText(input) || "No projects available."}

QUESTION RULES

1. Make every question specific to this job.
2. Avoid generic filler.
3. Do not duplicate questions.
4. Do not invent candidate experience.
5. Resume questions must reference only supplied resume facts.
6. Project questions must reference only supplied project information.
7. Missing skills can be tested as knowledge or hypothetical scenarios, but do not claim the candidate already has them.
8. Behavioral questions should use supplied resume experience where possible.
9. System design questions should describe realistic engineering systems.
10. Scenario questions should describe realistic production situations.
11. Technical questions should test concepts, implementation, debugging, trade-offs, and troubleshooting.
12. Project questions should test architecture, implementation, testing, deployment, scalability, and trade-offs.
13. Keep ideal answers practical rather than overly long.
14. key_points must contain exactly 3 concise points.
15. follow_up_questions must contain exactly 2 concise follow-ups.
16. Use mixed difficulty across the batch.
17. target_skill must be one concrete skill, requirement, tool, or capability relevant to the question.

SOURCE TYPE RULES

source_type MUST be exactly one of:

"job_requirement"
"skill_gap"
"resume"
"project"
"mixed"

Never use any other value.

Use:
- job_requirement for questions primarily based on explicit job requirements.
- skill_gap for questions probing missing or partial skills.
- resume for questions grounded in candidate resume experience.
- project for questions grounded in supplied project information.
- mixed when multiple sources contribute.

CATEGORY RULE

Every object in this batch MUST use:

"${batch.category}"

${retry ? `
The previous response could not be parsed as valid JSON.

Return ONLY the JSON array.
Do not use markdown.
Do not use code fences.
Do not include commentary.
Do not include explanatory text.
Do not truncate the response.
` : ""}

RETURN EXACTLY ${batch.count} OBJECTS.

[
  {
    "question": "Question text",
    "category": "${batch.category}",
    "difficulty": "medium",
    "target_skill": "AWS",
    "why_asked": "Why this is relevant to this role.",
    "ideal_answer": "What a strong answer should cover.",
    "key_points": [
      "Point 1",
      "Point 2",
      "Point 3"
    ],
    "follow_up_questions": [
      "Follow-up 1",
      "Follow-up 2"
    ],
    "source_type": "job_requirement"
  }
]
`;
}

async function requestBatch(
  input: InterviewGenerationInput,
  batch: BatchConfig,
  retry: boolean,
): Promise<GeneratedInterviewQuestion[]> {
  const completion =
    await openrouter.chat.completions.create({
      model:
        "inclusionai/ling-3.0-flash-fin:free",

      messages: [
        {
          role: "system",
          content:
            "Return ONLY valid JSON. Do not use markdown. Do not add commentary.",
        },
        {
          role: "user",
          content: buildPrompt(
            input,
            batch,
            retry,
          ),
        },
      ],

      temperature: retry ? 0.1 : 0.2,

      // Smaller batches need substantially fewer tokens.
      max_tokens: 4800,
    });

  const responseText =
    completion.choices?.[0]?.message?.content;

  if (
    !responseText ||
    typeof responseText !== "string"
  ) {
    throw new Error(
      `OpenRouter returned no response for ${batch.name}.`,
    );
  }

  console.log(
    `Interview ${batch.name} attempt ${
      retry ? 2 : 1
    } response length: ${responseText.length}`,
  );

  const parsed = extractJson(responseText);

  const questions = validateQuestions(
    parsed,
    batch.count,
  );

  return applyBatchCategory(
    questions,
    batch,
  );
}

async function requestBatchWithRetry(
  input: InterviewGenerationInput,
  batch: BatchConfig,
) {
  try {
    return await requestBatch(
      input,
      batch,
      false,
    );
  } catch (firstError) {
    console.warn(
      `${batch.name} batch failed on first attempt:`,
      firstError instanceof Error
        ? firstError.message
        : firstError,
    );

    try {
      return await requestBatch(
        input,
        batch,
        true,
      );
    } catch (secondError) {
      throw new Error(
        `${batch.name} batch failed after 2 attempts. First error: ${
          firstError instanceof Error
            ? firstError.message
            : "unknown"
        }. Second error: ${
          secondError instanceof Error
            ? secondError.message
            : "unknown"
        }`,
      );
    }
  }
}

export async function generateInterviewQuestions(
  input: InterviewGenerationInput,
): Promise<GeneratedInterviewQuestion[]> {
  const results: GeneratedInterviewQuestion[] =
    [];

  for (const batch of BATCHES) {
    console.log(
      `Generating interview batch: ${batch.name}`,
    );

    const batchQuestions =
      await requestBatchWithRetry(
        input,
        batch,
      );

    results.push(...batchQuestions);
  }

  if (results.length !== 24) {
    throw new Error(
      `Interview generator produced ${results.length} questions instead of 24.`,
    );
  }

  return results;
}
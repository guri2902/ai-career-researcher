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
  categories: GeneratedInterviewQuestion["category"][];
};

const BATCHES: BatchConfig[] = [
  {
    name: "technical",
    count: 8,
    categories: ["technical"],
  },
  {
    name: "system-and-scenario",
    count: 8,
    categories: ["system_design", "scenario"],
  },
  {
    name: "project-and-behavioral",
    count: 8,
    categories: ["project", "behavioral"],
  },
];

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

  // Direct array
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
        const repaired = candidate.replace(
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

  // Object containing questions
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
        const repaired = candidate.replace(
          /,\s*([}\]])/g,
          "$1",
        );

        try {
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
        (entry) =>
          typeof entry !== "string",
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

    const category = requiredString(
      item,
      "category",
      index,
    );

    const difficulty = requiredString(
      item,
      "difficulty",
      index,
    );

    const sourceType = requiredString(
      item,
      "source_type",
      index,
    );

    if (!allowedCategories.has(category)) {
      throw new Error(
        `Question ${index + 1} has invalid category "${category}".`,
      );
    }

    if (!allowedDifficulties.has(difficulty)) {
      throw new Error(
        `Question ${index + 1} has invalid difficulty "${difficulty}".`,
      );
    }

    if (!allowedSources.has(sourceType)) {
      throw new Error(
        `Question ${index + 1} has invalid source_type "${sourceType}".`,
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

  const categoryInstructions =
    batch.categories.length === 1
      ? `
Generate only ${batch.categories[0]} questions.
`
      : `
Generate questions across these categories:
${batch.categories.join(", ")}

Aim for:
- 4 system_design
- 4 scenario
for the second batch.

Aim for:
- 4 project
- 4 behavioral
for the third batch.
`;

  return `
You are an expert technical interviewer.

Generate exactly ${batch.count} interview questions for this candidate and job.

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

${categoryInstructions}

QUESTION RULES

1. Make every question specific to this job.
2. Avoid generic filler.
3. Do not duplicate questions.
4. Do not invent candidate experience.
5. Resume questions must reference facts actually supplied in the resume.
6. Project questions must reference only supplied projects.
7. Missing skills may be tested as technical knowledge or hypothetical scenarios.
8. Clearly distinguish current experience from skills being developed.
9. Behavioral questions should use real resume experience where possible.
10. System-design questions should reflect realistic engineering systems.
11. Scenario questions should involve realistic production situations.
12. Technical questions should test concepts, implementation, debugging, trade-offs, and troubleshooting.
13. Project questions should test architecture, implementation, testing, deployment, scalability, and trade-offs.
14. Keep answers concise enough for practical interview preparation.
15. ideal_answer should explain what a strong answer should cover; do not fabricate experience.
16. key_points should contain 3-4 concise points.
17. follow_up_questions should contain exactly 2 useful follow-ups.
18. Use mixed difficulty across the batch.
19. Do not mention that the candidate "has experience" with a missing skill.

${retry ? `
The previous attempt returned invalid JSON.

Return ONLY valid JSON.
No markdown.
No code fences.
No text before the JSON.
No text after the JSON.
No trailing commas.
Use double quotes everywhere.
` : ""}

RETURN EXACTLY ${batch.count} OBJECTS IN THIS JSON ARRAY:

[
  {
    "question": "Question text",
    "category": "technical",
    "difficulty": "medium",
    "target_skill": "AWS",
    "why_asked": "Why this is relevant.",
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
            "Return only valid JSON. No markdown. No commentary.",
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

      temperature: retry ? 0.15 : 0.3,
      max_tokens: 5000,
    });

  const responseText =
    completion.choices?.[0]?.message?.content;

  if (
    !responseText ||
    typeof responseText !== "string"
  ) {
    throw new Error(
      `OpenRouter returned no response for ${batch.name} questions.`,
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

  // Make sure the model actually followed the
  // requested category distribution.
  if (batch.name === "technical") {
    const invalid = questions.some(
      (question) =>
        question.category !== "technical",
    );

    if (invalid) {
      throw new Error(
        "Technical batch contained non-technical questions.",
      );
    }
  }

  if (batch.name === "system-and-scenario") {
    const systemCount =
      questions.filter(
        (question) =>
          question.category ===
          "system_design",
      ).length;

    const scenarioCount =
      questions.filter(
        (question) =>
          question.category ===
          "scenario",
      ).length;

    if (
      systemCount !== 4 ||
      scenarioCount !== 4
    ) {
      throw new Error(
        `System/scenario batch had ${systemCount} system-design and ${scenarioCount} scenario questions; expected 4/4.`,
      );
    }
  }

  if (
    batch.name ===
    "project-and-behavioral"
  ) {
    const projectCount =
      questions.filter(
        (question) =>
          question.category === "project",
      ).length;

    const behavioralCount =
      questions.filter(
        (question) =>
          question.category ===
          "behavioral",
      ).length;

    if (
      projectCount !== 4 ||
      behavioralCount !== 4
    ) {
      throw new Error(
        `Project/behavioral batch had ${projectCount} project and ${behavioralCount} behavioral questions; expected 4/4.`,
      );
    }
  }

  return questions;
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
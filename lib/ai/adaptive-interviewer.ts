import { openrouter } from "@/lib/ai/openrouter";

export type AdaptiveAction =
  | "follow_up"
  | "deep_dive"
  | "challenge"
  | "switch_topic"
  | "project_probe"
  | "behavioral_pivot";

export type AdaptiveQuestion = {
  action: AdaptiveAction;
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

type HistoryItem = {
  question: string;
  category: string;
  target_skill: string;
  answer: string;
  overall_score: number;
  missing_concepts: string[];
};

export type AdaptiveInterviewInput = {
  currentQuestion: {
    question: string;
    category: string;
    difficulty: string;
    target_skill: string;
  };

  answer: string;

  score: {
    correctness_score: number;
    structure_score: number;
    specificity_score: number;
    communication_score: number;
    overall_score: number;
    missing_concepts: string[];
  };

  history: HistoryItem[];

  availableTopics: string[];

  projects: {
    title: string;
    status: string;
    target_skills: string[];
    tech_stack: string[];
    architecture: string;
  }[];
};

function extractJson(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");

    if (start === -1) {
      throw new Error("No JSON object found.");
    }

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = start; i < cleaned.length; i++) {
      const char = cleaned[i];

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

      if (char === "{") {
        depth++;
      }

      if (char === "}") {
        depth--;

        if (depth === 0) {
          return JSON.parse(cleaned.slice(start, i + 1));
        }
      }
    }

    throw new Error("Could not parse adaptive interviewer JSON.");
  }
}

function normalizeAction(value: unknown): AdaptiveAction {
  const allowed: AdaptiveAction[] = [
    "follow_up",
    "deep_dive",
    "challenge",
    "switch_topic",
    "project_probe",
    "behavioral_pivot",
  ];

  return allowed.includes(value as AdaptiveAction)
    ? (value as AdaptiveAction)
    : "switch_topic";
}

function normalizeCategory(value: unknown) {
  const allowed = [
    "technical",
    "project",
    "behavioral",
    "system_design",
    "scenario",
  ] as const;

  return allowed.includes(value as (typeof allowed)[number])
    ? value
    : "technical";
}

function normalizeDifficulty(value: unknown) {
  const allowed = ["easy", "medium", "hard"] as const;

  return allowed.includes(value as (typeof allowed)[number])
    ? value
    : "medium";
}

function normalizeSourceType(value: unknown): AdaptiveQuestion["source_type"] {
  const allowed: AdaptiveQuestion["source_type"][] = [
    "job_requirement",
    "skill_gap",
    "resume",
    "project",
    "mixed",
  ];

  return allowed.includes(value as AdaptiveQuestion["source_type"])
    ? (value as AdaptiveQuestion["source_type"])
    : "mixed";
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : fallback;
}

function stringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 5);
}

export async function generateAdaptiveQuestion(
  input: AdaptiveInterviewInput,
): Promise<AdaptiveQuestion> {
  const projectsText =
    input.projects.length > 0
      ? input.projects
          .slice(0, 6)
          .map(
            (project) => `
Project: ${project.title}
Status: ${project.status}
Skills: ${project.target_skills.join(", ")}
Tech: ${project.tech_stack.join(", ")}
Architecture: ${project.architecture}
`,
          )
          .join("\n")
      : "No projects available.";

  const historyText =
    input.history.length > 0
      ? input.history
          .slice(-6)
          .map(
            (item, index) => `
TURN ${index + 1}
Question: ${item.question}
Category: ${item.category}
Skill: ${item.target_skill}
Answer: ${item.answer}
Score: ${item.overall_score}
Missing concepts: ${item.missing_concepts.join(", ") || "None"}
`,
          )
          .join("\n")
      : "No previous interview history.";

  const prompt = `
You are an adaptive technical interviewer.

You are not following a fixed question list.

After every answer you must decide what the interviewer should do next.

CURRENT QUESTION
${input.currentQuestion.question}

CATEGORY
${input.currentQuestion.category}

DIFFICULTY
${input.currentQuestion.difficulty}

TARGET SKILL
${input.currentQuestion.target_skill}

CANDIDATE ANSWER
${input.answer}

ANSWER SCORE
Overall: ${input.score.overall_score}
Correctness: ${input.score.correctness_score}
Structure: ${input.score.structure_score}
Specificity: ${input.score.specificity_score}
Communication: ${input.score.communication_score}

MISSING CONCEPTS
${input.score.missing_concepts.join(", ") || "None"}

PREVIOUS INTERVIEW HISTORY
${historyText}

AVAILABLE TOPICS
${input.availableTopics.join(", ") || "Use the job requirements and current topic."}

PROJECTS
${projectsText}

INTERVIEW BEHAVIOR

Choose one action:

follow_up
Use this when the candidate's answer is incomplete and one missing detail can be explored.

deep_dive
Use this when the candidate demonstrated understanding and you want to test implementation detail or trade-offs.

challenge
Use this when you want to challenge an assumption, introduce a failure case, or test the candidate's reasoning under pressure.

switch_topic
Use this when the current topic has been sufficiently explored or another important topic should now be tested.

project_probe
Use this when a project is relevant. IMPORTANT: if the project status indicates planned, recommended, proposed, or not completed, ask a hypothetical/project-design question. Never imply the candidate completed it.

behavioral_pivot
Use this to move into behavioral/experience discussion after sufficient technical exploration.

IMPORTANT:

- Do not repeat a question already asked.
- A follow-up should clearly connect to the candidate's actual answer.
- Cross-question specific claims the candidate made.
- If the candidate says "I used X", you may ask how X was configured, debugged, secured or deployed.
- Do not invent candidate experience.
- Missing skills can be tested as hypothetical knowledge.
- Project status must be respected.
- Switch topics when appropriate. Do not stay on one skill forever.
- Keep the question interview-realistic.
- The next question should normally be harder when the previous answer was strong.
- The next question can be simpler when the previous answer was weak or incomplete.
- Do not mention the scoring system to the candidate.

Return ONLY JSON:

{
  "action": "follow_up",
  "question": "Next interview question",
  "category": "technical",
  "difficulty": "medium",
  "target_skill": "AWS",
  "why_asked": "Why the interviewer is asking this now.",
  "ideal_answer": "What a strong answer should cover.",
  "key_points": [
    "Point 1",
    "Point 2",
    "Point 3"
  ],
  "follow_up_questions": [
    "Possible follow-up 1",
    "Possible follow-up 2"
  ],
  "source_type": "mixed"
}
`;

  const completion = await openrouter.chat.completions.create({
    model: "inclusionai/ling-3.0-flash-fin:free",
    messages: [
      {
        role: "system",
        content:
          "You are an adaptive interviewer. Return ONLY valid JSON.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0.25,
    max_tokens: 1800,
  });

  const responseText = completion.choices?.[0]?.message?.content;

  if (!responseText || typeof responseText !== "string") {
    throw new Error("OpenRouter returned no adaptive question.");
  }

  const parsed = extractJson(responseText) as Record<string, unknown>;

  return {
    action: normalizeAction(parsed.action),

    question: stringValue(
      parsed.question,
      "Let's go one level deeper. How would you implement this in a production environment?",
    ),

    category: normalizeCategory(parsed.category) as AdaptiveQuestion["category"],

    difficulty: normalizeDifficulty(
      parsed.difficulty,
    ) as AdaptiveQuestion["difficulty"],

    target_skill: stringValue(
      parsed.target_skill,
      input.currentQuestion.target_skill,
    ),

    why_asked: stringValue(
      parsed.why_asked,
      "This question follows from your previous answer and tests the same area more deeply.",
    ),

    ideal_answer: stringValue(
      parsed.ideal_answer,
      "A strong answer should explain the concept, implementation approach, trade-offs and failure handling.",
    ),

    key_points: stringArray(parsed.key_points, [
      "Explain the core concept clearly.",
      "Describe a practical implementation.",
      "Discuss trade-offs or failure handling.",
    ]),

    follow_up_questions: stringArray(parsed.follow_up_questions, []),

    source_type: normalizeSourceType(parsed.source_type),
  };
}
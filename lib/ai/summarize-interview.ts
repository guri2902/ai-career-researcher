import { openrouter } from "@/lib/ai/openrouter";

export type InterviewSummaryInput = {
  jobTitle: string;
  companyName: string;
  totalQuestions: number;
  answeredQuestions: number;
  skippedQuestions: number;

  overallScore: number;

  topicPerformance: {
    skill: string;
    questions: number;
    averageScore: number;
  }[];

  answers: {
    question: string;
    category: string;
    targetSkill: string;
    score: number;
    feedback: string;
  }[];
};

export type InterviewSummaryResult = {
  summary: string;
  strengths: string[];
  weaknesses: string[];
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
      throw new Error(
        "No JSON object found in interview summary response.",
      );
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
          return JSON.parse(
            cleaned.slice(start, i + 1),
          );
        }
      }
    }

    throw new Error(
      "Could not parse interview summary JSON.",
    );
  }
}

function stringValue(
  value: unknown,
  fallback: string,
): string {
  return typeof value === "string" &&
    value.trim()
    ? value.trim()
    : fallback;
}

function stringArray(
  value: unknown,
  fallback: string[],
): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return value
    .filter(
      (item): item is string =>
        typeof item === "string",
    )
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 6);
}

export async function summarizeInterview(
  input: InterviewSummaryInput,
): Promise<InterviewSummaryResult> {
  const topicText =
    input.topicPerformance.length > 0
      ? input.topicPerformance
          .map(
            (topic) =>
              `${topic.skill}: ${topic.averageScore.toFixed(
                2,
              )}/5 across ${topic.questions} question(s)`,
          )
          .join("\n")
      : "No topic data available.";

  const answerText =
    input.answers.length > 0
      ? input.answers
          .slice(-12)
          .map(
            (answer, index) => `
QUESTION ${index + 1}
Category: ${answer.category}
Skill: ${answer.targetSkill}
Question: ${answer.question}
Score: ${answer.score.toFixed(2)}/5
Feedback: ${answer.feedback}
`,
          )
          .join("\n")
      : "No answered questions.";

  const prompt = `
You are preparing a professional mock-interview performance report.

JOB
Title: ${input.jobTitle}
Company: ${input.companyName}

INTERVIEW
Total questions: ${input.totalQuestions}
Answered: ${input.answeredQuestions}
Skipped: ${input.skippedQuestions}
Overall score: ${input.overallScore.toFixed(2)}/5

TOPIC PERFORMANCE
${topicText}

ANSWER FEEDBACK
${answerText}

Return ONLY JSON:

{
  "summary": "A concise professional summary of the candidate's interview performance.",
  "strengths": [
    "Specific demonstrated strength",
    "Specific demonstrated strength"
  ],
  "weaknesses": [
    "Specific area needing improvement",
    "Specific area needing improvement"
  ]
}

Rules:

1. Base conclusions only on the provided interview data.
2. Do not invent candidate experience.
3. Do not claim the candidate knows a technology simply because it was asked.
4. Distinguish weak knowledge from weak communication.
5. Mention strong topics only when the scores support them.
6. Mention weak topics only when the scores or repeated feedback support them.
7. Keep the summary practical and useful for interview preparation.
8. Do not use generic praise.
`;

  const completion =
    await openrouter.chat.completions.create({
      model:
        "inclusionai/ling-3.0-flash-fin:free",

      messages: [
        {
          role: "system",
          content:
            "Return only valid JSON.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],

      temperature: 0.2,

      max_tokens: 1800,
    });

  const responseText =
    completion.choices?.[0]?.message?.content;

  if (
    !responseText ||
    typeof responseText !== "string"
  ) {
    throw new Error(
      "OpenRouter returned no interview summary.",
    );
  }

  const parsed =
    extractJson(responseText) as Record<
      string,
      unknown
    >;

  return {
    summary: stringValue(
      parsed.summary,
      "The interview was completed and performance was evaluated across the answered topics.",
    ),

    strengths: stringArray(
      parsed.strengths,
      [
        "Completed interview responses were evaluated across multiple technical areas.",
      ],
    ),

    weaknesses: stringArray(
      parsed.weaknesses,
      [
        "Review the lowest-scoring topics and the corresponding answer feedback.",
      ],
    ),
  };
}
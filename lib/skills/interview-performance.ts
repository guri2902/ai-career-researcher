export type InterviewSkillAnswer = {
  skill_name: string;

  overall_score: number;

  correctness_score: number | null;

  structure_score: number | null;

  specificity_score: number | null;

  communication_score: number | null;

  feedback: string | null;
};

export type InterviewSkillPerformance = {
  skill_name: string;

  question_count: number;

  average_score: number;

  correctness_score: number;

  structure_score: number;

  specificity_score: number;

  communication_score: number;

  performance_level:
    | "strong"
    | "developing"
    | "weak"
    | "insufficient";

  evidence_summary: string;

  strengths: string[];

  weaknesses: string[];
};

function average(
  values: number[],
): number {
  if (values.length === 0) {
    return 0;
  }

  const validValues = values.filter(
    (value) =>
      Number.isFinite(value),
  );

  if (validValues.length === 0) {
    return 0;
  }

  return Number(
    (
      validValues.reduce(
        (sum, value) =>
          sum + value,
        0,
      ) / validValues.length
    ).toFixed(2),
  );
}

function determinePerformanceLevel(
  score: number,
  questionCount: number,
):
  | "strong"
  | "developing"
  | "weak"
  | "insufficient" {
  if (questionCount === 0) {
    return "insufficient";
  }

  if (score >= 4) {
    return "strong";
  }

  if (score >= 3) {
    return "developing";
  }

  return "weak";
}

function buildStrengths({
  correctness,
  structure,
  specificity,
  communication,
}: {
  correctness: number;
  structure: number;
  specificity: number;
  communication: number;
}): string[] {
  const result: string[] = [];

  if (correctness >= 4) {
    result.push(
      "Demonstrated strong technical correctness.",
    );
  }

  if (structure >= 4) {
    result.push(
      "Presented answers with clear structure.",
    );
  }

  if (specificity >= 4) {
    result.push(
      "Provided specific technical details.",
    );
  }

  if (communication >= 4) {
    result.push(
      "Communicated technical ideas clearly.",
    );
  }

  return result;
}

function buildWeaknesses({
  correctness,
  structure,
  specificity,
  communication,
}: {
  correctness: number;
  structure: number;
  specificity: number;
  communication: number;
}): string[] {
  const result: string[] = [];

  if (correctness < 3) {
    result.push(
      "Technical correctness and depth need improvement.",
    );
  }

  if (structure < 3) {
    result.push(
      "Answer structure needs improvement.",
    );
  }

  if (specificity < 3) {
    result.push(
      "Answers need more concrete technical detail.",
    );
  }

  if (communication < 3) {
    result.push(
      "Communication and explanation clarity need improvement.",
    );
  }

  return result;
}

export function aggregateInterviewSkillPerformance(
  answers: InterviewSkillAnswer[],
): InterviewSkillPerformance[] {
  const grouped =
    new Map<
      string,
      InterviewSkillAnswer[]
    >();

  for (const answer of answers) {
    const skillName =
      answer.skill_name.trim();

    if (!skillName) {
      continue;
    }

    const existing =
      grouped.get(skillName) ?? [];

    existing.push(answer);

    grouped.set(
      skillName,
      existing,
    );
  }

  return Array.from(
    grouped.entries(),
  ).map(
    ([skillName, skillAnswers]) => {
      const overallScores =
        skillAnswers.map(
          (answer) =>
            answer.overall_score,
        );

      const correctness =
        skillAnswers
          .map(
            (answer) =>
              answer.correctness_score,
          )
          .filter(
            (
              value,
            ): value is number =>
              typeof value ===
                "number" &&
              Number.isFinite(value),
          );

      const structure =
        skillAnswers
          .map(
            (answer) =>
              answer.structure_score,
          )
          .filter(
            (
              value,
            ): value is number =>
              typeof value ===
                "number" &&
              Number.isFinite(value),
          );

      const specificity =
        skillAnswers
          .map(
            (answer) =>
              answer.specificity_score,
          )
          .filter(
            (
              value,
            ): value is number =>
              typeof value ===
                "number" &&
              Number.isFinite(value),
          );

      const communication =
        skillAnswers
          .map(
            (answer) =>
              answer.communication_score,
          )
          .filter(
            (
              value,
            ): value is number =>
              typeof value ===
                "number" &&
              Number.isFinite(value),
          );

      const averageScore =
        average(
          overallScores,
        );

      const correctnessScore =
        average(correctness);

      const structureScore =
        average(structure);

      const specificityScore =
        average(specificity);

      const communicationScore =
        average(communication);

      const performanceLevel =
        determinePerformanceLevel(
          averageScore,
          skillAnswers.length,
        );

      const strengths =
        buildStrengths({
          correctness:
            correctnessScore,

          structure:
            structureScore,

          specificity:
            specificityScore,

          communication:
            communicationScore,
        });

      const weaknesses =
        buildWeaknesses({
          correctness:
            correctnessScore,

          structure:
            structureScore,

          specificity:
            specificityScore,

          communication:
            communicationScore,
        });

      const evidenceSummary =
        `${skillName} was evaluated across ${skillAnswers.length} interview question${
          skillAnswers.length ===
          1
            ? ""
            : "s"
        } with an average score of ${averageScore.toFixed(
          2,
        )}/5.`;

      return {
        skill_name:
          skillName,

        question_count:
          skillAnswers.length,

        average_score:
          averageScore,

        correctness_score:
          correctnessScore,

        structure_score:
          structureScore,

        specificity_score:
          specificityScore,

        communication_score:
          communicationScore,

        performance_level:
          performanceLevel,

        evidence_summary:
          evidenceSummary,

        strengths,

        weaknesses,
      };
    },
  );
}
function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[./+_-]/g, " ")
    .replace(/[()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function aliases(value: string): string[] {
  const normalized = normalize(value);

  const map: Record<string, string[]> = {
    "amazon web services": ["aws"],
    aws: ["amazon web services"],

    "continuous integration continuous deployment": [
      "ci cd",
      "ci/cd",
    ],

    "ci cd": [
      "continuous integration continuous deployment",
      "ci/cd",
    ],

    "node js": ["node.js", "nodejs"],
    nodejs: ["node js", "node.js"],

    "react js": ["react", "reactjs"],
    reactjs: ["react", "react js"],

    "next js": ["next.js", "nextjs"],
    nextjs: ["next js", "next.js"],

    postgres: ["postgresql"],
    postgresql: ["postgres"],
  };

  return [normalized, ...(map[normalized] ?? [])];
}

function containsSkill(
  resume: string,
  skill: string,
): boolean {
  const resumeNormalized = normalize(resume);

  const candidates = aliases(skill);

  return candidates.some((candidate) => {
    const normalizedCandidate = normalize(candidate);

    if (!normalizedCandidate) {
      return false;
    }

    return resumeNormalized
      .split(" ")
      .join(" ")
      .includes(normalizedCandidate);
  });
}

export function calculateATSScore({
  resume,
  mustHaveSkills,
  niceToHaveSkills,
  tools,
}: {
  resume: string;
  mustHaveSkills: string[];
  niceToHaveSkills: string[];
  tools: string[];
}): number {
  const mustHave = [
    ...new Set(mustHaveSkills),
  ];

  const niceToHave = [
    ...new Set(niceToHaveSkills),
  ];

  const allTools = [
    ...new Set(tools),
  ];

  const mustHaveMatched = mustHave.filter(
    (skill) => containsSkill(resume, skill),
  ).length;

  const niceToHaveMatched = niceToHave.filter(
    (skill) => containsSkill(resume, skill),
  ).length;

  const toolsMatched = allTools.filter(
    (skill) => containsSkill(resume, skill),
  ).length;

  const mustHaveScore =
    mustHave.length > 0
      ? mustHaveMatched / mustHave.length
      : 1;

  const niceToHaveScore =
    niceToHave.length > 0
      ? niceToHaveMatched / niceToHave.length
      : 1;

  const toolsScore =
    allTools.length > 0
      ? toolsMatched / allTools.length
      : 1;

  const score =
    mustHaveScore * 0.6 +
    niceToHaveScore * 0.15 +
    toolsScore * 0.25;

  return Math.round(score * 100);
}
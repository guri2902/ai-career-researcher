export type CandidateSkill = {
  skill_name: string;
  proficiency: string;
  source: string;
};

export type SkillMatch = {
  requiredSkill: string;
  canonicalSkill: string;

  requirementType: "must_have" | "nice_to_have";

  matchStatus: "matched" | "partial" | "missing";

  candidateSkill: string | null;

  gapType: "blocking" | "minor" | null;

  matchScore: number;

  coveredByParentRequirement: boolean;
};

function normalizeSkill(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[./+_-]/g, " ")
    .replace(/[()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/*
 * Aliases represent the same skill.
 */
const aliases: Record<string, string> = {
  "amazon web services": "aws",
  "amazon web service": "aws",

  "continuous integration continuous deployment": "cicd",
  "continuous integration and continuous deployment": "cicd",
  "continuous integration deployment": "cicd",
  "ci cd": "cicd",
  "ci/cd": "cicd",

  js: "javascript",
  ts: "typescript",

  "node js": "nodejs",
  node: "nodejs",

  "react js": "react",
  reactjs: "react",

  "next js": "nextjs",

  postgres: "postgresql",

  k8s: "kubernetes",

  py: "python",

  "amazon elastic compute cloud": "ec2",
  "amazon simple storage service": "s3",

  "rest api": "rest apis",
  "rest apis": "rest apis",
};

/*
 * Broader capability concepts.
 *
 * Child skill -> parent capability
 *
 * Example:
 * AWS -> cloud_platforms
 * PostgreSQL -> relational_databases
 * Docker -> containerization
 */
const parentCapabilities: Record<string, string[]> = {
  "cloud platforms": [
    "aws",
    "azure",
    "gcp",
    "google cloud",
    "oracle cloud",
    "ibm cloud",
  ],

  "relational databases": [
    "postgresql",
    "mysql",
    "mariadb",
    "oracle database",
    "sql server",
    "microsoft sql server",
  ],

  containerization: [
    "docker",
    "podman",
    "containerd",
  ],

  cicd: [
    "jenkins",
    "github actions",
    "gitlab ci",
    "gitlab ci cd",
    "circleci",
    "azure devops",
    "harness",
  ],

  monitoring: [
    "prometheus",
    "grafana",
    "datadog",
    "new relic",
    "cloudwatch",
  ],

  "container orchestration": [
    "kubernetes",
    "openshift",
    "docker swarm",
  ],
};

function canonicalize(value: string): string {
  const normalized = normalizeSkill(value);

  return aliases[normalized] ?? normalized;
}

/*
 * Returns the broader capability that a skill belongs to.
 */
function getParents(canonicalSkill: string): string[] {
  return Object.entries(parentCapabilities)
    .filter(([, children]) =>
      children.includes(canonicalSkill),
    )
    .map(([parent]) => parent);
}

/*
 * Determine whether a candidate skill satisfies a requirement.
 *
 * This is intentionally asymmetric.
 *
 * Specific candidate -> broad requirement:
 * AWS -> cloud_platforms ✅
 *
 * Broad candidate -> specific requirement:
 * cloud_platforms -> AWS ❌
 */
function evaluateSkill(
  requiredSkill: string,
  candidateSkill: string,
): {
  score: number;
  status: "matched" | "partial" | "missing";
} {
  const required = canonicalize(requiredSkill);
  const candidate = canonicalize(candidateSkill);

  // Exact canonical match.
  if (required === candidate) {
    return {
      score: 1,
      status: "matched",
    };
  }

  // Specific candidate satisfies broader requirement.
  const candidateParents = getParents(candidate);

  if (candidateParents.includes(required)) {
    return {
      score: 1,
      status: "matched",
    };
  }

  /*
   * Conservative partial matching for multi-word concepts.
   *
   * We deliberately do NOT use substring matching anymore.
   * This prevents:
   *
   * SQL -> PostgreSQL
   * Java -> JavaScript
   */
  const requiredTokens = new Set(
    normalizeSkill(required).split(" ").filter(Boolean),
  );

  const candidateTokens = new Set(
    normalizeSkill(candidate).split(" ").filter(Boolean),
  );

  if (
    requiredTokens.size > 1 &&
    candidateTokens.size > 1
  ) {
    const intersection = [...requiredTokens].filter(
      (token) => candidateTokens.has(token),
    );

    const smallerSize = Math.min(
      requiredTokens.size,
      candidateTokens.size,
    );

    if (
      intersection.length >= 2 &&
      intersection.length / smallerSize >= 0.5
    ) {
      return {
        score: 0.75,
        status: "partial",
      };
    }
  }

  return {
    score: 0,
    status: "missing",
  };
}

function hasSpecificChildRequirement(
  requirements: string[],
  parentRequirement: string,
): boolean {
  const parent = canonicalize(parentRequirement);

  const children = parentCapabilities[parent];

  if (!children) {
    return false;
  }

  const canonicalRequirements = requirements.map(
    canonicalize,
  );

  return children.some((child) =>
    canonicalRequirements.includes(child),
  );
}

/*
 * Normalize a list before matching.
 *
 * If a job says:
 *
 *   AWS
 *   cloud platforms
 *
 * we keep AWS as the scored requirement, while the generic
 * "cloud platforms" requirement is treated as redundant coverage.
 */
export function normalizeRequirementList(
  requirements: string[],
): {
  skill: string;
  canonicalSkill: string;
  redundant: boolean;
}[] {
  return requirements.map((skill) => {
    const canonical = canonicalize(skill);

    return {
      skill,
      canonicalSkill: canonical,
      redundant: hasSpecificChildRequirement(
        requirements,
        skill,
      ),
    };
  });
}

export function matchSkills(
  requiredSkills: string[],
  requirementType: "must_have" | "nice_to_have",
  candidateSkills: CandidateSkill[],
): SkillMatch[] {
  const normalizedRequirements =
    normalizeRequirementList(requiredSkills);

  return normalizedRequirements.map(
    ({
      skill: requiredSkill,
      canonicalSkill,
      redundant,
    }) => {
      let bestScore = 0;
      let bestCandidate: CandidateSkill | null = null;
      let bestStatus:
        | "matched"
        | "partial"
        | "missing" = "missing";

      for (const candidate of candidateSkills) {
        const result = evaluateSkill(
          requiredSkill,
          candidate.skill_name,
        );

        if (result.score > bestScore) {
          bestScore = result.score;
          bestCandidate = candidate;
          bestStatus = result.status;
        }
      }

      /*
       * A redundant parent requirement is displayed but should
       * not create another gap or readiness penalty.
       */
      if (redundant) {
        return {
          requiredSkill,
          canonicalSkill,
          requirementType,
          matchStatus: "matched" as const,
          candidateSkill:
            bestCandidate?.skill_name ?? null,
          gapType: null,
          matchScore: 1,
          coveredByParentRequirement: true,
        };
      }

      return {
        requiredSkill,
        canonicalSkill,
        requirementType,
        matchStatus: bestStatus,
        candidateSkill:
          bestCandidate?.skill_name ?? null,
        gapType:
          bestStatus === "missing" ||
          bestStatus === "partial"
            ? requirementType === "must_have"
              ? "blocking"
              : "minor"
            : null,
        matchScore: bestScore,
        coveredByParentRequirement: false,
      };
    },
  );
}
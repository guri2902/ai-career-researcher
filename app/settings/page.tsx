"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Skill = {
  skillName: string;
  proficiency: string;
  source: "self-rated" | "resume";
};

const proficiencyOptions = [
  "not-rated",
  "beginner",
  "intermediate",
  "advanced",
  "expert",
];

export default function SettingsPage() {
  const [resumeText, setResumeText] = useState("");
  const [skills, setSkills] = useState<Skill[]>([]);

  const [newSkill, setNewSkill] = useState("");
  const [newProficiency, setNewProficiency] =
    useState("intermediate");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [analyzingResume, setAnalyzingResume] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // ─────────────────────────────────────────────
  // Load existing profile
  // ─────────────────────────────────────────────

  useEffect(() => {
    async function loadProfile() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch("/api/profile");

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.error || "Failed to load profile.",
          );
        }

        setResumeText(result.profile?.resume_text || "");

        const loadedSkills: Skill[] = (result.skills || []).map(
          (skill: {
            skill_name: string;
            proficiency: string;
            source?: string;
          }) => ({
            skillName: skill.skill_name,
            proficiency:
              skill.proficiency || "not-rated",
            source:
              skill.source === "resume"
                ? "resume"
                : "self-rated",
          }),
        );

        setSkills(loadedSkills);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load profile.",
        );
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, []);

  // ─────────────────────────────────────────────
  // Add self-rated skill
  // ─────────────────────────────────────────────

  function addSkill() {
    const name = newSkill.trim();

    if (!name) {
      return;
    }

    const exists = skills.some(
      (skill) =>
        skill.skillName.toLowerCase() ===
        name.toLowerCase(),
    );

    if (exists) {
      setNewSkill("");
      return;
    }

    setSkills((currentSkills) => [
      ...currentSkills,
      {
        skillName: name,
        proficiency: newProficiency,
        source: "self-rated",
      },
    ]);

    setNewSkill("");
  }

  // ─────────────────────────────────────────────
  // Remove skill
  // ─────────────────────────────────────────────

  function removeSkill(skillName: string) {
    setSkills((currentSkills) =>
      currentSkills.filter(
        (skill) => skill.skillName !== skillName,
      ),
    );
  }

  // ─────────────────────────────────────────────
  // Change proficiency
  // ─────────────────────────────────────────────

  function updateProficiency(
    skillName: string,
    proficiency: string,
  ) {
    setSkills((currentSkills) =>
      currentSkills.map((skill) =>
        skill.skillName === skillName
          ? {
              ...skill,
              proficiency,
              source: "self-rated",
            }
          : skill,
      ),
    );
  }

  // ─────────────────────────────────────────────
  // Analyze resume with AI
  // ─────────────────────────────────────────────

  async function analyzeResume() {
    try {
      setAnalyzingResume(true);
      setError("");
      setSuccess("");

      if (!resumeText.trim()) {
        throw new Error(
          "Please paste your resume before analyzing it.",
        );
      }

      // First save the latest resume text.
      const saveResponse = await fetch("/api/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          resumeText,
          skills,
        }),
      });

      const saveResult = await saveResponse.json();

      if (!saveResponse.ok) {
        throw new Error(
          saveResult.error || "Failed to save resume.",
        );
      }

      // Then run AI extraction.
      const response = await fetch(
        "/api/profile/analyze-resume",
        {
          method: "POST",
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Failed to analyze resume.",
        );
      }

      const extractedSkills = Array.isArray(result.skills)
        ? result.skills
        : [];

      setSkills((currentSkills) => {
        const selfRatedSkills = currentSkills.filter(
          (skill) => skill.source === "self-rated",
        );

        const selfRatedNames = new Set(
          selfRatedSkills.map((skill) =>
            skill.skillName.toLowerCase(),
          ),
        );

        const inferredSkills: Skill[] =
          extractedSkills
            .filter(
              (skill: { skill_name?: unknown }) =>
                typeof skill.skill_name === "string" &&
                skill.skill_name.trim().length > 0 &&
                !selfRatedNames.has(
                  skill.skill_name.toLowerCase(),
                ),
            )
            .map(
              (skill: { skill_name: string }) => ({
                skillName: skill.skill_name,
                proficiency: "not-rated",
                source: "resume",
              }),
            );

        return [
          ...selfRatedSkills,
          ...inferredSkills,
        ];
      });

      setSuccess(
        `Resume analyzed successfully. ${extractedSkills.length} skills found.`,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to analyze resume.",
      );
    } finally {
      setAnalyzingResume(false);
    }
  }

  // ─────────────────────────────────────────────
  // Save complete profile
  // ─────────────────────────────────────────────

  async function saveProfile() {
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const response = await fetch("/api/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          resumeText,
          skills,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Failed to save profile.",
        );
      }

      setSuccess("Profile saved successfully.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save profile.",
      );
    } finally {
      setSaving(false);
    }
  }

  // ─────────────────────────────────────────────
  // Loading state
  // ─────────────────────────────────────────────

  if (loading) {
    return (
      <main className="min-h-screen bg-background px-6 py-12">
        <div className="mx-auto max-w-4xl">
          <p className="text-muted-foreground">
            Loading your profile...
          </p>
        </div>
      </main>
    );
  }

  // ─────────────────────────────────────────────
  // Page
  // ─────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-background px-6 py-12">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
          Settings
        </p>

        <h1 className="mt-3 text-4xl font-semibold text-secondary">
          Your career profile
        </h1>

        <p className="mt-4 max-w-2xl text-muted-foreground">
          Your resume and skills are the foundation of the
          skill-gap analysis. Keep them accurate so the
          recommendations stay grounded in your actual
          experience.
        </p>

        {/* Resume */}
        <section className="mt-10 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-secondary">
                Base resume
              </h2>

              <p className="mt-2 text-sm text-muted-foreground">
                Paste your current resume text. We&apos;ll use
                it as the source of truth for later resume
                tailoring and skill analysis.
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={analyzeResume}
              disabled={
                saving ||
                analyzingResume ||
                !resumeText.trim()
              }
            >
              {analyzingResume
                ? "Analyzing..."
                : "Analyze Resume"}
            </Button>
          </div>

          <Textarea
            value={resumeText}
            onChange={(event) =>
              setResumeText(event.target.value)
            }
            placeholder="Paste your resume here..."
            className="mt-5 min-h-80 resize-none bg-background"
            disabled={analyzingResume}
          />

          <p className="mt-3 text-xs text-muted-foreground">
            AI extraction only uses skills supported by the
            resume. It does not invent experience.
          </p>
        </section>

        {/* Skills */}
        <section className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div>
            <h2 className="text-xl font-semibold text-secondary">
              Skills
            </h2>

            <p className="mt-2 text-sm text-muted-foreground">
              Add skills you genuinely have and rate your
              current proficiency. Resume-detected skills are
              marked separately.
            </p>
          </div>

          {/* Add skill */}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Input
              value={newSkill}
              onChange={(event) =>
                setNewSkill(event.target.value)
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addSkill();
                }
              }}
              placeholder="e.g. AWS"
              className="bg-background"
              disabled={saving || analyzingResume}
            />

            <select
              value={newProficiency}
              onChange={(event) =>
                setNewProficiency(event.target.value)
              }
              disabled={saving || analyzingResume}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
            >
              {proficiencyOptions
                .filter(
                  (option) => option !== "not-rated",
                )
                .map((option) => (
                  <option key={option} value={option}>
                    {option.charAt(0).toUpperCase() +
                      option.slice(1)}
                  </option>
                ))}
            </select>

            <Button
              type="button"
              onClick={addSkill}
              disabled={saving || analyzingResume}
            >
              Add skill
            </Button>
          </div>

          {/* Skill list */}
          {skills.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-border bg-background p-6 text-sm text-muted-foreground">
              No skills added yet.
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {skills.map((skill) => (
                <div
                  key={`${skill.skillName}-${skill.source}`}
                  className="flex flex-col gap-4 rounded-xl border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-secondary">
                        {skill.skillName}
                      </p>

                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${
                          skill.source === "resume"
                            ? "bg-[#efe5d5] text-[#6b1f2a]"
                            : "bg-[#172a3a] text-[#f7f2ea]"
                        }`}
                      >
                        {skill.source === "resume"
                          ? "From resume"
                          : "Self-rated"}
                      </span>
                    </div>

                    <p className="mt-1 text-xs text-muted-foreground">
                      {skill.source === "resume"
                        ? "Detected from resume evidence"
                        : "Added manually"}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    {skill.source === "self-rated" ? (
                      <select
                        value={skill.proficiency}
                        onChange={(event) =>
                          updateProficiency(
                            skill.skillName,
                            event.target.value,
                          )
                        }
                        disabled={
                          saving || analyzingResume
                        }
                        className="h-9 rounded-md border border-input bg-card px-3 text-sm text-foreground"
                      >
                        {proficiencyOptions
                          .filter(
                            (option) =>
                              option !== "not-rated",
                          )
                          .map((option) => (
                            <option
                              key={option}
                              value={option}
                            >
                              {option.charAt(0).toUpperCase() +
                                option.slice(1)}
                            </option>
                          ))}
                      </select>
                    ) : (
                      <span className="rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
                        Proficiency not rated
                      </span>
                    )}

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        removeSkill(skill.skillName)
                      }
                      disabled={
                        saving || analyzingResume
                      }
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Messages */}
        {error && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-6 rounded-lg border border-border bg-muted px-4 py-3 text-sm text-secondary">
            {success}
          </div>
        )}

        {/* Save */}
        <div className="mt-6 flex justify-end">
          <Button
            size="lg"
            onClick={saveProfile}
            disabled={saving || analyzingResume}
          >
            {saving ? "Saving..." : "Save Profile"}
          </Button>
        </div>
      </div>
    </main>
  );
}
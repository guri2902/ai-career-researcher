"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type Project = {
  id: string;
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

  status: string;
};

type Job = {
  id: string;
  title: string;
  company_name: string;
};

export default function ProjectsPage() {
  const params = useParams();
  const jobId = params.id as string;

  const [projects, setProjects] = useState<Project[]>([]);
  const [job, setJob] = useState<Job | null>(null);

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  async function loadProjects() {
    try {
      setLoading(true);
      setError("");

      const [projectsResponse, jobResponse] = await Promise.all([
        fetch(`/api/jobs/${jobId}/projects`),
        fetch(`/api/jobs/${jobId}`),
      ]);

      const projectsData = await projectsResponse.json();

      if (!projectsResponse.ok || !projectsData.success) {
        throw new Error(
          projectsData.error || "Failed to load projects.",
        );
      }

      setProjects(projectsData.projects || []);

      if (jobResponse.ok) {
        const jobData = await jobResponse.json();

        if (jobData.success) {
          setJob(jobData.job);
        }
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load projects.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function generateProjects() {
    try {
      setGenerating(true);
      setError("");

      const response = await fetch(
        `/api/jobs/${jobId}/projects`,
        {
          method: "POST",
        },
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "Failed to generate projects.",
        );
      }

      setProjects(data.projects || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to generate projects.",
      );
    } finally {
      setGenerating(false);
    }
  }

  useEffect(() => {
    if (jobId) {
      loadProjects();
    }
  }, [jobId]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f5efe5] px-6 py-12 text-[#152a3f]">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm text-[#6f655a]">
            Loading project recommendations...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5efe5] px-6 py-10 text-[#152a3f]">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-10 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 text-xs font-semibold tracking-[0.28em] text-[#7b1e2b]">
              PROJECTS TO BUILD
            </div>

            <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
              Close your skill gaps
            </h1>

            {job && (
              <p className="mt-3 text-base text-[#6f655a]">
                Projects generated specifically for{" "}
                <span className="font-medium text-[#152a3f]">
                  {job.title}
                </span>{" "}
                at{" "}
                <span className="font-medium text-[#152a3f]">
                  {job.company_name}
                </span>
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href={`/jobs/${jobId}`}>
              <Button variant="outline">
                Back to Job
              </Button>
            </Link>

            <Button
              onClick={generateProjects}
              disabled={generating}
              className="bg-[#7b1e2b] text-white hover:bg-[#661824]"
            >
              {generating
                ? "Generating..."
                : "Regenerate Projects"}
            </Button>
          </div>
        </div>

        {error && (
          <div className="mb-8 rounded-2xl border border-[#d7b8b8] bg-[#f8eaea] px-5 py-4 text-sm text-[#7b1e2b]">
            {error}
          </div>
        )}

        {projects.length === 0 && !error && (
          <section className="rounded-3xl border border-[#dfd3c4] bg-[#fbf7f0] p-10 text-center shadow-sm">
            <div className="mx-auto max-w-xl">
              <div className="mb-3 text-xs font-semibold tracking-[0.25em] text-[#7b1e2b]">
                NO PROJECTS YET
              </div>

              <h2 className="text-2xl font-semibold">
                Generate projects from your skill gaps
              </h2>

              <p className="mt-3 text-[#6f655a]">
                The AI will analyze your missing and partial skills
                and create practical projects designed to close
                those gaps.
              </p>

              <div className="mt-6">
                <Button
                  onClick={generateProjects}
                  disabled={generating}
                  className="bg-[#7b1e2b] text-white hover:bg-[#661824]"
                >
                  {generating
                    ? "Generating..."
                    : "Generate Projects"}
                </Button>
              </div>
            </div>
          </section>
        )}

        <div className="grid gap-8 lg:grid-cols-3">
          {projects.map((project, index) => (
            <article
              key={project.id}
              className="flex flex-col rounded-3xl border border-[#dfd3c4] bg-[#fbf7f0] p-6 shadow-sm"
            >
              {/* Project number */}
              <div className="mb-5 flex items-center justify-between">
                <span className="text-xs font-semibold tracking-[0.2em] text-[#7b1e2b]">
                  PROJECT {String(index + 1).padStart(2, "0")}
                </span>

                <span className="rounded-full border border-[#d9cbbb] bg-[#f2e9dc] px-3 py-1 text-xs text-[#6f655a]">
                  {project.estimated_weeks}{" "}
                  {project.estimated_weeks === 1
                    ? "week"
                    : "weeks"}
                </span>
              </div>

              <h2 className="text-2xl font-semibold leading-tight">
                {project.title}
              </h2>

              <div className="mt-3 inline-flex w-fit rounded-full bg-[#eadfd0] px-3 py-1 text-xs font-medium text-[#6f655a]">
                {project.difficulty}
              </div>

              {/* Problem */}
              <div className="mt-6">
                <h3 className="text-sm font-semibold">
                  Problem
                </h3>

                <p className="mt-2 text-sm leading-6 text-[#6f655a]">
                  {project.problem_statement}
                </p>
              </div>

              {/* Why */}
              <div className="mt-5">
                <h3 className="text-sm font-semibold">
                  Why build this?
                </h3>

                <p className="mt-2 text-sm leading-6 text-[#6f655a]">
                  {project.why_this_project}
                </p>
              </div>

              {/* Skills */}
              <div className="mt-6">
                <h3 className="text-sm font-semibold">
                  Skills you will develop
                </h3>

                <div className="mt-3 flex flex-wrap gap-2">
                  {project.target_skills.map((skill) => (
                    <span
                      key={skill}
                      className="rounded-full border border-[#c9b39b] bg-[#f4eadc] px-3 py-1 text-xs text-[#152a3f]"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              {/* Tech stack */}
              <div className="mt-6">
                <h3 className="text-sm font-semibold">
                  Tech stack
                </h3>

                <p className="mt-2 text-sm leading-6 text-[#6f655a]">
                  {project.tech_stack.join(" • ")}
                </p>
              </div>

              <div className="mt-auto pt-8">
                <Link
                  href={`/jobs/${jobId}/projects/${project.id}`}
                  className="block"
                >
                  <Button className="w-full bg-[#152a3f] text-white hover:bg-[#0e2031]">
                    View Project Plan
                  </Button>
                </Link>
              </div>
            </article>
          ))}
        </div>

        {/* How this works */}
        {projects.length > 0 && (
          <section className="mt-12 rounded-3xl border border-[#dfd3c4] bg-[#fbf7f0] p-8 shadow-sm">
            <div className="text-xs font-semibold tracking-[0.25em] text-[#7b1e2b]">
              HOW THIS FITS THE PIPELINE
            </div>

            <div className="mt-5 grid gap-5 md:grid-cols-5">
              {[
                "Job requirements",
                "Skill gaps",
                "Projects",
                "Interview questions",
                "Mock interview",
              ].map((step, index) => (
                <div key={step} className="relative">
                  <div className="text-xs font-semibold text-[#7b1e2b]">
                    0{index + 1}
                  </div>

                  <div className="mt-2 text-sm font-medium">
                    {step}
                  </div>

                  {index < 4 && (
                    <div className="mt-4 hidden h-px bg-[#d8cbbd] md:block" />
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
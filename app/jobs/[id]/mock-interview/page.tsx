"use client";

import Link from "next/link";
import {
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

type InterviewQuestion = {
  id: string;
  question: string;
  category: string;
  difficulty: string;
  target_skill: string;
  why_asked?: string;
};

type InterviewSession = {
  id: string;
  status: string;
  current_question_index: number;
  total_questions: number;
};

type ScoreData = {
  correctness_score: number;
  structure_score: number;
  specificity_score: number;
  communication_score: number;
  overall_score: number;
  feedback: string;
  stronger_answer: string;
};

type AdaptiveDecision = {
  action: string;
};

type ApiResponse = {
  success?: boolean;
  error?: string;
  completed?: boolean;

  resumed?: boolean;

  paused?: boolean;

  job?: {
    title: string | null;
    company_name: string | null;
  };

  session?: InterviewSession;

  question?: InterviewQuestion;

  nextQuestion?: InterviewQuestion | null;

  nextQuestionIndex?: number | null;

  totalQuestions?: number;

  answer?: {
    overall_score: number;
    correctness_score: number;
    structure_score: number;
    specificity_score: number;
    communication_score: number;
    feedback: string;
    stronger_answer: string;
  };

  scoring?: ScoreData;

  adaptiveDecision?: AdaptiveDecision | null;
};

type SpeechRecognitionResultEvent = Event & {
  results: SpeechRecognitionResultList;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;

  onresult:
    | ((event: SpeechRecognitionResultEvent) => void)
    | null;

  onerror:
    | ((event: Event) => void)
    | null;

  onend:
    | (() => void)
    | null;

  start: () => void;

  stop: () => void;
};

type SpeechRecognitionConstructor =
  new () => SpeechRecognitionLike;

type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;

  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

export default function MockInterviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: jobId } = use(params);

  const [session, setSession] =
    useState<InterviewSession | null>(null);

  const [question, setQuestion] =
    useState<InterviewQuestion | null>(null);

  const [
    pendingNextQuestion,
    setPendingNextQuestion,
  ] = useState<InterviewQuestion | null>(
    null,
  );

  const [
    pendingNextQuestionIndex,
    setPendingNextQuestionIndex,
  ] = useState<number | null>(null);

  const [questionNumber, setQuestionNumber] =
    useState(1);

  const [totalQuestions, setTotalQuestions] =
    useState(12);

  const [answer, setAnswer] =
    useState("");

  const [score, setScore] =
    useState<ScoreData | null>(null);

  const [mode, setMode] =
    useState<"text" | "voice">("text");

  const [loading, setLoading] =
    useState(true);

  const [submitting, setSubmitting] =
    useState(false);

  const [completed, setCompleted] =
    useState(false);

  const [ended, setEnded] =
    useState(false);

  const [paused, setPaused] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [listening, setListening] =
    useState(false);

  const [speaking, setSpeaking] =
    useState(false);

  const [speechPaused, setSpeechPaused] =
    useState(false);

  const [speechSupported, setSpeechSupported] =
    useState(false);

  const [voiceError, setVoiceError] =
    useState<string | null>(null);

  const [showSkipConfirm, setShowSkipConfirm] =
    useState(false);

  const [showEndConfirm, setShowEndConfirm] =
    useState(false);

  const recognitionRef =
    useRef<SpeechRecognitionLike | null>(null);

  const speak = useCallback((text: string) => {
    if (
      typeof window === "undefined" ||
      !("speechSynthesis" in window)
    ) {
      return;
    }

    window.speechSynthesis.cancel();

    setSpeaking(false);
    setSpeechPaused(false);

    const utterance =
      new SpeechSynthesisUtterance(text);

    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.volume = 1;

    utterance.onstart = () => {
      setSpeaking(true);
      setSpeechPaused(false);
    };

    utterance.onend = () => {
      setSpeaking(false);
      setSpeechPaused(false);
    };

    utterance.onerror = () => {
      setSpeaking(false);
      setSpeechPaused(false);
    };

    window.speechSynthesis.speak(
      utterance,
    );
  }, []);

  const pauseSpeech = () => {
    if (
      typeof window !== "undefined" &&
      "speechSynthesis" in window &&
      window.speechSynthesis.speaking
    ) {
      window.speechSynthesis.pause();

      setSpeechPaused(true);
    }
  };

  const resumeSpeech = () => {
    if (
      typeof window !== "undefined" &&
      "speechSynthesis" in window &&
      window.speechSynthesis.paused
    ) {
      window.speechSynthesis.resume();

      setSpeechPaused(false);

      setSpeaking(true);
    }
  };

  const stopSpeech = () => {
    if (
      typeof window !== "undefined" &&
      "speechSynthesis" in window
    ) {
      window.speechSynthesis.cancel();
    }

    setSpeaking(false);
    setSpeechPaused(false);
  };

  const stopListening = () => {
    recognitionRef.current?.stop();

    setListening(false);
  };

  const generateInterviewSummary =
    useCallback(
      async (sessionId: string) => {
        try {
          await fetch(
            `/api/jobs/${jobId}/mock-interview/${sessionId}/summary`,
            {
              method: "GET",
            },
          );
        } catch {
          // The interview/session remains saved even if
          // report generation temporarily fails.
        }
      },
      [jobId],
    );

  const startInterview =
    useCallback(async () => {
      try {
        setLoading(true);

        setError(null);

        const response = await fetch(
          `/api/jobs/${jobId}/mock-interview`,
          {
            method: "POST",
          },
        );

        const data: ApiResponse =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ??
              "Unable to start interview.",
          );
        }

        if (
          !data.session ||
          !data.question
        ) {
          throw new Error(
            "Interview session did not return a question.",
          );
        }

        setSession(data.session);

        setQuestion(data.question);

        setPendingNextQuestion(null);

        setPendingNextQuestionIndex(null);

        setQuestionNumber(
          data.session
            .current_question_index + 1,
        );

        setTotalQuestions(
          data.totalQuestions ??
            data.session
              .total_questions ??
            12,
        );

        setAnswer("");

        setScore(null);

        setCompleted(false);

        setEnded(false);

        setPaused(
          data.session.status ===
            "paused",
        );

        setShowSkipConfirm(false);

        setShowEndConfirm(false);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to start interview.",
        );
      } finally {
        setLoading(false);
      }
    }, [jobId]);

  useEffect(() => {
    if (!jobId) {
      return;
    }

    const speechWindow =
      window as SpeechWindow;

    setSpeechSupported(
      Boolean(
        speechWindow.SpeechRecognition ||
          speechWindow.webkitSpeechRecognition,
      ),
    );

    void startInterview();

    return () => {
      recognitionRef.current?.stop();

      window.speechSynthesis?.cancel();
    };
  }, [jobId, startInterview]);

  useEffect(() => {
    if (
      mode === "voice" &&
      question &&
      !score &&
      !pendingNextQuestion &&
      !paused &&
      !completed &&
      !ended
    ) {
      speak(question.question);
    }
  }, [
    mode,
    question,
    score,
    pendingNextQuestion,
    paused,
    completed,
    ended,
    speak,
  ]);

  const startListening = () => {
    if (paused || ended || completed) {
      return;
    }

    setVoiceError(null);

    stopSpeech();

    const speechWindow =
      window as SpeechWindow;

    const Recognition =
      speechWindow.SpeechRecognition ??
      speechWindow.webkitSpeechRecognition;

    if (!Recognition) {
      setVoiceError(
        "Speech recognition is not available in this browser.",
      );

      return;
    }

    recognitionRef.current?.stop();

    const recognition =
      new Recognition();

    recognition.continuous = true;

    recognition.interimResults = true;

    recognition.lang = "en-IN";

    recognition.onresult = (
      event,
    ) => {
      let transcript = "";

      for (
        let i = 0;
        i < event.results.length;
        i++
      ) {
        transcript +=
          event.results[i][0]
            .transcript + " ";
      }

      setAnswer(
        transcript.trim(),
      );
    };

    recognition.onerror = () => {
      setVoiceError(
        "Microphone recognition failed. You can continue typing your answer.",
      );

      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current =
      recognition;

    try {
      recognition.start();

      setListening(true);
    } catch {
      setVoiceError(
        "Could not start the microphone.",
      );

      setListening(false);
    }
  };

  const pauseInterview = async () => {
    if (
      !session ||
      paused ||
      submitting
    ) {
      return;
    }

    stopSpeech();

    stopListening();

    try {
      setSubmitting(true);

      setError(null);

      const response = await fetch(
        `/api/jobs/${jobId}/mock-interview/${session.id}/pause`,
        {
          method: "POST",
        },
      );

      const data: ApiResponse =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ??
            "Unable to pause interview.",
        );
      }

      if (data.session) {
        setSession(data.session);
      }

      setPaused(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to pause interview.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const resumeInterview = async () => {
    if (
      !session ||
      !paused ||
      submitting
    ) {
      return;
    }

    try {
      setSubmitting(true);

      setError(null);

      const response = await fetch(
        `/api/jobs/${jobId}/mock-interview/${session.id}/resume`,
        {
          method: "POST",
        },
      );

      const data: ApiResponse =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ??
            "Unable to resume interview.",
        );
      }

      if (data.session) {
        setSession(data.session);
      }

      setPaused(false);

      if (
        mode === "voice" &&
        question
      ) {
        window.setTimeout(() => {
          speak(question.question);
        }, 200);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to resume interview.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const endInterview = async () => {
    if (
      !session ||
      submitting
    ) {
      return;
    }

    stopSpeech();

    stopListening();

    try {
      setSubmitting(true);

      setError(null);

      setShowEndConfirm(false);

      const response = await fetch(
        `/api/jobs/${jobId}/mock-interview/${session.id}/end`,
        {
          method: "POST",
        },
      );

      const data: ApiResponse =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ??
            "Unable to end interview.",
        );
      }

      if (data.session) {
        setSession(data.session);
      }

      setEnded(true);

      setPaused(false);

      await generateInterviewSummary(
        (data.session ?? session).id,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to end interview.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const skipQuestion = async () => {
    if (
      !question ||
      !session ||
      submitting ||
      paused
    ) {
      return;
    }

    stopSpeech();

    stopListening();

    try {
      setSubmitting(true);

      setError(null);

      setShowSkipConfirm(false);

      const response = await fetch(
        `/api/jobs/${jobId}/mock-interview/${session.id}/skip`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            question_id:
              question.id,
          }),
        },
      );

      const data: ApiResponse =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ??
            "Unable to skip question.",
        );
      }

      if (data.completed) {
        const completedSession =
          data.session ?? session;

        if (completedSession) {
          setSession(
            completedSession,
          );

          await generateInterviewSummary(
            completedSession.id,
          );
        }

        setCompleted(true);

        setQuestion(null);

        setPendingNextQuestion(null);

        setScore(null);

        return;
      }

      if (data.nextQuestion) {
        setQuestion(
          data.nextQuestion,
        );

        setQuestionNumber(
          (data.nextQuestionIndex ??
            0) + 1,
        );

        setAnswer("");

        setScore(null);

        setPendingNextQuestion(
          null,
        );

        setPendingNextQuestionIndex(
          null,
        );

        if (data.session) {
          setSession(
            data.session,
          );
        }
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to skip question.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const submitAnswer =
    async () => {
      if (
        !question ||
        !session ||
        !answer.trim() ||
        submitting ||
        paused
      ) {
        return;
      }

      stopListening();

      stopSpeech();

      try {
        setSubmitting(true);

        setError(null);

        const response =
          await fetch(
            `/api/jobs/${jobId}/mock-interview/${session.id}/answer`,
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify({
                question_id:
                  question.id,

                answer:
                  answer.trim(),
              }),
            },
          );

        const data: ApiResponse =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ??
              "Unable to process answer.",
          );
        }

        const result =
          data.scoring ??
          data.answer ??
          null;

        setScore(result);

        if (data.completed) {
          const completedSession =
            data.session ?? session;

          if (completedSession) {
            setSession(
              completedSession,
            );

            await generateInterviewSummary(
              completedSession.id,
            );
          }

          setCompleted(true);

          setPendingNextQuestion(
            null,
          );

          setPendingNextQuestionIndex(
            null,
          );

          return;
        }

        if (data.nextQuestion) {
          setPendingNextQuestion(
            data.nextQuestion,
          );

          setPendingNextQuestionIndex(
            data.nextQuestionIndex ??
              null,
          );
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to process answer.",
        );
      } finally {
        setSubmitting(false);
      }
    };

  const continueToNextQuestion =
    () => {
      if (
        !pendingNextQuestion
      ) {
        return;
      }

      stopSpeech();

      setQuestion(
        pendingNextQuestion,
      );

      setQuestionNumber(
        (pendingNextQuestionIndex ??
          0) + 1,
      );

      setAnswer("");

      setScore(null);

      setPendingNextQuestion(
        null,
      );

      setPendingNextQuestionIndex(
        null,
      );

      setError(null);

      if (
        mode === "voice"
      ) {
        window.setTimeout(() => {
          speak(
            pendingNextQuestion.question,
          );
        }, 200);
      }
    };

  const changeMode = (
    nextMode: "text" | "voice",
  ) => {
    stopSpeech();

    stopListening();

    setMode(nextMode);

    setVoiceError(null);
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f2ea] text-[#321e24]">
        <div className="mx-auto max-w-4xl px-6 py-20">
          <p className="text-sm text-[#7c6068]">
            Preparing your adaptive interview...
          </p>
        </div>
      </main>
    );
  }

  if (ended) {
    return (
      <main className="min-h-screen bg-[#f7f2ea] text-[#321e24]">
        <div className="mx-auto max-w-4xl px-6 py-16">
          <div className="rounded-3xl border border-[#dfd0c3] bg-[#fffaf4] p-10 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#6b1f2a]">
              Interview ended
            </p>

            <h1 className="mt-4 text-4xl font-semibold">
              Your interview session was saved.
            </h1>

            <p className="mt-4 max-w-2xl text-[#7c6068]">
              Your answered questions and
              interview progress remain stored.
              You can start another session later.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <StatCard
                label="Reached"
                value={`${Math.min(
                  questionNumber,
                  totalQuestions,
                )}/${totalQuestions}`}
              />

              <StatCard
                label="Session"
                value="Saved"
              />

              <StatCard
                label="Status"
                value="Abandoned"
              />
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  setEnded(false);

                  void startInterview();
                }}
                className="rounded-xl bg-[#6b1f2a] px-5 py-3 text-sm font-medium text-white hover:bg-[#571821]"
              >
                Start New Interview
              </button>

              {session && (
                <Link
                  href={`/jobs/${jobId}/mock-interview/${session.id}/summary`}
                  className="rounded-xl bg-[#6b1f2a] px-5 py-3 text-sm font-medium text-white hover:bg-[#571821]"
                >
                  View Interview Report →
                </Link>
              )}

              <Link
                href={`/jobs/${jobId}/interview-questions`}
                className="rounded-xl border border-[#d8c5ba] px-5 py-3 text-sm font-medium hover:bg-white"
              >
                Question Bank
              </Link>

              <Link
                href={`/jobs/${jobId}`}
                className="rounded-xl border border-[#d8c5ba] px-5 py-3 text-sm font-medium hover:bg-white"
              >
                Back to Job
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (completed) {
    return (
      <main className="min-h-screen bg-[#f7f2ea] text-[#321e24]">
        <div className="mx-auto max-w-4xl px-6 py-16">
          <div className="rounded-3xl border border-[#dfd0c3] bg-[#fffaf4] p-10 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#6b1f2a]">
              Interview complete
            </p>

            <h1 className="mt-4 text-4xl font-semibold">
              Your adaptive interview is finished.
            </h1>

            <p className="mt-4 max-w-2xl text-[#7c6068]">
              The interviewer analyzed your
              answers and adapted the
              conversation as you progressed.
            </p>

            <div className="mt-8 rounded-2xl bg-[#321e24] p-6 text-[#fffaf4]">
              <p className="text-sm text-[#dccbc0]">
                Report ready
              </p>

              <p className="mt-2 text-xl font-medium">
                Your interview performance has been processed.
              </p>

              <p className="mt-2 text-sm text-[#dccbc0]">
                Your answers were scored and the results were
                saved for skill-level analysis, practice
                priorities and project recommendations.
              </p>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              {session && (
                <Link
                  href={`/jobs/${jobId}/mock-interview/${session.id}/summary`}
                  className="rounded-xl bg-[#6b1f2a] px-5 py-3 text-sm font-medium text-white hover:bg-[#571821]"
                >
                  View Interview Report →
                </Link>
              )}

              <Link
                href={`/jobs/${jobId}/skill-profile`}
                className="rounded-xl border border-[#d8c5ba] px-5 py-3 text-sm font-medium hover:bg-white"
              >
                View Skill Profile
              </Link>

              <Link
                href={`/jobs/${jobId}/projects`}
                className="rounded-xl border border-[#d8c5ba] px-5 py-3 text-sm font-medium hover:bg-white"
              >
                View Projects
              </Link>

              <Link
                href={`/jobs/${jobId}/interview-questions`}
                className="rounded-xl border border-[#d8c5ba] px-5 py-3 text-sm font-medium hover:bg-white"
              >
                Question Bank
              </Link>

              <Link
                href={`/jobs/${jobId}`}
                className="rounded-xl border border-[#d8c5ba] px-5 py-3 text-sm font-medium hover:bg-white"
              >
                Back to Job
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f2ea] text-[#321e24]">
      <div className="mx-auto max-w-5xl px-6 py-10 lg:px-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link
              href={`/jobs/${jobId}/interview-questions`}
              className="text-sm text-[#7c6068] hover:text-[#6b1f2a]"
            >
              ← Interview Question Bank
            </Link>

            <p className="mt-6 text-sm font-semibold uppercase tracking-[0.2em] text-[#6b1f2a]">
              Adaptive AI Mock Interview
            </p>

            <h1 className="mt-2 text-4xl font-semibold tracking-tight">
              Interview in progress
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Text / Voice mode */}
            <div className="flex rounded-xl border border-[#dccdc3] bg-[#fffaf4] p-1">
              <button
                type="button"
                onClick={() => changeMode("text")}
                disabled={submitting || paused}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  mode === "text"
                    ? "bg-[#321e24] text-white"
                    : "text-[#6f535b] hover:bg-[#f3e9df]"
                } disabled:opacity-50`}
              >
                ⌨ Text
              </button>

              <button
                type="button"
                onClick={() => changeMode("voice")}
                disabled={submitting || paused}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  mode === "voice"
                    ? "bg-[#321e24] text-white"
                    : "text-[#6f535b] hover:bg-[#f3e9df]"
                } disabled:opacity-50`}
              >
                🎤 Voice
              </button>
            </div>

            {/* Pause / Resume */}
            {paused ? (
              <button
                type="button"
                onClick={resumeInterview}
                disabled={submitting}
                className="rounded-xl bg-[#6b1f2a] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#571821] disabled:opacity-50"
              >
                ▶ Resume Interview
              </button>
            ) : (
              <button
                type="button"
                onClick={pauseInterview}
                disabled={
                  submitting ||
                  ended ||
                  completed
                }
                className="rounded-xl border border-[#cebcb1] bg-[#fffaf4] px-5 py-2.5 text-sm font-medium text-[#6b1f2a] hover:bg-white disabled:opacity-50"
              >
                ⏸ Pause Interview
              </button>
            )}

            {/* End */}
            <button
              type="button"
              onClick={() =>
                setShowEndConfirm(true)
              }
              disabled={submitting}
              className="rounded-xl border border-red-200 bg-red-50 px-5 py-2.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
            >
              ⏹ End Interview
            </button>
          </div>
        </div>

        {paused && (
          <div className="mt-6 rounded-2xl border border-[#d8c5ba] bg-[#fffaf4] p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">
                  Interview paused
                </p>

                <p className="mt-1 text-sm text-[#7c6068]">
                  Your session, current question
                  and progress have been saved.
                </p>
              </div>

              <button
                type="button"
                onClick={
                  resumeInterview
                }
                disabled={submitting}
                className="rounded-xl bg-[#6b1f2a] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#571821] disabled:opacity-50"
              >
                Resume Interview →
              </button>
            </div>
          </div>
        )}

        <div className="mt-8 h-2 overflow-hidden rounded-full bg-[#e4d7cc]">
          <div
            className="h-full rounded-full bg-[#6b1f2a] transition-all"
            style={{
              width: `${Math.min(
                100,
                (questionNumber /
                  totalQuestions) *
                  100,
              )}%`,
            }}
          />
        </div>

        <div className="mt-3 flex items-center justify-between text-sm text-[#7c6068]">
          <span>
            Question {questionNumber} of{" "}
            {totalQuestions}
          </span>

          <span>
            {paused
              ? "Paused"
              : "Adaptive mode"}
          </span>
        </div>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        )}

        {question && (
          <section className="mt-8">
            <div
              className={`rounded-3xl border border-[#dfd0c3] bg-[#fffaf4] p-8 shadow-sm ${
                paused
                  ? "opacity-80"
                  : ""
              }`}
            >
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-[#efe3d8] px-3 py-1 text-xs font-medium">
                  {question.category}
                </span>

                <span className="rounded-full bg-[#efe3d8] px-3 py-1 text-xs font-medium">
                  {question.difficulty}
                </span>

                <span className="rounded-full bg-[#efe3d8] px-3 py-1 text-xs font-medium">
                  {question.target_skill}
                </span>
              </div>

              <div className="mt-8 flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#321e24] text-xl text-white">
                  AI
                </div>

                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#7c6068]">
                    Interviewer
                  </p>

                  <p className="mt-2 text-2xl font-medium leading-relaxed">
                    {question.question}
                  </p>
                </div>
              </div>

              {mode === "voice" && (
                <div className="mt-8 rounded-2xl border border-[#e0d1c5] bg-[#fbf5ee] p-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        speak(
                          question.question,
                        )
                      }
                      disabled={
                        paused ||
                        submitting
                      }
                      className="rounded-xl border border-[#cebcb1] px-4 py-2 text-sm font-medium hover:bg-white disabled:opacity-50"
                    >
                      🔊 Repeat Question
                    </button>

                    {speaking &&
                      !speechPaused && (
                        <button
                          type="button"
                          onClick={
                            pauseSpeech
                          }
                          disabled={
                            paused ||
                            submitting
                          }
                          className="rounded-xl border border-[#cebcb1] px-4 py-2 text-sm font-medium hover:bg-white disabled:opacity-50"
                        >
                          ⏸ Pause Question
                        </button>
                      )}

                    {speechPaused && (
                      <button
                        type="button"
                        onClick={
                          resumeSpeech
                        }
                        disabled={
                          paused ||
                          submitting
                        }
                        className="rounded-xl bg-[#6b1f2a] px-4 py-2 text-sm font-medium text-white hover:bg-[#571821] disabled:opacity-50"
                      >
                        ▶ Resume Question
                      </button>
                    )}

                    {(speaking ||
                      speechPaused) && (
                      <button
                        type="button"
                        onClick={
                          stopSpeech
                        }
                        disabled={
                          submitting
                        }
                        className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                      >
                        ⏹ Stop Question
                      </button>
                    )}

                    {!listening ? (
                      <button
                        type="button"
                        onClick={
                          startListening
                        }
                        disabled={
                          !speechSupported ||
                          paused ||
                          submitting
                        }
                        className="rounded-xl bg-[#6b1f2a] px-5 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        🎤 Start Answer
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={
                          stopListening
                        }
                        disabled={
                          submitting
                        }
                        className="rounded-xl bg-[#321e24] px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
                      >
                        ⏹ Stop Listening
                      </button>
                    )}

                    {speaking &&
                      !speechPaused && (
                        <span className="text-sm text-[#6b1f2a]">
                          🔊 Speaking...
                        </span>
                      )}

                    {speechPaused && (
                      <span className="text-sm font-medium text-[#7c6068]">
                        ⏸ Question paused
                      </span>
                    )}

                    {listening && (
                      <span className="text-sm font-medium text-[#6b1f2a]">
                        🎤 Listening...
                      </span>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-full bg-white px-3 py-1 text-xs text-[#7c6068]">
                      Pause = pause speech
                    </span>

                    <span className="rounded-full bg-white px-3 py-1 text-xs text-[#7c6068]">
                      Stop = stop speech
                    </span>

                    <span className="rounded-full bg-white px-3 py-1 text-xs text-[#7c6068]">
                      Skip = change question
                    </span>
                  </div>

                  {!speechSupported && (
                    <p className="mt-3 text-sm text-[#8a6a70]">
                      Speech recognition is not
                      available in this browser.
                      Text mode still works.
                    </p>
                  )}

                  {voiceError && (
                    <p className="mt-3 text-sm text-red-700">
                      {voiceError}
                    </p>
                  )}
                </div>
              )}

              <div className="mt-8">
                <label className="text-sm font-medium">
                  Your answer
                </label>

                <textarea
                  value={answer}
                  onChange={(event) =>
                    setAnswer(
                      event.target.value,
                    )
                  }
                  disabled={
                    submitting ||
                    paused
                  }
                  rows={8}
                  placeholder={
                    paused
                      ? "Resume the interview to continue answering."
                      : mode === "voice"
                        ? "Your spoken answer will appear here. You can edit the transcript before submitting."
                        : "Explain your answer as if you were speaking to a real interviewer..."
                  }
                  className="mt-3 w-full resize-none rounded-2xl border border-[#d9c9bf] bg-white p-5 text-sm leading-7 outline-none ring-[#6b1f2a] placeholder:text-[#aa9690] focus:ring-2 disabled:cursor-not-allowed disabled:bg-[#f2e9e0]"
                />

                <div className="mt-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs text-[#8a7478]">
                      {answer.trim().length} characters
                    </p>

                    {!showSkipConfirm ? (
                      <button
                        type="button"
                        onClick={() =>
                          setShowSkipConfirm(
                            true,
                          )
                        }
                        disabled={
                          submitting ||
                          paused
                        }
                        className="mt-2 text-sm font-medium text-[#7c6068] underline underline-offset-4 hover:text-[#6b1f2a] disabled:opacity-50"
                      >
                        Skip Question →
                      </button>
                    ) : (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="text-xs text-[#7c6068]">
                          Skip this question?
                        </span>

                        <button
                          type="button"
                          onClick={
                            skipQuestion
                          }
                          disabled={
                            submitting
                          }
                          className="rounded-lg bg-[#6b1f2a] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#571821] disabled:opacity-50"
                        >
                          Yes, Skip
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setShowSkipConfirm(
                              false,
                            )
                          }
                          disabled={
                            submitting
                          }
                          className="rounded-lg border border-[#d8c5ba] px-3 py-1.5 text-xs font-medium text-[#6f535b] hover:bg-white disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={
                      submitAnswer
                    }
                    disabled={
                      submitting ||
                      paused ||
                      !answer.trim()
                    }
                    className="rounded-xl bg-[#6b1f2a] px-6 py-3 text-sm font-medium text-white hover:bg-[#571821] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting
                      ? "AI is analyzing..."
                      : "Submit Answer →"}
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {score && (
          <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
            <div className="rounded-3xl border border-[#dfd0c3] bg-[#321e24] p-7 text-white">
              <p className="text-sm text-[#d9c8bd]">
                Answer score
              </p>

              <p className="mt-3 text-5xl font-semibold">
                {score.overall_score.toFixed(
                  1,
                )}

                <span className="text-lg font-normal text-[#ccb8ad]">
                  /5
                </span>
              </p>

              <div className="mt-7 space-y-4">
                <ScoreRow
                  label="Correctness"
                  value={
                    score.correctness_score
                  }
                />

                <ScoreRow
                  label="Structure"
                  value={
                    score.structure_score
                  }
                />

                <ScoreRow
                  label="Specificity"
                  value={
                    score.specificity_score
                  }
                />

                <ScoreRow
                  label="Communication"
                  value={
                    score.communication_score
                  }
                />
              </div>
            </div>

            <div className="rounded-3xl border border-[#dfd0c3] bg-[#fffaf4] p-7">
              <p className="text-sm font-semibold uppercase tracking-[0.15em] text-[#6b1f2a]">
                AI feedback
              </p>

              <p className="mt-4 leading-7 text-[#514049]">
                {score.feedback}
              </p>

              <div className="mt-6 rounded-2xl bg-[#f2e7dc] p-5">
                <p className="text-sm font-semibold">
                  Stronger answer example
                </p>

                <p className="mt-3 text-sm leading-7 text-[#514049]">
                  {score.stronger_answer}
                </p>
              </div>

              {pendingNextQuestion && (
                <div className="mt-6 rounded-2xl border border-[#d8c5ba] bg-white p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#6b1f2a]">
                    Next interviewer move
                  </p>

                  <p className="mt-2 text-sm text-[#7c6068]">
                    The AI has selected
                    the next question
                    based on your answer.
                  </p>

                  <p className="mt-3 text-sm font-medium leading-6">
                    {
                      pendingNextQuestion.question
                    }
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-full bg-[#efe3d8] px-3 py-1 text-xs">
                      {
                        pendingNextQuestion.category
                      }
                    </span>

                    <span className="rounded-full bg-[#efe3d8] px-3 py-1 text-xs">
                      {
                        pendingNextQuestion.difficulty
                      }
                    </span>

                    <span className="rounded-full bg-[#efe3d8] px-3 py-1 text-xs">
                      {
                        pendingNextQuestion.target_skill
                      }
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={
                      continueToNextQuestion
                    }
                    className="mt-5 w-full rounded-xl bg-[#6b1f2a] px-5 py-3 text-sm font-medium text-white hover:bg-[#571821]"
                  >
                    Continue to Next Question →
                  </button>
                </div>
              )}
            </div>
          </section>
        )}

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <Tip
            title="Cross-questioning"
            text="The interviewer can probe claims or incomplete explanations from your previous answer."
          />

          <Tip
            title="Topic switching"
            text="When a topic has been explored enough, the AI can move to another important skill."
          />

          <Tip
            title="Persistent session"
            text="Pause the interview and come back later without losing the current question or progress."
          />
        </div>
      </div>

      {showEndConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <div className="w-full max-w-md rounded-3xl border border-[#dfd0c3] bg-[#fffaf4] p-7 shadow-xl">
            <p className="text-sm font-semibold uppercase tracking-[0.15em] text-red-700">
              End interview
            </p>

            <h2 className="mt-3 text-2xl font-semibold">
              End this interview session?
            </h2>

            <p className="mt-3 text-sm leading-6 text-[#7c6068]">
              Your existing answers will remain
              saved, but this session will be marked
              as ended. You can start a new interview
              later.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() =>
                  setShowEndConfirm(false)
                }
                disabled={submitting}
                className="rounded-xl border border-[#d8c5ba] px-4 py-2.5 text-sm font-medium hover:bg-white disabled:opacity-50"
              >
                Continue Interview
              </button>

              <button
                type="button"
                onClick={
                  endInterview
                }
                disabled={submitting}
                className="rounded-xl bg-red-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50"
              >
                {submitting
                  ? "Ending..."
                  : "End Interview"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function ScoreRow({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-[#decfc4]">
          {label}
        </span>

        <span className="font-semibold">
          {value}/5
        </span>
      </div>

      <div className="mt-2 h-1.5 rounded-full bg-[#5b464c]">
        <div
          className="h-full rounded-full bg-[#f2ddd2]"
          style={{
            width: `${value * 20}%`,
          }}
        />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-[#dfd0c3] bg-[#fbf5ee] p-5">
      <p className="text-xs uppercase tracking-[0.15em] text-[#8a7478]">
        {label}
      </p>

      <p className="mt-2 text-xl font-semibold">
        {value}
      </p>
    </div>
  );
}

function Tip({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-[#dfd0c3] bg-[#fffaf4] p-5">
      <p className="font-semibold">
        {title}
      </p>

      <p className="mt-2 text-sm leading-6 text-[#806a72]">
        {text}
      </p>
    </div>
  );
}
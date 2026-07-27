"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchPopularQuestions } from "@/lib/api";

const FALLBACK_QUESTIONS = [
  "Is BMU UGC approved?",
  "Does BMU have hostels?",
  "What is the International Immersion programme?",
  "How can I apply to BMU?",
];

export default function Home() {
  const router = useRouter();
  const [questions, setQuestions] = useState(FALLBACK_QUESTIONS);

  useEffect(() => {
    fetchPopularQuestions(4).then((real) => {
      if (real.length > 0) setQuestions(real);
    });
  }, []);

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <h1 className="font-display font-semibold text-5xl md:text-6xl">
        Shape Your Future <br/>at <span className="text-accent22">BML Munjal University</span>
      </h1>
      <p className="mt-4 max-w-xl text-lg text-text-muted">
        Your AI Admissions Counsellor -- answers grounded only in BMU&apos;s official
        information.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-2">
        {questions.map((q, i) => (
          <button
            key={i}
            type="button"
            onClick={() => router.push(`/ai/q/${encodeURIComponent(q)}`)}
            className="rounded-full border border-border bg-card px-4 py-2 text-base text-text-muted hover:text-text hover:border-accent"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

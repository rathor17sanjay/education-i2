"use client";

import { useRouter } from "next/navigation";

const STARTER_QUESTIONS = [
  "Is BMU UGC approved?",
  "Does BMU have hostels?",
  "What is the International Immersion programme?",
  "How can I apply to BMU?",
];

export default function Home() {
  const router = useRouter();

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <h1 className="font-display text-5xl md:text-6xl">
        Ask me anything about BML Munjal University
      </h1>
      <p className="mt-3 max-w-xl text-text-muted">
        Your AI Admissions Counsellor -- answers grounded only in BMU&apos;s official
        information.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-2">
        {STARTER_QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => router.push(`/ai/q/${encodeURIComponent(q)}`)}
            className="rounded-full border border-border bg-card px-4 py-2 text-sm text-text-muted hover:text-text hover:border-accent"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchPopularQuestions } from "@/lib/api";

// Generic, tenant-agnostic -- shown only until real popular-question data
// exists for this tenant (fetchPopularQuestions returns real ones once
// there's query history). Never mention a specific university by name here.
function fallbackQuestions(brandName: string) {
  return [
    `What programmes does ${brandName} offer?`,
    `How can I apply to ${brandName}?`,
    `What are the admission requirements?`,
    `Does the campus have hostels?`,
  ];
}

export default function PopularQuestions({ brandName }: { brandName: string }) {
  const router = useRouter();
  const [questions, setQuestions] = useState<string[]>(() => fallbackQuestions(brandName));

  useEffect(() => {
    fetchPopularQuestions(4).then((real) => {
      if (real.length > 0) setQuestions(real);
    });
  }, []);

  return (
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
  );
}

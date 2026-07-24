"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { TENANT_SLUG } from "@/lib/api";

// Sticky, always visible regardless of page content -- the Apply Now CTA
// is never buried (per CLAUDE.md's Sharda-benchmark page template).
export default function Footer() {
  const router = useRouter();
  const [value, setValue] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const question = value.trim();
    if (!question) return;
    router.push(`/ai/q/${encodeURIComponent(question)}`);
    setValue("");
  }

  return (
    <footer className="sticky bottom-0 z-10 border-t border-border bg-bg px-6 py-4">
      <form onSubmit={submit} className="mx-auto flex max-w-6xl gap-3">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={`Ask me anything about ${TENANT_SLUG.toUpperCase()}...`}
          className="flex-1 rounded-full border border-border bg-card px-5 py-3 text-text placeholder:text-text-muted focus:outline-none focus:border-accent"
        />
        <button
          type="submit"
          className="rounded-full bg-card px-5 py-3 text-sm text-text-muted hover:text-text border border-border"
        >
          ➤
        </button>
        <a
          href="#apply"
          className="rounded-full bg-accent px-6 py-3 text-sm font-medium text-accent-foreground whitespace-nowrap"
        >
          Apply Now
        </a>
      </form>
      <p className="mx-auto mt-2 max-w-6xl text-center text-xs text-text-muted">
        AI can make mistakes. Powered by GT CampusAI.
      </p>
    </footer>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";

// Persistent across every route -- never re-renders on navigation, per
// CLAUDE.md's "header and sticky footer never re-render or flicker during a
// query transition" requirement (this lives in the root layout, not a page).
export default function Header() {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");

  async function saveResult() {
    // Every answer already has its own URL (the Sharda-style per-query
    // routing) -- "saving" it is just copying that link.
    try {
      await navigator.clipboard.writeText(window.location.href);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
    setTimeout(() => setStatus("idle"), 2000);
  }

  const label = { idle: "Save Result", copied: "Link copied!", failed: "Couldn't copy link" }[status];

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-bg px-6 py-4">
      <Link href="/" className="font-display text-lg text-text">
        GT CampusAI
      </Link>
      <div className="flex items-center gap-4 text-sm text-text-muted">
        <button type="button" onClick={saveResult} className="hover:text-text">
          {label}
        </button>
        <button type="button" className="hover:text-text">
          ⋯
        </button>
      </div>
    </header>
  );
}

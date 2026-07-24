"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { TENANT_SLUG } from "@/lib/api";

// Types the phrase out, pauses, deletes it, pauses, and repeats -- used to
// animate the search input's placeholder instead of a static string.
function useTypewriter(phrase: string) {
  const [text, setText] = useState("");

  useEffect(() => {
    let i = 0;
    let deleting = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    function tick() {
      i += deleting ? -1 : 1;
      setText(phrase.slice(0, i));

      if (!deleting && i === phrase.length) {
        deleting = true;
        timeoutId = setTimeout(tick, 1500); // pause on full phrase
      } else if (deleting && i === 0) {
        deleting = false;
        timeoutId = setTimeout(tick, 500); // pause on empty
      } else {
        timeoutId = setTimeout(tick, deleting ? 40 : 90);
      }
    }

    timeoutId = setTimeout(tick, 90);
    return () => clearTimeout(timeoutId);
  }, [phrase]);

  return text;
}

// Sticky, always visible regardless of page content -- the Apply Now CTA
// is never buried (per CLAUDE.md's Sharda-benchmark page template).
export default function Footer() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const typed = useTypewriter(`Ask ${TENANT_SLUG.toUpperCase()} AI`);

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
        <div className="relative flex-1">
          <Image
            src="/bmu-icon.png"
            alt=""
            width={24}
            height={24}
            className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 rounded-full"
          />
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={typed ? `${typed}|` : ""}
            className="w-full rounded-full border border-border bg-card py-3 pr-5 pl-12 text-base text-text placeholder:text-text-muted focus:outline-none focus:border-accent"
          />
        </div>
        <button
          type="submit"
          className="rounded-full bg-card px-5 py-3 text-base text-text-muted hover:text-text border border-border"
        >
          ➤
        </button>
        <a
          href="#apply"
          className="rounded-full bg-accent px-6 py-3 text-base font-medium text-accent-foreground whitespace-nowrap"
        >
          Apply Now
        </a>
      </form>
      <p className="mx-auto mt-2 max-w-6xl text-center text-sm text-text-muted">
        AI can make mistakes. Powered by CampusAI.
      </p>
    </footer>
  );
}

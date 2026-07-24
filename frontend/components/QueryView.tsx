"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { streamQuery, type BlocksPayload, type TitlePayload } from "@/lib/api";
import BlockRenderer from "@/components/blocks/BlockRenderer";

const STATUS_MESSAGES = [
  "Searching BMU's records...",
  "Checking official sources...",
  "Drafting your answer...",
];

function GeneratingStatus() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => Math.min(i + 1, STATUS_MESSAGES.length - 1));
    }, 1800);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="mt-8 space-y-3">
      <div className="h-32 animate-pulse rounded-xl bg-card" />
      <p className="text-sm text-text-muted">{STATUS_MESSAGES[index]}</p>
    </div>
  );
}

export default function QueryView({ question }: { question: string }) {
  const router = useRouter();
  const [title, setTitle] = useState<TitlePayload | null>(null);
  const [blocks, setBlocks] = useState<BlocksPayload | null>(null);
  const [blocksVisible, setBlocksVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setTitle(null);
    setBlocks(null);
    setBlocksVisible(false);
    setError(null);

    streamQuery(question, {
      onTitle: (payload) => {
        if (!cancelled) setTitle(payload);
      },
      onBlocks: (payload) => {
        if (!cancelled) {
          setBlocks(payload);
          // Mount at opacity-0 first, then transition in on the next frame
          // -- gives the blocks a soft fade-in instead of popping in.
          requestAnimationFrame(() => {
            if (!cancelled) setBlocksVisible(true);
          });
        }
      },
      onError: (message) => {
        if (!cancelled) setError(message);
      },
    });

    return () => {
      cancelled = true;
    };
  }, [question]);

  if (error) {
    return (
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        <p className="text-text-muted">
          Something went wrong answering that. Please try again or contact admissions
          directly.
        </p>
      </div>
    );
  }

  // Phase 1 loading: nothing has arrived yet.
  if (!title) {
    return (
      <div className="mx-auto w-full max-w-6xl px-6 py-10 animate-pulse">
        <div className="h-8 w-2/3 rounded bg-card" />
        <div className="mt-3 h-4 w-1/2 rounded bg-card" />
        <div className="mt-8 h-32 rounded-xl bg-card" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <h1 className="font-display text-4xl md:text-5xl">{title.title}</h1>
      <p className="mt-2 text-text-muted">{title.subtitle}</p>

      {/* Phase 2 loading: title is up, blocks are still generating. */}
      {!blocks && <GeneratingStatus />}

      {blocks && (
        <div
          className={`transition-opacity duration-500 ${blocksVisible ? "opacity-100" : "opacity-0"}`}
        >
          <div className="mt-8 space-y-6">
            {blocks.blocks.map((block, i) => (
              <BlockRenderer key={i} block={block} />
            ))}
          </div>

          {blocks.follow_up_chips.length > 0 && (
            <div className="mt-8 flex flex-wrap gap-2">
              {blocks.follow_up_chips.map((chip, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => router.push(`/ai/q/${encodeURIComponent(chip)}`)}
                  className="rounded-full border border-border bg-card px-4 py-2 text-sm text-text-muted hover:text-text hover:border-accent"
                >
                  {chip}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

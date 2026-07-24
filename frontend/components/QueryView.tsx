"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { streamQuery, type BlocksPayload, type TitlePayload } from "@/lib/api";
import BlockRenderer from "@/components/blocks/BlockRenderer";

export default function QueryView({ question }: { question: string }) {
  const router = useRouter();
  const [title, setTitle] = useState<TitlePayload | null>(null);
  const [blocks, setBlocks] = useState<BlocksPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setTitle(null);
    setBlocks(null);
    setError(null);

    streamQuery(question, {
      onTitle: (payload) => {
        if (!cancelled) setTitle(payload);
      },
      onBlocks: (payload) => {
        if (!cancelled) setBlocks(payload);
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
      <h1 className="font-display text-3xl md:text-4xl">{title.title}</h1>
      <p className="mt-2 text-text-muted">{title.subtitle}</p>

      {/* Phase 2 loading: title is up, blocks are still generating. */}
      {!blocks && (
        <div className="mt-8 animate-pulse space-y-3">
          <div className="h-32 rounded-xl bg-card" />
          <div className="h-4 w-1/3 rounded bg-card" />
        </div>
      )}

      {blocks && (
        <>
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
        </>
      )}
    </div>
  );
}

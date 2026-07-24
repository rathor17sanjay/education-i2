"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { streamQuery, type BlocksPayload, type TitlePayload } from "@/lib/api";
import BlockRenderer from "@/components/blocks/BlockRenderer";

// A single indeterminate progress bar -- no real step-by-step progress
// exists server-side, so this signals "still working" without faking a
// completion percentage. `delay` staggers the two Phase-0 bars so they
// don't sweep in lockstep, matching the Sharda reference.
function ProgressBar({ delay = 0, className = "" }: { delay?: number; className?: string }) {
  return (
    <div className={`h-1.5 overflow-hidden rounded-full bg-border ${className}`}>
      <div
        className="h-full w-1/3 rounded-full bg-accent"
        style={{
          animation: "indeterminate-sweep 1.4s ease-in-out infinite",
          animationDelay: `${delay}s`,
        }}
      />
    </div>
  );
}

// Phase 0: shown the instant a question is submitted, before the title has
// even arrived -- mirrors Sharda AI's "Understanding your query..." card,
// which echoes the literal question back so the user knows it registered.
function UnderstandingQuery({ question }: { question: string }) {
  return (
    <div className="flex flex-1 items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-bg-elevated p-8 text-center">
        <p className="font-display text-lg text-text">GT CampusAI</p>
        <div className="mt-6 space-y-2">
          <ProgressBar />
          <ProgressBar delay={0.35} className="w-1/2" />
        </div>
        <p className="mt-6 font-medium text-text">Understanding your query...</p>
        <p className="mt-2 text-sm text-text-muted">&ldquo;{question}&rdquo;</p>
      </div>
    </div>
  );
}

// Phase 2: title is up, blocks are still generating -- a persistent
// "Generating more content..." indicator plus skeleton placeholders for the
// blocks still to come, instead of a bare pulsing box.
function GeneratingMoreContent() {
  return (
    <div className="mt-8">
      <div className="flex items-center gap-3">
        <ProgressBar className="w-24" />
        <p className="text-sm text-text-muted">Generating more content...</p>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="animate-pulse rounded-xl border border-border bg-card p-6">
            <div className="h-4 w-1/2 rounded bg-border" />
            <div className="mt-4 h-3 w-full rounded bg-border" />
            <div className="mt-2 h-3 w-5/6 rounded bg-border" />
          </div>
        ))}
      </div>
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

  // Phase 0 loading: nothing has arrived yet -- the question was just
  // submitted and is being classified/retrieved server-side.
  if (!title) {
    return <UnderstandingQuery question={question} />;
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <h1 className="font-display text-4xl md:text-5xl">{title.title}</h1>
      <p className="mt-2 text-text-muted">{title.subtitle}</p>

      {/* Phase 2 loading: title is up, blocks are still generating. */}
      {!blocks && <GeneratingMoreContent />}

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

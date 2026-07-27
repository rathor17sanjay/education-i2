"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  streamQuery,
  fetchTenantTheme,
  TENANT_SLUG,
  type BlocksPayload,
  type TitlePayload,
} from "@/lib/api";
import BlockRenderer from "@/components/blocks/BlockRenderer";
import BrandAvatar from "@/components/BrandAvatar";

// Tenant-customizable via superadmin's "Loader messages" field (one per
// line); falls back to the auto-generated "{brand} AI is..." sequence when
// unset, same as before this was configurable.
function loaderMessages(brandName: string, custom: string | null) {
  if (custom) {
    const lines = custom.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length > 0) return lines;
  }
  return [
    `${brandName} AI is understanding your query...`,
    `${brandName} AI is checking the details...`,
    `${brandName} AI is crafting your answer...`,
  ];
}

// Advances through `messages` on a fixed interval and holds on the last one.
// Driven from QueryView (not the individual phase components) so it keeps
// advancing continuously across the Phase-0 -> Phase-2 handoff instead of
// resetting -- title typically arrives in ~1.5-2s, faster than a single
// interval tick, so confining the rotation to Phase 0 alone meant it never
// got past the first message before Phase 2's separate static text took
// over. `resetKey` (the question) restarts the sequence for a new query.
function useRotatingMessage(messages: string[], resetKey: string, intervalMs = 3200) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
    const id = setInterval(() => {
      setIndex((i) => {
        if (i >= messages.length - 1) {
          clearInterval(id);
          return i;
        }
        return i + 1;
      });
    }, intervalMs);
    return () => clearInterval(id);
  }, [messages, resetKey, intervalMs]);

  return messages[index];
}

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
function UnderstandingQuery({
  question,
  message,
  logoUrl,
  brandName,
}: {
  question: string;
  message: string;
  logoUrl?: string | null;
  brandName: string;
}) {
  return (
    <div className="flex flex-1 items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-bg-elevated p-8 text-center">
        {logoUrl ? (
          <Image
            src={logoUrl}
            alt="University logo"
            width={130}
            height={50}
            unoptimized
            className="mx-auto"
          />
        ) : (
          <BrandAvatar brandName={brandName} size={56} className="mx-auto" />
        )}
        <div className="mt-6 space-y-2">
          <ProgressBar />
          <ProgressBar delay={0.35} className="w-1/2" />
        </div>
        <p className="mt-6 text-lg font-medium text-text">{message}</p>
        <p className="mt-2 text-base text-text-muted">&ldquo;{question}&rdquo;</p>
      </div>
    </div>
  );
}

// Phase 2: title is up, blocks are still generating -- continues the same
// rotating status message from Phase 0 (rather than switching to a separate
// static line) plus skeleton placeholders for the blocks still to come.
function GeneratingMoreContent({ message }: { message: string }) {
  return (
    <div className="mt-8">
      <div className="flex items-center gap-3">
        <ProgressBar className="w-24" />
        <p className="text-base text-text-muted">{message}</p>
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
  const [theme, setTheme] = useState<{
    logo_url: string | null;
    brand_name: string | null;
    loader_messages: string | null;
  }>({
    logo_url: null,
    brand_name: null,
    loader_messages: null,
  });
  const loaderMessage = useRotatingMessage(
    loaderMessages(theme.brand_name || TENANT_SLUG.toUpperCase(), theme.loader_messages),
    question,
  );

  useEffect(() => {
    let cancelled = false;
    fetchTenantTheme().then((t) => {
      if (!cancelled)
        setTheme({
          logo_url: t.logo_url,
          brand_name: t.brand_name,
          loader_messages: t.loader_messages,
        });
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
    return (
      <UnderstandingQuery
        question={question}
        message={loaderMessage}
        logoUrl={theme.logo_url}
        brandName={theme.brand_name || TENANT_SLUG.toUpperCase()}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <h1 className="font-display font-semibold text-4xl md:text-5xl">{title.title}</h1>
      <p className="mt-2 text-lg text-text-muted">{title.subtitle}</p>

      {/* Phase 2 loading: title is up, blocks are still generating. */}
      {!blocks && <GeneratingMoreContent message={loaderMessage} />}

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
                  className="rounded-full border border-border bg-card px-4 py-2 text-base text-text-muted hover:text-text hover:border-accent"
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

"use client";

import { useState } from "react";
import type { FaqAccordionBlock } from "@/lib/blocks";

export default function FaqAccordion({ block }: { block: FaqAccordionBlock }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="rounded-xl border border-border bg-card divide-y divide-border">
      {block.items.map((item, i) => {
        const open = openIndex === i;
        return (
          <div key={i}>
            <button
              type="button"
              onClick={() => setOpenIndex(open ? null : i)}
              className="w-full flex items-center justify-between gap-4 px-6 py-4 text-left"
            >
              <span className="font-medium">{item.question}</span>
              <span className={`text-accent transition-transform ${open ? "rotate-180" : ""}`}>
                ⌄
              </span>
            </button>
            {open && (
              <p className="px-6 pb-4 text-text-muted leading-relaxed">{item.answer}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

import type { StatGridBlock } from "@/lib/blocks";

// Stat values (e.g. "₹5,23,591 LPA") can be long -- forcing all 4 columns
// into one row at a bigger font caused overlap, so this wraps to 2 columns
// on narrow viewports and only expands to a single row once there's room.
const GRID_COLS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-2 sm:grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-4",
};

export default function StatGrid({ block }: { block: StatGridBlock }) {
  const cols = Math.min(block.stats.length, 4);

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className={`grid gap-y-6 divide-border sm:divide-x ${GRID_COLS[cols]}`}>
        {block.stats.map((stat, i) => (
          <div
            key={i}
            className="px-3 text-center transition-transform duration-200 hover:-translate-y-0.5"
          >
            <div className="font-display font-semibold text-2xl sm:text-3xl md:text-4xl leading-tight break-words text-accent">
              {stat.value}
            </div>
            <div className="mx-auto mt-2 h-0.5 w-6 rounded-full bg-accent/40" />
            <div className="mt-2 text-base text-text-muted">{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

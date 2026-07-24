import type { StatGridBlock } from "@/lib/blocks";

export default function StatGrid({ block }: { block: StatGridBlock }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div
        className="grid gap-6"
        style={{ gridTemplateColumns: `repeat(${Math.min(block.stats.length, 4)}, minmax(0, 1fr))` }}
      >
        {block.stats.map((stat, i) => (
          <div key={i} className="text-center">
            <div className="font-display text-3xl text-accent">{stat.value}</div>
            <div className="mt-1 text-sm text-text-muted">{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

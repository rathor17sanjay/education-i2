import type { StatGridBlock } from "@/lib/blocks";

export default function StatGrid({ block }: { block: StatGridBlock }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div
        className="grid divide-x divide-border"
        style={{ gridTemplateColumns: `repeat(${Math.min(block.stats.length, 4)}, minmax(0, 1fr))` }}
      >
        {block.stats.map((stat, i) => (
          <div
            key={i}
            className="px-3 text-center transition-transform duration-200 hover:-translate-y-0.5"
          >
            <div className="font-display text-3xl text-accent">{stat.value}</div>
            <div className="mx-auto mt-2 h-0.5 w-6 rounded-full bg-accent/40" />
            <div className="mt-2 text-sm text-text-muted">{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

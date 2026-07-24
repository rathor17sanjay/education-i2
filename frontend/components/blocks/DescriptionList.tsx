import type { DescriptionListBlock } from "@/lib/blocks";

export default function DescriptionList({ block }: { block: DescriptionListBlock }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h3 className="font-display font-semibold text-2xl mb-2">{block.heading}</h3>
      <p className="text-lg text-text-muted mb-4 leading-relaxed">{block.body}</p>
      {block.bullets.length > 0 && (
        <ul className="space-y-2 text-lg">
          {block.bullets.map((bullet, i) => (
            <li key={i} className="flex gap-3 leading-relaxed">
              <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

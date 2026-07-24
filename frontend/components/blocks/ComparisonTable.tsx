import type { ComparisonTableBlock } from "@/lib/blocks";

export default function ComparisonTable({ block }: { block: ComparisonTableBlock }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            {block.headers.map((header, i) => (
              <th
                key={i}
                className="px-4 py-3 font-display text-accent border-b border-border whitespace-nowrap"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, i) => (
            <tr key={i} className="border-b border-border last:border-0">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-3 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

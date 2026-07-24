import Link from "next/link";

// Persistent across every route -- never re-renders on navigation, per
// CLAUDE.md's "header and sticky footer never re-render or flicker during a
// query transition" requirement (this lives in the root layout, not a page).
export default function Header() {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-bg px-6 py-4">
      <Link href="/" className="font-display text-lg text-text">
        GT CampusAI
      </Link>
      <div className="flex items-center gap-4 text-sm text-text-muted">
        <button type="button" className="hover:text-text">
          Save Result
        </button>
        <button type="button" className="hover:text-text">
          ⋯
        </button>
      </div>
    </header>
  );
}

// Fallback for a missing tenant logo/icon -- CLAUDE.md's documented pattern
// for missing images ("a solid card with a large amber initial-letter
// avatar instead of a broken image icon"), reused here instead of ever
// defaulting to another tenant's actual logo file.
export default function BrandAvatar({
  brandName,
  size,
  className = "",
}: {
  brandName: string;
  size: number;
  className?: string;
}) {
  const initial = brandName.trim().charAt(0).toUpperCase() || "?";
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-accent font-display font-semibold text-accent-foreground ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.45 }}
    >
      {initial}
    </span>
  );
}

import { fetchTenantThemeServer, TENANT_SLUG } from "@/lib/api";
import PopularQuestions from "@/components/PopularQuestions";

export default async function Home() {
  const theme = await fetchTenantThemeServer();
  const brandName = theme.brand_name || TENANT_SLUG.toUpperCase();
  // No tenant should ever fall back to another tenant's name -- these
  // defaults are derived from the current tenant's own brand_name/slug,
  // never a hardcoded university.
  const headline = theme.headline || `Shape Your Future at ${brandName}`;
  const subheadline =
    theme.subheadline ||
    `Your AI Admissions Counsellor -- answers grounded only in ${brandName}'s official information.`;

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <h1 className="font-display font-semibold text-5xl md:text-6xl">{headline}</h1>
      <p className="mt-4 max-w-xl text-lg text-text-muted">{subheadline}</p>

      <PopularQuestions brandName={brandName} />
    </div>
  );
}

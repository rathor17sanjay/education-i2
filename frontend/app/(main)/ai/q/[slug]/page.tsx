import QueryView from "@/components/QueryView";
import { fetchTenantThemeServer } from "@/lib/api";

export default async function QueryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const question = decodeURIComponent(slug);
  // Memoized against the root layout's own fetchTenantThemeServer() call --
  // same URL/options within one render pass, so this is one real network
  // call, not two (see lib/api.ts). Passed as a prop so QueryView never
  // needs its own client-side fetch/round-trip for branding.
  const theme = await fetchTenantThemeServer();

  return <QueryView question={question} theme={theme} />;
}

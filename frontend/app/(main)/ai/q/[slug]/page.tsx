import QueryView from "@/components/QueryView";

export default async function QueryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const question = decodeURIComponent(slug);

  return <QueryView question={question} />;
}

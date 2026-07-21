import { ListeningPageClient } from "@/components/listening/ListeningPageClient";

export default async function ListeningPage({ searchParams }: PageProps<"/listen">) {
  const params = await searchParams;
  const requestedCode = typeof params.code === "string" ? params.code.toUpperCase() : "";
  const initialCode = /^[A-HJ-NP-Z2-9]{6}$/.test(requestedCode) ? requestedCode : "";
  return <ListeningPageClient initialCode={initialCode} />;
}

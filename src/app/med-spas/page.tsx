import { getMedSpas } from "@/lib/actions";
import { MedSpaList } from "@/components/med-spa-list";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ new?: string }>;
}

export default async function MedSpasPage({ searchParams }: Props) {
  const params = await searchParams;
  const spas = await getMedSpas();

  return <MedSpaList spas={spas} autoOpen={params.new === "1"} />;
}

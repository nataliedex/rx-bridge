import { notFound } from "next/navigation";
import Link from "next/link";
import { getMedSpaDetail } from "@/lib/actions";
import { MedSpaDetailClient } from "@/components/med-spa-detail-client";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function MedSpaDetailPage({ params }: Props) {
  const { id } = await params;
  const spa = await getMedSpaDetail(id);
  if (!spa) notFound();

  const location = [spa.city, spa.state].filter(Boolean).join(", ");

  return (
    <div>
      <div className="mb-6">
        <Link href="/med-spas" className="text-sm text-indigo-600 hover:underline">&larr; Back to Med Spas</Link>
        <div className="flex items-center gap-3 mt-2">
          <h1 className="text-2xl font-semibold">{spa.name}</h1>
        </div>
        {location && <p className="text-sm text-gray-500 mt-1">{location}</p>}
      </div>

      <MedSpaDetailClient spa={spa} />
    </div>
  );
}

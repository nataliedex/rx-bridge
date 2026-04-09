import { notFound } from "next/navigation";
import Link from "next/link";
import { getPharmacyDetail, getPricingStrategy } from "@/lib/actions";
import { prisma } from "@/lib/db";
import { PharmacyContactCard } from "@/components/pharmacy-contact-card";
import { PharmacyContractSection } from "@/components/pharmacy-contract-section";
import { ContractHistory } from "@/components/contract-history";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PharmacyDetailPage({ params }: Props) {
  const { id } = await params;
  const [pharmacy, allMedications, strategy] = await Promise.all([
    getPharmacyDetail(id),
    prisma.medication.findMany({ select: { id: true, name: true, form: true }, orderBy: { name: "asc" } }),
    getPricingStrategy(),
  ]);
  if (!pharmacy) notFound();

  const contractMedications = pharmacy.medicationPriceHistory.map((p) => ({
    id: p.id,
    medicationId: p.medicationId,
    medicationName: p.medication.name,
    medicationForm: p.medication.form,
    currentPrice: p.price,
    effectiveDate: p.effectiveDate.toISOString(),
  }));

  const auditLogs = pharmacy.contractAuditLogs.map((l) => ({
    id: l.id,
    actionType: l.actionType,
    changedFields: l.changedFields,
    notes: l.notes,
    performedBy: l.performedBy,
    performedAt: l.performedAt.toISOString(),
  }));

  return (
    <div>
      <div className="mb-6">
        <Link href="/partnerships/pharmacies" className="text-sm text-indigo-600 hover:underline">&larr; Back to Pharmacies</Link>
        <h1 className="text-2xl font-semibold mt-2">{pharmacy.name}</h1>
        {pharmacy.archivedAt && (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-500 ml-2">Archived</span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <PharmacyContractSection
            pharmacyId={pharmacy.id}
            pharmacyName={pharmacy.name}
            medications={contractMedications}
            catalog={allMedications}
            contractVerifiedAt={pharmacy.contractVerifiedAt?.toISOString() ?? null}
            contractVerifiedBy={pharmacy.contractVerifiedBy}
            contractEffectiveFrom={pharmacy.contractEffectiveFrom?.toISOString() ?? null}
            contractEffectiveThrough={pharmacy.contractEffectiveThrough?.toISOString() ?? null}
            freshnessMonths={strategy.freshnessMonths}
            defaultContractTermMonths={strategy.defaultContractTermMonths}
          />

          {auditLogs.length > 0 && (
            <ContractHistory logs={auditLogs} pharmacyId={pharmacy.id} />
          )}
        </div>

        <div className="space-y-6">
          <PharmacyContactCard pharmacyId={pharmacy.id} contactName={pharmacy.contactName} phone={pharmacy.phone} email={pharmacy.email} fax={pharmacy.fax} />
        </div>
      </div>
    </div>
  );
}

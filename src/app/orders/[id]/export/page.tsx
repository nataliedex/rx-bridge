import { notFound } from "next/navigation";
import Link from "next/link";
import { getOrder } from "@/lib/actions";
import { transformOrder } from "@/lib/transformers/pipeline";
import { SEND_READINESS_LABELS, isSendReadinessRelevant } from "@/lib/types";
import { JsonExportToggle } from "@/components/json-export-toggle";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ExportPage({ params }: Props) {
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) notFound();

  const { packet } = transformOrder(order);
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div>
      <div className="flex justify-between items-center mb-6 print:hidden">
        <Link href={`/orders/${id}`} className="text-sm text-indigo-600 hover:underline">&larr; Back to Order</Link>
        <div className="flex gap-3 items-center">
          <span className="text-xs text-gray-400">
            Format: {packet.format}{isSendReadinessRelevant(order.status) ? ` | Send Readiness: ${SEND_READINESS_LABELS[packet.sendReadiness]}` : ""}
          </span>
          <button
            onClick={undefined}
            className="border border-gray-300 rounded-md px-4 py-2 text-sm hover:bg-gray-50"
            id="print-btn"
          >
            Print
          </button>
        </div>
      </div>

      {/* Pharmacy-facing document */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-6 print:border-0 print:shadow-none">
        {/* Header */}
        <div className="bg-gray-900 text-white px-8 py-5 print:bg-black">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-lg font-bold tracking-tight">COMPOUNDING ORDER</h1>
              <p className="text-gray-300 text-sm mt-0.5">Rx-Bridge Prescription Routing</p>
            </div>
            <div className="text-right text-sm">
              <p className="font-mono">{packet.orderId}</p>
              <p className="text-gray-300">{today}</p>
            </div>
          </div>
        </div>

        <div className="px-8 py-6">
          {/* Patient + Prescriber side by side */}
          <div className="grid grid-cols-2 gap-8 mb-6">
            <div>
              <h2 className="text-xs font-bold uppercase text-gray-400 tracking-wider mb-2 border-b border-gray-200 pb-1">Patient</h2>
              <p className="font-semibold">{packet.patient.fullName}</p>
              <p className="text-sm text-gray-600">DOB: {packet.patient.dob}</p>
              {packet.patient.phone && <p className="text-sm text-gray-600">Tel: {packet.patient.phone}</p>}
              {packet.patient.email && <p className="text-sm text-gray-600">{packet.patient.email}</p>}
              {packet.patient.address && <p className="text-sm text-gray-600">{packet.patient.address}</p>}
            </div>
            <div>
              <h2 className="text-xs font-bold uppercase text-gray-400 tracking-wider mb-2 border-b border-gray-200 pb-1">Prescriber</h2>
              <p className="font-semibold">{packet.prescriber.name}</p>
              <p className="text-sm text-gray-600">NPI: {packet.prescriber.npi}</p>
              {packet.prescriber.clinic && <p className="text-sm text-gray-600">{packet.prescriber.clinic}</p>}
              {packet.prescriber.phone && <p className="text-sm text-gray-600">Tel: {packet.prescriber.phone}</p>}
              {packet.prescriber.fax && <p className="text-sm text-gray-600">Fax: {packet.prescriber.fax}</p>}
            </div>
          </div>

          {/* Prescription — the main content */}
          <div className="border border-gray-200 rounded-lg p-5 mb-6 bg-gray-50/50">
            <h2 className="text-xs font-bold uppercase text-gray-400 tracking-wider mb-3">Prescription</h2>
            <div className="mb-3">
              <p className="text-lg font-semibold">{packet.prescription.medication}</p>
              <p className="text-sm text-gray-600">
                {[packet.prescription.strength, packet.prescription.dosageForm, packet.prescription.route]
                  .filter(Boolean)
                  .join(" — ")}
              </p>
            </div>
            {packet.prescription.directions && (
              <div className="bg-white border border-gray-200 rounded px-4 py-3 mb-3">
                <p className="text-xs font-medium text-gray-400 uppercase mb-1">Sig</p>
                <p className="text-sm font-medium">{packet.prescription.directions}</p>
              </div>
            )}
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-xs text-gray-400">Qty</p>
                <p className="font-medium">{packet.prescription.quantity ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Refills</p>
                <p className="font-medium">{packet.prescription.refills}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Days Supply</p>
                <p className="font-medium">{packet.prescription.daysSupply ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">ICD-10</p>
                <p className="font-medium">{packet.prescription.diagnosis || "—"}</p>
              </div>
            </div>
            {packet.prescription.notes && (
              <div className="mt-3 text-sm text-gray-600">
                <span className="font-medium">Notes:</span> {packet.prescription.notes}
              </div>
            )}
          </div>

          {/* Pharmacy */}
          <div className="mb-6">
            <h2 className="text-xs font-bold uppercase text-gray-400 tracking-wider mb-2 border-b border-gray-200 pb-1">Dispensing Pharmacy</h2>
            <p className="font-semibold">{packet.pharmacy.name}</p>
            {packet.pharmacy.fax && <p className="text-sm text-gray-600">Fax: {packet.pharmacy.fax}</p>}
            {packet.pharmacy.email && <p className="text-sm text-gray-600">{packet.pharmacy.email}</p>}
          </div>

          {/* Compliance notes */}
          {(packet.compliance.missingRequired.length > 0 || packet.compliance.missingRecommended.length > 0 || packet.compliance.warnings.length > 0) && (
            <div className="border-t pt-4">
              <h2 className="text-xs font-bold uppercase text-gray-400 tracking-wider mb-2">Compliance Notes</h2>
              {packet.compliance.missingRequired.length > 0 && (
                <p className="text-sm text-red-700 mb-1"><strong>Missing Required:</strong> {packet.compliance.missingRequired.join(", ")}</p>
              )}
              {packet.compliance.missingRecommended.length > 0 && (
                <p className="text-sm text-yellow-700 mb-1"><strong>Missing Recommended:</strong> {packet.compliance.missingRecommended.join(", ")}</p>
              )}
              {packet.compliance.warnings.length > 0 && (
                <p className="text-sm text-yellow-700"><strong>Warnings:</strong> {packet.compliance.warnings.join(", ")}</p>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="border-t mt-6 pt-4 text-xs text-gray-400 text-center">
            Generated by Rx-Bridge on {new Date(packet.generatedAt).toLocaleString()}
            {order.brand && <> for {order.brand.name}</>}
          </div>
        </div>
      </div>

      {/* JSON export (hidden on print) */}
      <div className="print:hidden">
        <JsonExportToggle packet={JSON.parse(JSON.stringify(packet))} />
      </div>

      <script
        dangerouslySetInnerHTML={{
          __html: `document.getElementById('print-btn')?.addEventListener('click', () => window.print())`,
        }}
      />
    </div>
  );
}

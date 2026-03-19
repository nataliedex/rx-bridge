import { notFound } from "next/navigation";
import Link from "next/link";
import { getOrder } from "@/lib/actions";
import { transformOrder } from "@/lib/transformers/pipeline";
import { STATUS_LABELS, STATUS_COLORS, SEND_READINESS_LABELS, SEND_READINESS_COLORS, isSendReadinessRelevant, type OrderStatus, type SendReadiness } from "@/lib/types";
import { timeAgo } from "@/lib/format";
import { StatusUpdater } from "@/components/status-updater";
import { OpenIssues } from "@/components/open-issues";
import { WorkflowBanner } from "@/components/workflow-banner";
import { EditablePatient } from "@/components/editable-patient";
import { EditablePrescriber } from "@/components/editable-prescriber";
import { EditablePrescription } from "@/components/editable-prescription";
import { EditableInternalNotes } from "@/components/editable-internal-notes";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function OrderDetailPage({ params }: Props) {
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) notFound();

  const { normalized, packet } = transformOrder(order);
  const openIssues = order.issues.filter((i) => i.status === "open");

  const issueRefs = JSON.parse(JSON.stringify(order.issues.map((i) => ({
    id: i.id, fieldPath: i.fieldPath, title: i.title, status: i.status,
  }))));

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <Link href="/orders" className="text-sm text-indigo-600 hover:underline">&larr; Back to Orders</Link>
          <h1 className="text-2xl font-semibold mt-2">Order Detail</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-sm text-gray-400 font-mono">{order.id.slice(0, 12)}</span>
            {order.brand && <span className="text-sm text-gray-500">{order.brand.name}</span>}
            <span className="text-xs text-gray-400">{timeAgo(order.createdAt)}</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_COLORS[order.status as OrderStatus]}`}>
              {STATUS_LABELS[order.status as OrderStatus]}
            </span>
            {isSendReadinessRelevant(order.status) && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${SEND_READINESS_COLORS[order.sendReadiness as SendReadiness]}`}>
                {SEND_READINESS_LABELS[order.sendReadiness as SendReadiness]}
              </span>
            )}
          </div>
        </div>
        <Link href={`/orders/${order.id}/export`} className="border border-gray-300 rounded-md px-4 py-2 text-sm hover:bg-gray-50">
          Export / Print
        </Link>
      </div>

      {/* Workflow Banner — the single source of "what to do next" */}
      <WorkflowBanner
        orderId={order.id}
        sendReadiness={order.sendReadiness as SendReadiness}
        orderStatus={order.status as OrderStatus}
        pharmacyName={order.pharmacy.name}
        openIssueCount={openIssues.length}
        alreadySent={order.transmissions.length > 0}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <OpenIssues
            issues={JSON.parse(JSON.stringify(order.issues))}
            sendReadiness={order.sendReadiness}
          />

          <EditablePatient
            orderId={order.id}
            data={{
              firstName: order.patient.firstName, lastName: order.patient.lastName,
              dob: order.patient.dob, phone: order.patient.phone,
              email: order.patient.email, address1: order.patient.address1,
              address2: order.patient.address2, city: order.patient.city,
              state: order.patient.state, zip: order.patient.zip,
            }}
            issues={issueRefs}
          />

          <EditablePrescriber
            orderId={order.id}
            data={{
              name: order.prescriber.name, npi: order.prescriber.npi,
              clinicName: order.prescriber.clinicName, phone: order.prescriber.phone,
              fax: order.prescriber.fax, email: order.prescriber.email,
              address: order.prescriber.address,
            }}
            issues={issueRefs}
          />

          <EditablePrescription
            orderId={order.id}
            data={{
              medicationName: order.medicationName, strength: order.strength,
              dosageForm: order.dosageForm, route: order.route,
              directions: order.directions, quantity: order.quantity,
              refills: order.refills, daysSupply: order.daysSupply,
              icd10: order.icd10, rxNotes: order.rxNotes,
            }}
            issues={issueRefs}
          />

          {/* TODO: Fulfillment Pharmacy editing — requires re-routing safeguards */}
          <div id="section-pharmacy" className="bg-white border border-gray-200 rounded-lg p-6 scroll-mt-20">
            <h2 className="text-lg font-medium mb-4">Fulfillment Pharmacy</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ViewRow label="Name" value={order.pharmacy.name} />
              <ViewRow label="Fax" value={order.pharmacy.fax} />
              <ViewRow label="Email" value={order.pharmacy.email} />
              <ViewRow label="Format" value={order.pharmacy.formatPreference} />
            </div>
          </div>

          <details className={`bg-white border border-gray-200 rounded-lg ${order.sendReadiness === "ready" ? "" : "open"}`}>
            <summary className="px-6 py-4 cursor-pointer text-lg font-medium hover:bg-gray-50 select-none">
              Compliance Check
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${SEND_READINESS_COLORS[normalized.sendReadiness]}`}>
                {SEND_READINESS_LABELS[normalized.sendReadiness]}
              </span>
            </summary>
            <div className="px-6 pb-5 pt-2">
              {packet.compliance.missingRequired.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-gray-500 mb-1">Missing Required</p>
                  <ul className="text-sm text-red-700 list-disc list-inside">{packet.compliance.missingRequired.map((f) => <li key={f}>{f}</li>)}</ul>
                </div>
              )}
              {packet.compliance.missingRecommended.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-gray-500 mb-1">Missing Recommended</p>
                  <ul className="text-sm text-yellow-700 list-disc list-inside">{packet.compliance.missingRecommended.map((f) => <li key={f}>{f}</li>)}</ul>
                </div>
              )}
              {packet.compliance.warnings.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-gray-500 mb-1">Data Quality Notes</p>
                  <ul className="text-sm text-yellow-700 list-disc list-inside">{packet.compliance.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
                </div>
              )}
              {normalized.sendReadiness === "ready" && packet.compliance.missingRecommended.length === 0 && (
                <p className="text-sm text-green-700">All required and recommended fields present.</p>
              )}
            </div>
          </details>
        </div>

        {/* Sidebar — reference info, no primary actions */}
        <div className="space-y-6">
          <StatusUpdater orderId={order.id} currentStatus={order.status as OrderStatus} />

          <EditableInternalNotes
            orderId={order.id}
            notes={order.internalNotes}
            brand={order.brand?.name || null}
            source={order.orderSource}
            priority={order.priority}
          />

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Audit</h3>
            <ViewRow label="Created" value={`${order.createdAt.toLocaleString()} (${timeAgo(order.createdAt)})`} />
            <ViewRow label="Updated" value={`${order.updatedAt.toLocaleString()} (${timeAgo(order.updatedAt)})`} />
            {order.rawPayload && <p className="text-xs text-gray-400 mt-2">Raw intake payload preserved</p>}
          </div>

          {order.transmissions.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-sm font-medium text-gray-900 mb-3">Transmissions</h3>
              <div className="space-y-3">
                {order.transmissions.map((t) => (
                  <div key={t.id} className="border-l-2 border-purple-200 pl-3">
                    <p className="text-sm font-medium">
                      Sent via {t.method}
                      {t.overrideUsed && <span className="text-red-600 text-xs ml-1">(override)</span>}
                    </p>
                    <p className="text-xs text-gray-400">{t.sentAt.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Status History</h3>
            <div className="space-y-3">
              {order.statusHistory.map((entry) => (
                <div key={entry.id} className="border-l-2 border-gray-200 pl-3">
                  <p className="text-sm font-medium">{STATUS_LABELS[entry.status as OrderStatus] || entry.status}</p>
                  {entry.note && <p className="text-xs text-gray-500">{entry.note}</p>}
                  <p className="text-xs text-gray-400">{timeAgo(entry.createdAt)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ViewRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm">{value || <span className="text-gray-300">—</span>}</p>
    </div>
  );
}

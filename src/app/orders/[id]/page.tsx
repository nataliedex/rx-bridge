import { notFound } from "next/navigation";
import Link from "next/link";
import { getOrder, getSellPriceForMedication, getCorrectionRequests } from "@/lib/actions";
import { prisma } from "@/lib/db";
import { transformOrder } from "@/lib/transformers/pipeline";
import { STATUS_LABELS, STATUS_COLORS, SEND_READINESS_LABELS, SEND_READINESS_COLORS, isSendReadinessRelevant, isInboundOrder, type OrderStatus, type SendReadiness } from "@/lib/types";
import { timeAgo, formatPhone } from "@/lib/format";
import { StatusUpdater } from "@/components/status-updater";
import { OpenIssues } from "@/components/open-issues";
import { WorkflowBanner } from "@/components/workflow-banner";
import { EditablePatient } from "@/components/editable-patient";
import { EditablePrescriber } from "@/components/editable-prescriber";
import { EditablePrescription } from "@/components/editable-prescription";
import { EditableInternalNotes } from "@/components/editable-internal-notes";
import { OrderCorrectionPanel } from "@/components/order-correction-panel";
import { RefillActions } from "@/components/refill-actions";
import { getRefillHistory } from "@/lib/refills/service";
import { formatCurrency, formatPercent, getPricingUnit } from "@/lib/pricing";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function OrderDetailPage({ params }: Props) {
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) notFound();

  const { normalized, packet } = transformOrder(order);
  const [sellPrice, correctionRequests, refillHistory] = await Promise.all([
    getSellPriceForMedication(order.medicationName),
    getCorrectionRequests(order.id),
    order.refills > 0 ? getRefillHistory(order.id) : null,
  ]);
  const openIssues = order.issues.filter((i) => i.status === "open");
  const inbound = isInboundOrder(order.orderSource);
  const openCorrectionRequests = correctionRequests.filter((r) => r.status === "open");

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
        openCorrectionCount={openCorrectionRequests.length}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <OrderCorrectionPanel
            orderId={order.id}
            isInbound={inbound}
            orderSource={order.orderSource}
            issues={JSON.parse(JSON.stringify(order.issues))}
            sendReadiness={order.sendReadiness}
            correctionRequests={JSON.parse(JSON.stringify(correctionRequests))}
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
            readOnly={inbound}
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
            readOnly={inbound}
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
            readOnly={inbound}
          />

          <div id="section-pharmacy" className="bg-white border border-gray-200 rounded-lg p-6 scroll-mt-20">
            <h2 className="text-lg font-medium mb-4">Fulfillment Pharmacy</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ViewRow label="Name" value={order.pharmacy.name} />
              <ViewRow label="Fax" value={formatPhone(order.pharmacy.fax)} />
              <ViewRow label="Email" value={order.pharmacy.email} />
              <ViewRow label="Format" value={order.pharmacy.formatPreference} />
            </div>
            {(() => {
              const method = (order as any).routingMethod as string | null;
              const routingRaw = (order as any).routingJson as string | null;
              if (!method && !routingRaw) return null;
              const routingData = routingRaw ? JSON.parse(routingRaw) : null;
              const isAuto = method === "auto";
              const isOverride = method === "manual" && routingData?.recommendedPharmacyId && routingData.recommendedPharmacyId !== order.pharmacyId;
              const alternatives = routingData?.alternatives || [];
              const ineligible = routingData?.ineligible || [];
              const totalConsidered = alternatives.length + ineligible.length + 1; // +1 for recommended

              return (
                <div className="mt-4 space-y-2">
                  {/* Routing method banner */}
                  <div className={`rounded-md px-3 py-2.5 border text-xs ${
                    isAuto ? "bg-green-50 border-green-200"
                      : isOverride ? "bg-amber-50 border-amber-200"
                      : "bg-gray-50 border-gray-200"
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`font-medium ${isAuto ? "text-green-700" : isOverride ? "text-amber-700" : "text-gray-600"}`}>
                        {isAuto ? "Auto-selected" : isOverride ? "Manually overridden" : "Manually selected"}
                      </span>
                      {routingData?.freshness && (
                        <span className={`text-[10px] ${
                          routingData.freshness === "fresh" ? "text-green-600"
                            : routingData.freshness === "aging" ? "text-amber-600"
                            : "text-red-500"
                        }`}>
                          {routingData.freshness === "fresh" ? "Verified recently"
                            : routingData.freshness === "aging" ? "Price aging"
                            : routingData.freshness === "unverified" ? "Never verified"
                            : "Price stale"}
                        </span>
                      )}
                    </div>
                    {routingData?.reason && (
                      <p className="text-gray-500">{routingData.reason}</p>
                    )}
                    {isOverride && routingData?.recommendedPharmacyName && routingData?.price != null && (
                      <p className="text-amber-600 mt-0.5">
                        Routing recommended {routingData.recommendedPharmacyName} at {formatCurrency(routingData.price)}
                      </p>
                    )}
                  </div>

                  {/* Alternatives considered — collapsible */}
                  {(alternatives.length > 0 || ineligible.length > 0) && (
                    <details className="text-xs">
                      <summary className="text-gray-400 cursor-pointer hover:text-gray-600">
                        {totalConsidered} pharmac{totalConsidered !== 1 ? "ies" : "y"} evaluated
                      </summary>
                      <div className="mt-2 border border-gray-200 rounded-md overflow-hidden">
                        {/* Eligible alternatives */}
                        {alternatives.length > 0 && (
                          <div className="divide-y divide-gray-100">
                            {alternatives.map((alt: { pharmacyId: string; pharmacyName: string; price: number; freshness?: string; flags?: string[] }) => (
                              <div key={alt.pharmacyId} className="px-3 py-2 flex items-center justify-between">
                                <div>
                                  <span className="text-gray-700">{alt.pharmacyName}</span>
                                  {alt.freshness && alt.freshness !== "fresh" && (
                                    <span className={`ml-2 text-[10px] ${
                                      alt.freshness === "aging" ? "text-amber-500" : "text-red-400"
                                    }`}>
                                      {alt.freshness === "aging" ? "aging" : alt.freshness === "unverified" ? "unverified" : "stale"}
                                    </span>
                                  )}
                                </div>
                                <span className="text-gray-500 font-medium">{formatCurrency(alt.price)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Ineligible pharmacies */}
                        {ineligible.length > 0 && (
                          <div className={`divide-y divide-gray-100 ${alternatives.length > 0 ? "border-t border-gray-200" : ""}`}>
                            <div className="px-3 py-1.5 bg-gray-50 text-[10px] text-gray-400 uppercase tracking-wider">Ineligible</div>
                            {ineligible.map((ine: { pharmacyId: string; pharmacyName: string; price: number; reason: string }) => (
                              <div key={ine.pharmacyId} className="px-3 py-2 flex items-center justify-between opacity-60">
                                <div>
                                  <span className="text-gray-500">{ine.pharmacyName}</span>
                                  <span className="ml-2 text-[10px] text-gray-400">{ine.reason}</span>
                                </div>
                                <span className="text-gray-400">{formatCurrency(ine.price)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </details>
                  )}
                </div>
              );
            })()}
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
          <StatusUpdater orderId={order.id} currentStatus={order.status as OrderStatus} hasBlockingIssues={order.sendReadiness !== "ready"} orderSource={order.orderSource} />

          <EditableInternalNotes
            orderId={order.id}
            notes={order.internalNotes}
            brand={order.brand?.name || null}
            source={order.orderSource}
            priority={order.priority}
          />

          {await (async () => {
            // Try routing JSON first, fall back to catalog lookup
            const routingRaw = (order as any).routingJson as string | null;
            let pharmacyCost = routingRaw ? JSON.parse(routingRaw)?.price as number | null : null;

            // Fallback: look up active pharmacy cost for this medication + pharmacy from catalog
            if (pharmacyCost == null) {
              const catalogPrice = await prisma.medicationPriceEntry.findFirst({
                where: {
                  medication: { name: order.medicationName },
                  pharmacyId: order.pharmacyId,
                  endDate: null,
                },
                select: { price: true },
                orderBy: { price: "asc" },
              });
              pharmacyCost = catalogPrice?.price ?? null;
            }

            const hasMargin = pharmacyCost != null && sellPrice != null;
            const margin = hasMargin ? sellPrice! - pharmacyCost! : null;
            const marginPct = hasMargin && sellPrice! > 0 ? margin! / sellPrice! : null;

            if (!hasMargin && sellPrice == null && pharmacyCost == null) return null;

            const unit = order.dosageForm ? getPricingUnit(order.dosageForm) : "unit";
            const qty = order.quantity ?? 1;
            const totalSell = sellPrice != null ? sellPrice * qty : null;
            const totalCost = pharmacyCost != null ? pharmacyCost * qty : null;
            const totalMargin = totalSell != null && totalCost != null ? totalSell - totalCost : null;

            return (
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Economics</h3>
                {/* Per-unit */}
                <div className="space-y-2">
                  {sellPrice != null && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Brand Pays <span className="text-gray-400">/ {unit}</span></span>
                      <span className="font-semibold text-gray-900">{formatCurrency(sellPrice)}</span>
                    </div>
                  )}
                  {pharmacyCost != null && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Pharmacy Cost <span className="text-gray-400">/ {unit}</span></span>
                      <span className="text-gray-700">{formatCurrency(pharmacyCost)}</span>
                    </div>
                  )}
                  {hasMargin && margin != null && marginPct != null && (
                    <div className={`border-t border-gray-100 pt-2 flex justify-between text-sm font-medium ${margin >= 0 ? "text-green-700" : "text-red-600"}`}>
                      <span>Margin <span className="font-normal text-gray-400">/ {unit}</span></span>
                      <span>{formatCurrency(margin)} ({formatPercent(marginPct)})</span>
                    </div>
                  )}
                  {sellPrice != null && pharmacyCost == null && (
                    <p className="text-[10px] text-amber-600 mt-1">Pharmacy cost not available — margin cannot be calculated</p>
                  )}
                </div>
                {/* Order total */}
                {qty > 1 && (totalSell != null || totalCost != null) && (
                  <div className="mt-3 pt-3 border-t border-gray-200 space-y-1.5">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Order Total ({qty} {unit}{qty !== 1 ? "s" : ""})</p>
                    {totalSell != null && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Brand Pays</span>
                        <span className="font-semibold text-gray-900">{formatCurrency(totalSell)}</span>
                      </div>
                    )}
                    {totalCost != null && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Pharmacy Cost</span>
                        <span className="text-gray-700">{formatCurrency(totalCost)}</span>
                      </div>
                    )}
                    {totalMargin != null && (
                      <div className={`flex justify-between text-sm font-medium ${totalMargin >= 0 ? "text-green-700" : "text-red-600"}`}>
                        <span>Margin</span>
                        <span>{formatCurrency(totalMargin)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Audit</h3>
            <ViewRow label="Created" value={`${order.createdAt.toLocaleString()} (${timeAgo(order.createdAt)})`} />
            <ViewRow label="Updated" value={`${order.updatedAt.toLocaleString()} (${timeAgo(order.updatedAt)})`} />
            {order.rawPayload && <p className="text-xs text-gray-400 mt-2">Raw intake payload preserved</p>}
          </div>

          {order.refills > 0 && refillHistory && (
            <RefillActions
              orderId={order.id}
              orderStatus={order.status}
              refillsAuthorized={refillHistory.refillsAuthorized}
              refillsFilled={refillHistory.refillsFilled}
              refillsInFlight={refillHistory.refillsInFlight}
              refillsRemaining={refillHistory.refillsRemaining}
              latestRefill={refillHistory.history.length > 0 ? {
                id: refillHistory.history[0].id,
                status: refillHistory.history[0].status,
                createdAt: refillHistory.history[0].createdAt.toISOString(),
                validatedAt: refillHistory.history[0].validatedAt?.toISOString() ?? null,
                sentToPharmacyAt: refillHistory.history[0].sentToPharmacyAt?.toISOString() ?? null,
                filledAt: refillHistory.history[0].filledAt?.toISOString() ?? null,
                cancelledAt: refillHistory.history[0].cancelledAt?.toISOString() ?? null,
              } : null}
            />
          )}

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

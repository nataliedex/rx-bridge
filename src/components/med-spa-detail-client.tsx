"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createMedSpaPricingLine, updateMedSpaPricingLine, deleteMedSpaPricingLine, createMedSpaNote, createFulfilledOrder } from "@/lib/actions";
import { formatCurrency, calcSellPriceFromMarkup, calcMarkupFromSellPrice, calcMarginPct } from "@/lib/pricing";
import { PIPELINE_LABELS, PIPELINE_COLORS, type PipelineStage } from "@/lib/types";
import { formatPhone } from "@/lib/format";
import { MedSpaDealDrawer } from "./med-spa-deal-drawer";
import { LedgerAddOrder } from "./ledger-add-order";
import { PricingAgreementSection } from "./pricing-agreement-section";
import { ActivateAgreementDrawer } from "./activate-agreement-drawer";
import { SendProposalModal } from "./send-proposal-modal";

function PharmacyPicker({ options, selectedId, onSelect }: {
  options: { pharmacyId: string; pharmacyName: string; price: number }[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function handleToggle() {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      // Dropdown is roughly 40px per option + 8px padding
      const dropdownHeight = options.length * 40 + 8;
      setDropUp(spaceBelow < dropdownHeight);
    }
    setOpen(!open);
  }

  const selected = options.find((o) => o.pharmacyId === selectedId);

  return (
    <div ref={ref} className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={handleToggle}
        className="flex items-center justify-between w-full max-w-[200px] border border-gray-300 rounded px-2 py-1 text-[12px] text-left hover:border-gray-400 transition-colors bg-white"
      >
        <span className="truncate text-gray-900">{selected?.pharmacyName ?? "Select..."}</span>
        <svg className={`w-3.5 h-3.5 ml-1 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>
      {open && (
        <div className={`absolute left-0 bg-white border border-gray-200 rounded-md shadow-lg z-20 w-64 py-1 ${
          dropUp ? "bottom-full mb-1" : "top-full mt-1"
        }`}>
          {options.map((opt) => {
            const isSelected = opt.pharmacyId === selectedId;
            const isLowest = opt.pharmacyId === options[0].pharmacyId;
            return (
              <button
                key={opt.pharmacyId}
                type="button"
                onClick={() => { onSelect(opt.pharmacyId); setOpen(false); }}
                className={`flex items-center justify-between w-full px-3 py-1.5 text-[12px] text-left transition-colors ${
                  isSelected ? "bg-indigo-50 text-indigo-700" : "hover:bg-gray-50 text-gray-700"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  {isSelected && <span className="text-indigo-600">&#10003;</span>}
                  <span className={isSelected ? "font-medium" : ""}>{opt.pharmacyName}</span>
                  {isLowest && <span className="text-[9px] text-green-600 bg-green-50 px-1 py-0.5 rounded">Lowest</span>}
                </span>
                <span className="text-gray-400 tabular-nums">{formatCurrency(opt.price)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface PricingLine {
  id: string; medicationName: string; currentCost: number; unit: string;
  monthlyQty: number; currentVendor: string | null; pricingSource: string | null;
  confirmedAt: string | null; notes: string | null; createdAt: string;
}

interface PharmacyOption {
  pharmacyId: string; pharmacyName: string; price: number;
}

interface ComparisonRow {
  lineId: string; medicationName: string; unit: string;
  medicationId: string | null;
  currentCost: number; monthlyQty: number;
  programPrice: number | null;
  pharmacyOptions: PharmacyOption[];
  lowestPharmacy: { name: string; price: number } | null;
}

interface NoteRow {
  id: string; note: string; type: string; createdAt: string;
}

interface FulfilledOrderRow {
  id: string; orderDate: string; medicationName: string; quantity: number;
  pharmacyName: string; medSpaPaid: number; pharmacyCost: number;
  grossProfit: number; notes: string | null;
}

interface SpaData {
  id: string; name: string; pipelineStage: string; currentVendor: string | null;
  contactName: string | null; email: string | null; phone: string | null;
  lastContactedAt: Date | null; estMonthlyVolume: string | null; nextStep: string | null;
  pricingLines: PricingLine[];
  pricingComparison: ComparisonRow[];
  notes: NoteRow[];
  fulfilledOrders: FulfilledOrderRow[];
  catalogMedications: string[];
  catalogPharmacies: string[];
  monthlySpend: number;
  pricingStrategy: { mode: string; defaultMarkupPct: number; allowMedicationOverrides: boolean; allowMedSpaOverrides: boolean; defaultContractTermMonths: number };
  activeAgreement: {
    id: string; status: string; effectiveFrom: string; effectiveThrough: string;
    notes: string | null; createdAt: string;
    lines: { id: string; medicationId: string; medicationName: string; agreedPrice: number; pharmacyId: string | null; pharmacyName: string | null; estimatedMonthlyQty: number | null }[];
  } | null;
  agreementHistory: {
    id: string; status: string; effectiveFrom: string; effectiveThrough: string;
    notes: string | null; createdAt: string; lineCount: number;
  }[];
  latestProposal: {
    id: string; status: string; recipientEmail: string | null;
    sentAt: string | null; viewedAt: string | null; acceptedAt: string | null;
    monthlySavings: number; monthlyProfit: number;
  } | null;
}

const NOTE_TYPES = [
  { value: "note", label: "Note" },
  { value: "call", label: "Call" },
  { value: "email", label: "Email" },
  { value: "meeting", label: "Meeting" },
  { value: "pricing", label: "Pricing" },
  { value: "follow_up", label: "Follow-up" },
];

const NOTE_TYPE_COLORS: Record<string, string> = {
  note: "bg-gray-100 text-gray-600",
  call: "bg-blue-100 text-blue-700",
  email: "bg-indigo-100 text-indigo-700",
  meeting: "bg-purple-100 text-purple-700",
  pricing: "bg-green-100 text-green-700",
  follow_up: "bg-amber-100 text-amber-700",
};

export function MedSpaDetailClient({ spa }: { spa: SpaData }) {
  const router = useRouter();
  const stage = spa.pipelineStage as PipelineStage;

  // Pharmacy selections — keyed by lineId, value is pharmacyId (or "" for none)
  // Default each to the lowest-cost pharmacy
  const [pharmSelections, setPharmSelections] = useState<Record<string, string>>(() => {
    const defaults: Record<string, string> = {};
    for (const row of spa.pricingComparison) {
      if (row.pharmacyOptions.length > 0) {
        defaults[row.lineId] = row.pharmacyOptions[0].pharmacyId; // lowest cost is first
      }
    }
    return defaults;
  });

  // Compute derived comparison values from selections
  const computedComparison = spa.pricingComparison.map((row) => {
    const selectedId = pharmSelections[row.lineId];
    const selected = row.pharmacyOptions.find((p) => p.pharmacyId === selectedId) ?? null;
    const pharmacyCost = selected?.price ?? null;
    // Proposed price = program price (what we charge the med spa)
    const proposedPrice = row.programPrice;
    // Med spa savings = current price - proposed price (can be negative)
    const unitSavings = proposedPrice != null ? Math.round((row.currentCost - proposedPrice) * 100) / 100 : null;
    const monthlySavings = unitSavings != null ? Math.round(unitSavings * row.monthlyQty * 100) / 100 : 0;
    // Bisk profit = proposed price - pharmacy cost
    const unitProfit = (proposedPrice != null && pharmacyCost != null) ? Math.round((proposedPrice - pharmacyCost) * 100) / 100 : null;
    const monthlyProfit = unitProfit != null ? Math.round(unitProfit * row.monthlyQty * 100) / 100 : 0;
    return {
      ...row, pharmacyCost, proposedPrice, unitSavings, monthlySavings,
      selectedPharmacy: selected?.pharmacyName ?? null,
      unitProfit, monthlyProfit,
      // Legacy compat for other parts of the page that reference these
      medSpaPrice: proposedPrice ?? row.currentCost,
      grossProfitPerUnit: unitProfit,
      monthlyGrossProfit: monthlyProfit,
    };
  });

  const totalMonthlySavings = computedComparison.reduce((sum, p) => sum + p.monthlySavings, 0);
  const proposalItems = computedComparison.filter((p) => p.pharmacyCost != null && p.proposedPrice != null);

  // Deal economics totals
  const totalMonthlyRevenue = proposalItems.reduce((sum, p) => sum + (p.proposedPrice ?? 0) * p.monthlyQty, 0);
  const totalMonthlyCost = proposalItems.reduce((sum, p) => sum + (p.pharmacyCost ?? 0) * p.monthlyQty, 0);
  const totalMonthlyGrossProfit = proposalItems.reduce((sum, p) => sum + p.monthlyProfit, 0);

  // Tabs
  const [activeTab, setActiveTab] = useState<"overview" | "pricing" | "ledger" | "activity">("overview");

  // Deal drawer
  const [dealOpen, setDealOpen] = useState(false);
  // Agreement drawer
  const [agreementDrawerOpen, setAgreementDrawerOpen] = useState(false);
  const [isRenewal, setIsRenewal] = useState(false);
  // Send proposal
  const [sendProposalOpen, setSendProposalOpen] = useState(false);
  // Ledger filters
  const [ledgerPeriod, setLedgerPeriod] = useState<"month" | "all">("month");
  const [ledgerPharmacy, setLedgerPharmacy] = useState("");

  // Add pricing line state
  const [addingLine, setAddingLine] = useState(false);
  const [lineName, setLineName] = useState("");
  const [lineCost, setLineCost] = useState("");
  const [lineUnit, setLineUnit] = useState("vial");
  const [lineQty, setLineQty] = useState("");
  const [lineVendor, setLineVendor] = useState("");
  const [lineSource, setLineSource] = useState("");
  const [lineSaving, setLineSaving] = useState(false);

  // Add note state
  const [noteText, setNoteText] = useState("");
  const [noteType, setNoteType] = useState("note");
  const [noteSaving, setNoteSaving] = useState(false);

  // Edit line
  const [editingLine, setEditingLine] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCost, setEditCost] = useState("");
  const [editUnit, setEditUnit] = useState("vial");
  const [editQty, setEditQty] = useState("");
  const [editVendor, setEditVendor] = useState("");
  const [editSource, setEditSource] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // Delete line with confirmation
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function handleAddLine() {
    if (!lineName.trim() || !lineCost || !lineQty) return;
    setLineSaving(true);
    try {
      await createMedSpaPricingLine({
        medSpaId: spa.id, medicationName: lineName.trim(),
        currentCost: parseFloat(lineCost), unit: lineUnit,
        monthlyQty: parseInt(lineQty), currentVendor: lineVendor.trim() || undefined,
        pricingSource: lineSource.trim() || undefined,
      });
      setAddingLine(false); setLineName(""); setLineCost(""); setLineQty(""); setLineVendor(""); setLineSource("");
      router.refresh();
    } catch { /* stay */ }
    finally { setLineSaving(false); }
  }

  function startEditLine(line: PricingLine) {
    setEditingLine(line.id);
    setEditName(line.medicationName);
    setEditCost(String(line.currentCost));
    setEditUnit(line.unit);
    setEditQty(String(line.monthlyQty));
    setEditVendor(line.currentVendor ?? "");
    setEditSource(line.pricingSource ?? "");
  }

  async function handleSaveEdit() {
    if (!editingLine || !editName.trim() || !editCost || !editQty) return;
    setEditSaving(true);
    try {
      await updateMedSpaPricingLine(editingLine, {
        medicationName: editName.trim(), currentCost: parseFloat(editCost),
        unit: editUnit, monthlyQty: parseInt(editQty),
        currentVendor: editVendor.trim(), pricingSource: editSource.trim(),
      });
      setEditingLine(null);
      router.refresh();
    } catch { /* stay */ }
    finally { setEditSaving(false); }
  }

  async function handleDeleteLine(lineId: string) {
    setDeleting(lineId);
    try {
      await deleteMedSpaPricingLine(lineId);
      setConfirmDeleteId(null);
      router.refresh();
    } catch { /* stay */ }
    finally { setDeleting(null); }
  }

  async function handleAddNote() {
    if (!noteText.trim()) return;
    setNoteSaving(true);
    try {
      await createMedSpaNote({ medSpaId: spa.id, note: noteText.trim(), type: noteType });
      setNoteText(""); setNoteType("note");
      router.refresh();
    } catch { /* stay */ }
    finally { setNoteSaving(false); }
  }

  // Format number as x,xxx.xx for display in inputs
  function fmtNum(n: number): string {
    return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function parseNum(s: string): number {
    return parseFloat(s.replace(/,/g, "")) || 0;
  }

  // Fulfilled order entry — guided by proposal
  const [addingOrder, setAddingOrder] = useState(false);
  const [foDate, setFoDate] = useState(new Date().toISOString().slice(0, 10));
  const [foMed, setFoMed] = useState("");
  const [foQty, setFoQty] = useState("");
  const [foPharmacy, setFoPharmacy] = useState("");
  const [foPaid, setFoPaid] = useState("");
  const [foCost, setFoCost] = useState("");
  const [foNotes, setFoNotes] = useState("");
  const [foSaving, setFoSaving] = useState(false);
  const [foPaidOverride, setFoPaidOverride] = useState(false);
  const [foCostOverride, setFoCostOverride] = useState(false);

  // Build guided lookup from proposal data
  // Maps medication name → { medSpaUnitPrice, pharmacyOptions with prices, defaultPharmacy }
  const proposalMedMap = new Map<string, {
    medSpaUnitPrice: number;
    unit: string;
    defaultPharmacyName: string;
    pharmacyPrices: { name: string; unitCost: number }[];
  }>();
  for (const row of computedComparison) {
    if (row.pharmacyCost == null) continue;
    const srcRow = spa.pricingComparison.find((r) => r.lineId === row.lineId);
    if (!srcRow) continue;
    proposalMedMap.set(row.medicationName, {
      medSpaUnitPrice: row.currentCost, // what we charge the med spa
      unit: row.unit,
      defaultPharmacyName: row.selectedPharmacy ?? srcRow.pharmacyOptions[0]?.pharmacyName ?? "",
      pharmacyPrices: srcRow.pharmacyOptions.map((o) => ({ name: o.pharmacyName, unitCost: o.price })),
    });
  }

  const proposalMedNames = [...proposalMedMap.keys()];

  // When medication changes, auto-set pharmacy and reset pricing
  function handleFoMedChange(medName: string) {
    setFoMed(medName);
    setFoPaidOverride(false);
    setFoCostOverride(false);
    const info = proposalMedMap.get(medName);
    if (info) {
      setFoPharmacy(info.defaultPharmacyName);
      // Autofill pricing if qty is present
      if (foQty) {
        const qty = parseInt(foQty);
        if (!isNaN(qty) && qty > 0) {
          setFoPaid(fmtNum(Math.round(info.medSpaUnitPrice * qty * 100) / 100));
          const pharmPrice = info.pharmacyPrices.find((p) => p.name === info.defaultPharmacyName);
          if (pharmPrice) setFoCost(fmtNum(Math.round(pharmPrice.unitCost * qty * 100) / 100));
        }
      } else {
        setFoPaid(""); setFoCost("");
      }
    } else {
      setFoPharmacy(""); setFoPaid(""); setFoCost("");
    }
  }

  // When pharmacy changes, update cost
  function handleFoPharmacyChange(pharmName: string) {
    setFoPharmacy(pharmName);
    setFoCostOverride(false);
    const info = proposalMedMap.get(foMed);
    if (info && foQty) {
      const qty = parseInt(foQty);
      const pharmPrice = info.pharmacyPrices.find((p) => p.name === pharmName);
      if (pharmPrice && !isNaN(qty) && qty > 0) {
        setFoCost(fmtNum(Math.round(pharmPrice.unitCost * qty * 100) / 100));
      }
    }
  }

  // When quantity changes, recalculate both totals
  function handleFoQtyChange(val: string) {
    setFoQty(val);
    const qty = parseInt(val);
    if (isNaN(qty) || qty <= 0) { if (!foPaidOverride) setFoPaid(""); if (!foCostOverride) setFoCost(""); return; }
    const info = proposalMedMap.get(foMed);
    if (!info) return;
    if (!foPaidOverride) setFoPaid(fmtNum(Math.round(info.medSpaUnitPrice * qty * 100) / 100));
    if (!foCostOverride) {
      const pharmPrice = info.pharmacyPrices.find((p) => p.name === foPharmacy);
      if (pharmPrice) setFoCost(fmtNum(Math.round(pharmPrice.unitCost * qty * 100) / 100));
    }
  }

  // Get pharmacy options for the selected medication
  const foPharmacyOptions = proposalMedMap.get(foMed)?.pharmacyPrices ?? [];

  async function handleAddFulfilledOrder() {
    if (!foMed || !foQty || !foPharmacy || !foPaid || !foCost) return;
    setFoSaving(true);
    try {
      await createFulfilledOrder({
        medSpaId: spa.id, orderDate: foDate, medicationName: foMed,
        quantity: parseInt(foQty), pharmacyName: foPharmacy,
        medSpaPaid: parseNum(foPaid), pharmacyCost: parseNum(foCost),
        notes: foNotes.trim() || undefined,
      });
      setAddingOrder(false);
      setFoDate(new Date().toISOString().slice(0, 10));
      setFoMed(""); setFoQty(""); setFoPharmacy(""); setFoPaid(""); setFoCost(""); setFoNotes("");
      setFoPaidOverride(false); setFoCostOverride(false);
      router.refresh();
    } catch { /* stay */ }
    finally { setFoSaving(false); }
  }

  // Performance metrics — current month
  const now = new Date();
  const currentMonthOrders = spa.fulfilledOrders.filter((o) => {
    const d = new Date(o.orderDate);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const perfOrderCount = currentMonthOrders.length;
  const perfRevenue = currentMonthOrders.reduce((s, o) => s + o.medSpaPaid, 0);
  const perfCost = currentMonthOrders.reduce((s, o) => s + o.pharmacyCost, 0);
  const perfProfit = perfRevenue - perfCost;
  const perfAvgProfit = perfOrderCount > 0 ? perfProfit / perfOrderCount : 0;

  // Monthly trend — last 6 months
  const monthlyTrend: { label: string; orders: number; revenue: number; grossProfit: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthLabel = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    const monthOrders = spa.fulfilledOrders.filter((o) => {
      const od = new Date(o.orderDate);
      return od.getMonth() === d.getMonth() && od.getFullYear() === d.getFullYear();
    });
    const revenue = monthOrders.reduce((s, o) => s + o.medSpaPaid, 0);
    const cost = monthOrders.reduce((s, o) => s + o.pharmacyCost, 0);
    monthlyTrend.push({ label: monthLabel, orders: monthOrders.length, revenue, grossProfit: revenue - cost });
  }
  const maxRevenue = Math.max(...monthlyTrend.map((m) => m.revenue), 1);

  // Top medications by gross profit
  const medProfitMap = new Map<string, { orders: number; revenue: number; grossProfit: number }>();
  for (const o of spa.fulfilledOrders) {
    const existing = medProfitMap.get(o.medicationName);
    const profit = o.medSpaPaid - o.pharmacyCost;
    if (existing) {
      existing.orders++;
      existing.revenue += o.medSpaPaid;
      existing.grossProfit += profit;
    } else {
      medProfitMap.set(o.medicationName, { orders: 1, revenue: o.medSpaPaid, grossProfit: profit });
    }
  }
  const topMedications = Array.from(medProfitMap.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.grossProfit - a.grossProfit)
    .slice(0, 5);

  // Generated summary sentence
  const topMedNames = topMedications.slice(0, 2).map((m) => m.name);
  const summaryText = perfOrderCount > 0
    ? `${spa.name} generated ${formatCurrency(perfRevenue)} in client revenue and ${formatCurrency(perfProfit)} profit across ${perfOrderCount} treatment${perfOrderCount !== 1 ? "s" : ""} this month.${topMedNames.length > 0 ? ` ${topMedNames.join(" and ")} ${topMedNames.length === 1 ? "is" : "are"} the highest-profit medication${topMedNames.length === 1 ? "" : "s"}.` : ""}`
    : `${spa.name} has no orders logged this month.`;

  // proposalItems computed above with pharmacy selections

  // Action Needed — account-specific issues (text only, no CTAs)
  const actionItems: string[] = [];

  const dealReadyStages = new Set(["pricing_sent", "negotiating", "won"]);
  if (spa.pricingLines.length > 0 && spa.fulfilledOrders.length === 0 && dealReadyStages.has(spa.pipelineStage)) {
    actionItems.push("No orders logged yet — start tracking to see profit");
  }

  if (spa.pipelineStage === "negotiating") actionItems.push("Deal is in Negotiating stage — follow up on decision");
  else if (spa.pipelineStage === "pricing_sent") actionItems.push("Proposal sent — follow up this week");
  else if (spa.pipelineStage === "contacted") actionItems.push("Initial contact made — schedule pricing discovery call");
  else if (spa.pipelineStage === "lead") actionItems.push("New lead — make first contact");

  if (spa.pricingLines.length === 0 && spa.pipelineStage !== "lead" && spa.pipelineStage !== "lost") {
    actionItems.push("No pricing worksheet — add current pricing to build a proposal");
  }

  const zeroCostOrders = spa.fulfilledOrders.filter((o) => o.pharmacyCost === 0);
  if (zeroCostOrders.length > 0) {
    actionItems.push(`${zeroCostOrders.length} order${zeroCostOrders.length !== 1 ? "s" : ""} missing pharmacy cost`);
  }

  // Build pricing lookup for the contextual Add Order drawer
  // Compute per-unit previous client price from most recent fulfilled order as fallback
  const lastOrderPriceMap = new Map<string, number>();
  for (const o of spa.fulfilledOrders) {
    const key = o.medicationName.toLowerCase();
    if (!lastOrderPriceMap.has(key) && o.quantity > 0) {
      lastOrderPriceMap.set(key, Math.round((o.medSpaPaid / o.quantity) * 100) / 100);
    }
  }
  const spaOrderLookup: Record<string, { medications: { name: string; unit: string; medSpaPrice: number; previousClientUnitPrice: number | null; pharmacies: { name: string; cost: number }[] }[] }> = {};
  spaOrderLookup[spa.id] = {
    medications: spa.pricingComparison
      .filter((r) => r.pharmacyOptions.length > 0)
      .map((r) => {
        const worksheetPrice = r.currentCost > 0 ? r.currentCost : null;
        const orderPrice = lastOrderPriceMap.get(r.medicationName.toLowerCase()) ?? null;
        return {
          name: r.medicationName, unit: r.unit, medSpaPrice: r.currentCost,
          previousClientUnitPrice: worksheetPrice ?? orderPrice,
          pharmacies: r.pharmacyOptions.map((o) => ({ name: o.pharmacyName, cost: o.price })),
        };
      }),
  };

  return (
    <>
      {/* Action Needed banner */}
      {actionItems.length > 0 && (
        <div className="border border-amber-200 rounded-lg overflow-hidden mb-6 bg-amber-50/50">
          <div className="px-5 py-3">
            <h2 className="text-sm font-semibold text-amber-900 mb-2">Action Needed</h2>
            <ul className="space-y-1">
              {actionItems.map((text, i) => (
                <li key={i} className="flex items-start gap-2 text-[13px]">
                  <span className="text-amber-400 mt-0.5 shrink-0">&#8226;</span>
                  <span className="text-gray-700">{text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Page-level actions */}
      {spaOrderLookup[spa.id]?.medications.length > 0 && (
        <div className="flex justify-end mb-4">
          <LedgerAddOrder
            medSpas={[{ id: spa.id, name: spa.name }]}
            lookup={spaOrderLookup}
            prefillMedSpaId={spa.id}
            prefillMedSpaName={spa.name}
            buttonLabel="+ Record Transaction"
            buttonStyle="bg-indigo-600 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-indigo-700 transition-colors"
            pricingStrategy={spa.pricingStrategy}
          />
        </div>
      )}

      {/* Deal + Contact — two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Left: Deal Details */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">Deal Details</h2>
            <button onClick={() => setDealOpen(true)} className="text-[11px] text-indigo-600 hover:text-indigo-800">Edit</button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">Stage</p>
              <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded mt-1 ${PIPELINE_COLORS[stage]}`}>{PIPELINE_LABELS[stage]}</span>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">Current Vendor</p>
              <p className="text-gray-700 mt-1">{spa.currentVendor || <span className="text-gray-300">{"\u2014"}</span>}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">Est. Monthly</p>
              <p className="text-gray-700 mt-1">{spa.estMonthlyVolume || <span className="text-gray-300">{"\u2014"}</span>}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">Last Contact</p>
              <p className="text-gray-700 mt-1">{spa.lastContactedAt ? new Date(spa.lastContactedAt).toLocaleDateString() : <span className="text-gray-300">{"\u2014"}</span>}</p>
            </div>
            <div className="col-span-2">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">Next Step</p>
              <p className="text-gray-900 mt-1">{spa.nextStep || <span className="text-gray-300">{"\u2014"}</span>}</p>
            </div>
          </div>
        </div>

        {/* Right: Contact */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-medium text-gray-900">Contact</h3>
            <button onClick={() => setDealOpen(true)} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Edit</button>
          </div>
          <div className="space-y-2">
            <div>
              <p className="text-xs text-gray-500">Name</p>
              <p className="text-sm">{spa.contactName || <span className="text-gray-300">{"\u2014"}</span>}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Email</p>
              {spa.email ? (
                <a href={`mailto:${spa.email}`} className="text-sm text-indigo-600 hover:text-indigo-800">{spa.email}</a>
              ) : (
                <p className="text-sm text-gray-300">{"\u2014"}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-gray-500">Phone</p>
              <p className="text-sm">{spa.phone ? formatPhone(spa.phone) : <span className="text-gray-300">{"\u2014"}</span>}</p>
            </div>
            {!spa.contactName && !spa.email && !spa.phone && (
              <p className="text-xs text-gray-400">No contact information</p>
            )}
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {([
          { key: "overview" as const, label: "Overview" },
          { key: "pricing" as const, label: "Pricing" },
          { key: "ledger" as const, label: "Ledger" },
          { key: "activity" as const, label: "Activity" },
        ]).map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.key
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ===== OVERVIEW TAB ===== */}
      {activeTab === "overview" && (
      <>
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Monthly Spend</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(spa.monthlySpend)}</p>
          <p className="text-xs text-gray-400 mt-0.5">from pricing worksheet</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Monthly Savings</p>
          <p className={`text-2xl font-bold mt-1 ${totalMonthlySavings > 0 ? "text-green-700" : "text-gray-900"}`}>
            {formatCurrency(totalMonthlySavings)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">with Bisk pricing</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Annual Opportunity</p>
          <p className={`text-2xl font-bold mt-1 ${totalMonthlySavings > 0 ? "text-green-700" : "text-gray-900"}`}>
            {formatCurrency(totalMonthlySavings * 12)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">projected yearly savings</p>
        </div>
      </div>

      </>
      )}

      {/* ===== PRICING TAB ===== */}
      {activeTab === "pricing" && (
      <>
      {/* Current Pricing Input — editable worksheet */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-8">
        <div className="px-5 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-gray-900">What They Pay Today</h2>
            <p className="text-xs text-gray-500 mt-0.5">What {spa.name} is currently paying — enter from invoices or conversations</p>
          </div>
          <button onClick={() => setAddingLine(true)} className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium">+ Add Line Item</button>
        </div>

        {addingLine && (
          <div className="px-5 py-3 border-b border-indigo-100 bg-indigo-50/30 space-y-3">
            <div className="grid grid-cols-6 gap-2">
              <div className="col-span-2">
                <input value={lineName} onChange={(e) => setLineName(e.target.value)} placeholder="Medication name"
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" autoFocus />
              </div>
              <div>
                <div className="flex">
                  <span className="inline-flex items-center px-2 border border-r-0 border-gray-300 rounded-l bg-gray-50 text-gray-400 text-sm">$</span>
                  <input value={lineCost} onChange={(e) => setLineCost(e.target.value)} placeholder="0.00" type="number" step="0.01"
                    className="w-full border border-gray-300 rounded-r px-2 py-1.5 text-sm" />
                </div>
              </div>
              <div>
                <select value={lineUnit} onChange={(e) => setLineUnit(e.target.value)}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm">
                  <option value="vial">/ vial</option>
                  <option value="capsule">/ capsule</option>
                  <option value="tube">/ tube</option>
                  <option value="bottle">/ bottle</option>
                  <option value="tablet">/ tablet</option>
                  <option value="troche">/ troche</option>
                  <option value="unit">/ unit</option>
                </select>
              </div>
              <div>
                <input value={lineQty} onChange={(e) => setLineQty(e.target.value)} placeholder="Mo. qty" type="number"
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
              </div>
              <div>
                <input value={lineVendor} onChange={(e) => setLineVendor(e.target.value)} placeholder="Vendor (optional)"
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input value={lineSource} onChange={(e) => setLineSource(e.target.value)} placeholder="Source: Invoice, Website, Verbal quote..."
                className="border border-gray-300 rounded px-2 py-1.5 text-sm w-60" />
              <button onClick={handleAddLine} disabled={lineSaving || !lineName.trim() || !lineCost || !lineQty}
                className="bg-indigo-600 text-white rounded px-3 py-1.5 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                {lineSaving ? "..." : "Add"}
              </button>
              <button onClick={() => setAddingLine(false)} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
            </div>
          </div>
        )}

        {spa.pricingLines.length === 0 && !addingLine ? (
          <div className="p-6 text-center">
            <p className="text-gray-400 text-sm">No pricing data entered yet.</p>
            <button onClick={() => setAddingLine(true)} className="text-sm text-indigo-600 hover:underline mt-1">Add the first line item</button>
          </div>
        ) : spa.pricingLines.length > 0 && (
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-400 uppercase">Medication</th>
                <th className="px-4 py-2 text-right text-[11px] font-medium text-gray-400 uppercase">Cost</th>
                <th className="px-4 py-2 text-right text-[11px] font-medium text-gray-400 uppercase">Mo. Qty</th>
                <th className="px-4 py-2 text-right text-[11px] font-medium text-gray-400 uppercase">Mo. Spend</th>
                <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-400 uppercase">Vendor</th>
                <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-400 uppercase">Source</th>
                <th className="px-4 py-2 text-right text-[11px] font-medium text-gray-400 uppercase w-24"></th>
              </tr>
            </thead>
            <tbody>
              {spa.pricingLines.map((line) => {
                const isEditing = editingLine === line.id;
                const isConfirmingDelete = confirmDeleteId === line.id;

                if (isEditing) {
                  return (
                    <tr key={line.id} className="border-b border-gray-50 bg-indigo-50/30">
                      <td className="px-4 py-2">
                        <input value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-1 justify-end">
                          <span className="text-gray-400 text-sm">$</span>
                          <input value={editCost} onChange={(e) => setEditCost(e.target.value)} type="number" step="0.01"
                            className="w-20 border border-gray-300 rounded px-2 py-1 text-sm text-right" />
                          <select value={editUnit} onChange={(e) => setEditUnit(e.target.value)}
                            className="border border-gray-300 rounded px-1 py-1 text-[11px]">
                            <option value="vial">/ vial</option>
                            <option value="capsule">/ cap</option>
                            <option value="tube">/ tube</option>
                            <option value="bottle">/ bottle</option>
                            <option value="tablet">/ tab</option>
                            <option value="troche">/ troche</option>
                            <option value="unit">/ unit</option>
                          </select>
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <input value={editQty} onChange={(e) => setEditQty(e.target.value)} type="number"
                          className="w-16 border border-gray-300 rounded px-2 py-1 text-sm text-right" />
                      </td>
                      <td className="px-4 py-2 text-right text-[13px] text-gray-400">
                        {editCost && editQty ? formatCurrency(parseFloat(editCost) * parseInt(editQty)) : "—"}
                      </td>
                      <td className="px-4 py-2">
                        <input value={editVendor} onChange={(e) => setEditVendor(e.target.value)}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm" placeholder="Vendor" />
                      </td>
                      <td className="px-4 py-2">
                        <input value={editSource} onChange={(e) => setEditSource(e.target.value)}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm" placeholder="Source" />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={handleSaveEdit} disabled={editSaving}
                            className="text-[11px] text-green-600 hover:text-green-800 disabled:opacity-50">
                            {editSaving ? "..." : "Save"}
                          </button>
                          <button onClick={() => setEditingLine(null)} className="text-[11px] text-gray-400 hover:text-gray-600">Cancel</button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={line.id} className={`border-b border-gray-50 ${isConfirmingDelete ? "bg-red-50/30" : ""}`}>
                    <td className="px-4 py-2 text-[13px] text-gray-900">{line.medicationName}</td>
                    <td className="px-4 py-2 text-right text-[13px] font-medium text-gray-900">
                      {formatCurrency(line.currentCost)} <span className="text-[10px] font-normal text-gray-400">/ {line.unit}</span>
                    </td>
                    <td className="px-4 py-2 text-right text-[13px] text-gray-700 tabular-nums">{line.monthlyQty}</td>
                    <td className="px-4 py-2 text-right text-[13px] text-gray-700">{formatCurrency(line.currentCost * line.monthlyQty)}</td>
                    <td className="px-4 py-2 text-[12px] text-gray-500">{line.currentVendor || "—"}</td>
                    <td className="px-4 py-2 text-[12px] text-gray-400">{line.pricingSource || "—"}</td>
                    <td className="px-4 py-2 text-right">
                      {isConfirmingDelete ? (
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => handleDeleteLine(line.id)} disabled={deleting === line.id}
                            className="text-[11px] text-red-600 hover:text-red-800 font-medium disabled:opacity-50">
                            {deleting === line.id ? "..." : "Delete"}
                          </button>
                          <button onClick={() => setConfirmDeleteId(null)} className="text-[11px] text-gray-400 hover:text-gray-600">Cancel</button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => startEditLine(line)} className="text-[11px] text-indigo-600 hover:text-indigo-800">Edit</button>
                          <button onClick={() => setConfirmDeleteId(line.id)}
                            className="text-[11px] text-gray-400 hover:text-red-600 transition-colors">Remove</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Proposed Program Pricing */}
      {computedComparison.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg mb-8">
          <div className="px-5 py-4 border-b border-gray-200 bg-gradient-to-r from-indigo-50/50 to-white">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Proposed Program Pricing</h2>
                <p className="text-xs text-gray-500 mt-0.5">Current pricing vs proposed, with savings and margin</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const url = `/med-spas/${spa.id}/proposal?selections=${encodeURIComponent(JSON.stringify(pharmSelections))}`;
                    window.open(url, "_blank");
                  }}
                  className="border border-gray-200 text-gray-700 rounded-md px-3 py-1.5 text-[11px] font-medium hover:bg-gray-50 transition-colors"
                >
                  Preview Proposal
                </button>
                {proposalItems.length > 0 && spa.latestProposal?.status !== "accepted" && (
                  <button onClick={() => setSendProposalOpen(true)}
                    className="border border-indigo-200 text-indigo-700 rounded-md px-3 py-1.5 text-[11px] font-medium hover:bg-indigo-50 transition-colors">
                    Send Proposal
                  </button>
                )}
                {spa.latestProposal?.status === "accepted" && !spa.activeAgreement && proposalItems.length > 0 && (
                  <button onClick={() => { setIsRenewal(false); setAgreementDrawerOpen(true); }}
                    className="bg-indigo-600 text-white rounded-md px-3 py-1.5 text-[11px] font-medium hover:bg-indigo-700 transition-colors">
                    Activate Pricing
                  </button>
                )}
              </div>
            </div>
            {/* Proposal status */}
            {spa.latestProposal && (
              <div className="flex items-center gap-3 mb-3">
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${
                  spa.latestProposal.status === "accepted" ? "bg-green-500" :
                  spa.latestProposal.status === "viewed" ? "bg-purple-500" :
                  spa.latestProposal.status === "sent" ? "bg-blue-500" : "bg-gray-300"
                }`} />
                <span className={`text-[12px] font-medium ${
                  spa.latestProposal.status === "accepted" ? "text-green-700" :
                  spa.latestProposal.status === "viewed" ? "text-purple-700" :
                  spa.latestProposal.status === "sent" ? "text-blue-700" : "text-gray-500"
                }`}>
                  Proposal {spa.latestProposal.status}
                </span>
                {spa.latestProposal.sentAt && <span className="text-[10px] text-gray-400">Sent {new Date(spa.latestProposal.sentAt).toLocaleDateString()}</span>}
                {spa.latestProposal.viewedAt && <span className="text-[10px] text-gray-400">Viewed {new Date(spa.latestProposal.viewedAt).toLocaleDateString()}</span>}
                {spa.latestProposal.acceptedAt && <span className="text-[10px] text-gray-400">Accepted {new Date(spa.latestProposal.acceptedAt).toLocaleDateString()}</span>}
              </div>
            )}
            <div className="flex items-center gap-5">
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Monthly Savings</p>
                <p className={`text-lg font-bold tabular-nums ${totalMonthlySavings > 0 ? "text-green-700" : totalMonthlySavings < 0 ? "text-red-600" : "text-gray-400"}`}>{formatCurrency(totalMonthlySavings)}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Monthly Profit</p>
                <p className="text-lg font-bold tabular-nums text-indigo-600">{formatCurrency(totalMonthlyGrossProfit)}</p>
              </div>
            </div>
          </div>
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-gray-400 uppercase">Medication</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-medium text-gray-400 uppercase">Current</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-medium text-gray-400 uppercase">Proposed</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-gray-400 uppercase">Pharmacy</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-medium text-gray-400 uppercase">Savings</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-medium text-gray-400 uppercase">Profit</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-medium text-gray-400 uppercase">Mo. Qty</th>
              </tr>
            </thead>
            <tbody>
              {computedComparison.map((row) => {
                const srcRow = spa.pricingComparison.find((r) => r.lineId === row.lineId)!;
                const hasOptions = srcRow.pharmacyOptions.length > 0;
                const savingsPositive = row.unitSavings != null && row.unitSavings > 0;
                const savingsNegative = row.unitSavings != null && row.unitSavings < 0;
                const up = row.unitProfit ?? 0;
                return (
                  <tr key={row.lineId} className={`border-b border-gray-50 ${savingsPositive ? "bg-green-50/20" : savingsNegative ? "bg-red-50/10" : ""}`}>
                    <td className="px-4 py-2.5 text-[13px] text-gray-900">{row.medicationName}</td>
                    <td className="px-4 py-2.5 text-right text-[13px] text-gray-500 tabular-nums">{formatCurrency(row.currentCost)}</td>
                    <td className="px-4 py-2.5 text-right text-[13px] font-medium text-gray-900 tabular-nums">
                      {row.proposedPrice != null ? formatCurrency(row.proposedPrice) : "\u2014"}
                    </td>
                    <td className="px-4 py-2.5">
                      {hasOptions ? (
                        <PharmacyPicker
                          options={srcRow.pharmacyOptions}
                          selectedId={pharmSelections[row.lineId] ?? ""}
                          onSelect={(id) => setPharmSelections((prev) => ({ ...prev, [row.lineId]: id }))}
                        />
                      ) : (
                        <span className="text-[12px] text-gray-300">No match</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      <span className={`text-[13px] font-medium ${savingsPositive ? "text-green-700" : savingsNegative ? "text-red-600" : "text-gray-400"}`}>
                        {row.unitSavings != null ? formatCurrency(row.unitSavings) : "\u2014"}
                      </span>
                      {row.monthlySavings !== 0 && (
                        <span className="block text-[10px] text-gray-400">{formatCurrency(row.monthlySavings)}/mo</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      <span className={`text-[13px] font-medium ${up > 0 ? "text-indigo-600" : up < 0 ? "text-red-600" : "text-gray-400"}`}>
                        {formatCurrency(up)}
                      </span>
                      {row.monthlyProfit !== 0 && (
                        <span className="block text-[10px] text-gray-400">{formatCurrency(row.monthlyProfit)}/mo</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right text-[12px] text-gray-600 tabular-nums">{row.monthlyQty}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-gray-50">
                <td className="px-4 py-3 text-[12px] font-semibold text-gray-700" colSpan={4}>Monthly Totals</td>
                <td className={`px-4 py-3 text-right text-[13px] font-bold tabular-nums ${totalMonthlySavings > 0 ? "text-green-700" : totalMonthlySavings < 0 ? "text-red-600" : "text-gray-400"}`}>
                  {formatCurrency(totalMonthlySavings)}
                </td>
                <td className="px-4 py-3 text-right text-[13px] font-bold tabular-nums text-indigo-600">
                  {formatCurrency(totalMonthlyGrossProfit)}
                </td>
                <td className="px-4 py-3" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Pricing Agreement — in Pricing tab */}
      <div className="mb-8">
        <PricingAgreementSection
          agreement={spa.activeAgreement}
          history={spa.agreementHistory}
          onActivate={() => { setIsRenewal(false); setAgreementDrawerOpen(true); }}
          onRenew={() => { setIsRenewal(true); setAgreementDrawerOpen(true); }}
        />
      </div>

      </>
      )}

      {/* Send proposal modal */}
      <SendProposalModal
        open={sendProposalOpen}
        onClose={() => setSendProposalOpen(false)}
        medSpaId={spa.id}
        medSpaName={spa.name}
        contactEmail={spa.email}
        proposalLines={computedComparison.filter((r) => r.proposedPrice != null).map((r) => ({
          medicationName: r.medicationName,
          currentCost: r.currentCost,
          proposedPrice: r.proposedPrice,
          unitSavings: r.unitSavings,
          unitProfit: r.unitProfit,
          monthlyQty: r.monthlyQty,
          pharmacyName: r.selectedPharmacy,
        }))}
        monthlySavings={totalMonthlySavings}
        monthlyProfit={totalMonthlyGrossProfit}
      />

      {/* Agreement drawer — outside tabs so it works from any context */}
      <ActivateAgreementDrawer
        open={agreementDrawerOpen}
        onClose={() => setAgreementDrawerOpen(false)}
        medSpaId={spa.id}
        medSpaName={spa.name}
        isRenewal={isRenewal}
        defaultTermMonths={spa.pricingStrategy.defaultContractTermMonths ?? 12}
        proposalLines={proposalItems.map((p) => ({
          medicationName: p.medicationName,
          medicationId: p.medicationId ?? "",
          agreedPrice: p.medSpaPrice,
          pharmacyId: pharmSelections[p.lineId] ?? "",
          pharmacyName: p.selectedPharmacy ?? "",
          monthlyQty: p.monthlyQty,
          unit: p.unit,
        }))}
      />

      {/* ===== OVERVIEW TAB (continued) — Agreement status (read-only) ===== */}
      {activeTab === "overview" && spa.activeAgreement && (
        <div className="mb-8">
          <PricingAgreementSection
            agreement={spa.activeAgreement}
            history={spa.agreementHistory}
            onActivate={() => { setActiveTab("pricing"); }}
            onRenew={() => { setIsRenewal(true); setAgreementDrawerOpen(true); }}
          />
        </div>
      )}

      {/* ===== LEDGER TAB ===== */}
      {activeTab === "ledger" && (() => {
        const BISK_FEE = 5.00;
        const allOrders = spa.fulfilledOrders;

        // Filter by time period
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const periodFiltered = ledgerPeriod === "month"
          ? allOrders.filter((o) => new Date(o.orderDate) >= monthStart)
          : allOrders;

        // Filter by pharmacy
        const orders = ledgerPharmacy
          ? periodFiltered.filter((o) => o.pharmacyName === ledgerPharmacy)
          : periodFiltered;

        // Unique pharmacies for filter dropdown (from all orders, not filtered)
        const pharmacyNames = Array.from(new Set(allOrders.map((o) => o.pharmacyName))).sort();

        const totalScripts = orders.length;
        const pharmacySpend = Math.round(orders.reduce((s, o) => s + o.pharmacyCost, 0) * 100) / 100;
        const biskFees = Math.round(totalScripts * BISK_FEE * 100) / 100;
        const totalCostVal = Math.round((pharmacySpend + biskFees) * 100) / 100;
        const totalQty = orders.reduce((s, o) => s + o.quantity, 0);

        // Derive order numbers (same logic as main Ledger)
        const sortedOrders = [...orders].sort((a, b) => new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime());
        const orderNumMap = new Map<string, string>();
        const monthCtrs = new Map<string, number>();
        for (const o of sortedOrders) {
          const d = new Date(o.orderDate);
          const ym = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
          const c = (monthCtrs.get(ym) ?? 0) + 1;
          monthCtrs.set(ym, c);
          orderNumMap.set(o.id, `ORD-${ym}-${String(c).padStart(3, "0")}`);
        }

        const hasFilters = ledgerPharmacy || ledgerPeriod === "all";
        const monthLabel = ledgerPeriod === "month"
          ? now.toLocaleString("en-US", { month: "long", year: "numeric" })
          : "All Time";

        function handleExportStatement() {
          const lineRows = sortedOrders.map((o) => {
            const tc = Math.round((o.pharmacyCost + BISK_FEE) * 100) / 100;
            const orderNum = orderNumMap.get(o.id) ?? "";
            return `<tr>
              <td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;font-size:12px;color:#6b7280">${orderNum}</td>
              <td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;font-size:12px;color:#374151">${new Date(o.orderDate).toLocaleDateString()}</td>
              <td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;font-size:12px;color:#111">${o.medicationName}</td>
              <td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;font-size:12px;color:#374151;text-align:right">${o.quantity}</td>
              <td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;font-size:12px;color:#374151">${o.pharmacyName}</td>
              <td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;font-size:12px;color:#111;text-align:right">${formatCurrency(o.pharmacyCost)}</td>
              <td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;font-size:12px;color:#9ca3af;text-align:right">${formatCurrency(BISK_FEE)}</td>
              <td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;font-size:12px;color:#111;text-align:right;font-weight:500">${formatCurrency(tc)}</td>
            </tr>`;
          }).join("");

          const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Bisk Statement — ${spa.name} — ${monthLabel}</title></head>
<body style="margin:0;padding:32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111;font-size:13px;line-height:1.5">
  <div style="max-width:800px;margin:0 auto">
    <div style="padding-bottom:16px;border-bottom:2px solid #111;margin-bottom:24px;display:flex;justify-content:space-between;align-items:baseline">
      <span style="font-size:20px;font-weight:700;letter-spacing:-0.5px">Bisk</span>
      <span style="font-size:13px;color:#6b7280">Statement &middot; ${monthLabel}</span>
    </div>
    <div style="margin-bottom:32px">
      <h2 style="font-size:16px;font-weight:600;color:#111;margin-bottom:4px">${spa.name}</h2>
      <div style="display:flex;gap:24px;margin-bottom:12px;font-size:12px;color:#6b7280">
        <span>${totalScripts} scripts</span>
        <span>Pharmacy: ${formatCurrency(pharmacySpend)}</span>
        <span>Bisk fees: ${formatCurrency(biskFees)}</span>
        <span style="font-weight:600;color:#111">Total: ${formatCurrency(totalCostVal)}</span>
      </div>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden">
        <thead>
          <tr style="background:#f9fafb">
            <th style="padding:6px 10px;text-align:left;font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb">Order</th>
            <th style="padding:6px 10px;text-align:left;font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb">Date</th>
            <th style="padding:6px 10px;text-align:left;font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb">Medication</th>
            <th style="padding:6px 10px;text-align:right;font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb">Qty</th>
            <th style="padding:6px 10px;text-align:left;font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb">Pharmacy</th>
            <th style="padding:6px 10px;text-align:right;font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb">Cost</th>
            <th style="padding:6px 10px;text-align:right;font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb">Bisk Fee</th>
            <th style="padding:6px 10px;text-align:right;font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb">Total</th>
          </tr>
        </thead>
        <tbody>${lineRows}</tbody>
      </table>
    </div>
    <div style="padding-top:16px;border-top:1px solid #e5e7eb;font-size:10px;color:#9ca3af">
      Generated by Bisk &middot; ${new Date().toLocaleDateString()}
    </div>
  </div>
</body></html>`;

          const win = window.open("", "_blank");
          if (win) { win.document.write(html); win.document.close(); }
        }

        return (
          <>
          {/* Filters + Export — matches main Ledger layout */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex gap-1">
                <button onClick={() => setLedgerPeriod("month")}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    ledgerPeriod === "month" ? "bg-indigo-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}>This Month</button>
                <button onClick={() => setLedgerPeriod("all")}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    ledgerPeriod === "all" ? "bg-indigo-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}>All Time</button>
              </div>
              {pharmacyNames.length > 1 && (
                <select value={ledgerPharmacy} onChange={(e) => setLedgerPharmacy(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-1.5 text-sm">
                  <option value="">All pharmacies</option>
                  {pharmacyNames.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              )}
              {hasFilters && (
                <button onClick={() => { setLedgerPeriod("month"); setLedgerPharmacy(""); }}
                  className="text-xs text-gray-500 hover:text-gray-700">Clear</button>
              )}
            </div>
            <button onClick={handleExportStatement}
              className="border border-gray-200 text-gray-700 rounded-md px-3 py-1.5 text-[12px] font-medium hover:bg-gray-50 transition-colors">
              Export Statement
            </button>
          </div>

          {/* Summary cards — identical to main Ledger */}
          <div className="grid grid-cols-4 gap-4 mb-5">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <p className="text-xs text-gray-400 uppercase tracking-wider">Total Scripts</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{totalScripts}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{ledgerPeriod === "month" ? "this month" : "all time"}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <p className="text-xs text-gray-400 uppercase tracking-wider">Pharmacy Spend</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(pharmacySpend)}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <p className="text-xs text-gray-400 uppercase tracking-wider">Bisk Fees</p>
              <p className="text-2xl font-bold text-gray-500 mt-1">{formatCurrency(biskFees)}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <p className="text-xs text-gray-400 uppercase tracking-wider">Total Cost</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(totalCostVal)}</p>
            </div>
          </div>

          {/* Transaction table — identical structure to main Ledger (minus Med Spa column) */}
          {orders.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
              <p className="text-gray-400 text-sm">{allOrders.length > 0 ? "No records match these filters." : "No transactions yet."}</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="shrink-0 flex items-center text-[11px] font-medium text-gray-400 uppercase tracking-wider border-b border-gray-200 bg-gray-50">
                <div className="px-4 py-2.5 flex-[0.5]">Order</div>
                <div className="px-4 py-2.5 flex-[0.5]">Date</div>
                <div className="px-4 py-2.5 flex-[1.2]">Medication</div>
                <div className="px-4 py-2.5 flex-[0.3] text-right">Qty</div>
                <div className="px-4 py-2.5 flex-[1]">Pharmacy</div>
                <div className="px-4 py-2.5 flex-[0.6] text-right">Cost</div>
                <div className="px-4 py-2.5 flex-[0.4] text-right">Fee</div>
                <div className="px-4 py-2.5 flex-[0.6] text-right">Total</div>
                <div className="px-4 py-2.5 flex-[0.5] text-center">Recon.</div>
              </div>

              <div className="max-h-[400px] overflow-y-auto">
                {sortedOrders.map((o, idx) => {
                  const tc = Math.round((o.pharmacyCost + BISK_FEE) * 100) / 100;
                  const orderNum = orderNumMap.get(o.id) ?? "";
                  return (
                    <div key={o.id} className={`flex items-center border-b border-gray-100 hover:bg-indigo-50/50 transition-colors ${idx % 2 === 1 ? "bg-gray-50/40" : ""}`}>
                      <div className="px-4 py-2 flex-[0.5] text-[10px] font-mono text-gray-400">{orderNum}</div>
                      <div className="px-4 py-2 flex-[0.5] text-[12px] text-gray-500">{new Date(o.orderDate).toLocaleDateString()}</div>
                      <div className="px-4 py-2 flex-[1.2] text-[13px] text-gray-900 truncate">{o.medicationName}</div>
                      <div className="px-4 py-2 flex-[0.3] text-right text-[13px] text-gray-700 tabular-nums">{o.quantity}</div>
                      <div className="px-4 py-2 flex-[1] text-[13px] text-gray-600" title={o.pharmacyName}>{o.pharmacyName}</div>
                      <div className="px-4 py-2 flex-[0.6] text-right text-[13px] font-medium text-gray-900 tabular-nums">{formatCurrency(o.pharmacyCost)}</div>
                      <div className="px-4 py-2 flex-[0.4] text-right text-[12px] text-gray-400 tabular-nums">{formatCurrency(BISK_FEE)}</div>
                      <div className="px-4 py-2 flex-[0.6] text-right text-[13px] font-medium text-gray-900 tabular-nums">{formatCurrency(tc)}</div>
                      <div className="px-4 py-2 flex-[0.5] text-center">
                        <div className="flex items-center justify-center gap-1">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500" />
                          <span className="text-[10px] font-medium text-green-700">Match</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Totals row — identical to main Ledger */}
              <div className="shrink-0 flex items-center border-t-2 border-gray-200 bg-gray-50 text-[12px] font-semibold">
                <div className="px-4 py-2.5 flex-[0.5]" />
                <div className="px-4 py-2.5 flex-[0.5]" />
                <div className="px-4 py-2.5 flex-[1.2] text-gray-700">Totals</div>
                <div className="px-4 py-2.5 flex-[0.3] text-right text-gray-700 tabular-nums">{totalQty}</div>
                <div className="px-4 py-2.5 flex-[1]" />
                <div className="px-4 py-2.5 flex-[0.6] text-right text-gray-900 tabular-nums">{formatCurrency(pharmacySpend)}</div>
                <div className="px-4 py-2.5 flex-[0.4] text-right text-gray-500 tabular-nums">{formatCurrency(biskFees)}</div>
                <div className="px-4 py-2.5 flex-[0.6] text-right text-gray-900 tabular-nums">{formatCurrency(totalCostVal)}</div>
                <div className="px-4 py-2.5 flex-[0.5]" />
              </div>
            </div>
          )}
          </>
        );
      })()}

      {/* ===== ACTIVITY TAB ===== */}
      {activeTab === "activity" && (
      <>
      {/* Notes / Activity */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-200 bg-gray-50">
          <h2 className="text-sm font-medium text-gray-900">Notes &amp; Activity</h2>
        </div>
        <div className="px-5 py-3 border-b border-gray-100">
          <div className="flex gap-2">
            <select value={noteType} onChange={(e) => setNoteType(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm shrink-0">
              {NOTE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <input value={noteText} onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && noteText.trim()) handleAddNote(); }}
              placeholder="Add a note..."
              className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm" />
            <button onClick={handleAddNote} disabled={noteSaving || !noteText.trim()}
              className="bg-indigo-600 text-white rounded px-3 py-1.5 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 shrink-0">
              {noteSaving ? "..." : "Add"}
            </button>
          </div>
        </div>
        {spa.notes.length === 0 ? (
          <div className="p-6 text-center text-gray-400 text-sm">No notes yet.</div>
        ) : (
          <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
            {spa.notes.map((n) => (
              <div key={n.id} className="px-5 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${NOTE_TYPE_COLORS[n.type] ?? "bg-gray-100 text-gray-600"}`}>
                    {NOTE_TYPES.find((t) => t.value === n.type)?.label ?? n.type}
                  </span>
                  <span className="text-[11px] text-gray-400">{new Date(n.createdAt).toLocaleDateString()} {new Date(n.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <p className="text-sm text-gray-700">{n.note}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      </>
      )}

      <MedSpaDealDrawer open={dealOpen} onClose={() => setDealOpen(false)} spa={spa} />
    </>
  );
}

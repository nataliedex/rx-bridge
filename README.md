# Rx-Bridge

Prescription standardization and routing platform for compound pharmacies.

Rx-Bridge acts as an intelligent middleware between prescribers (and their D2C brand partners) and compound pharmacies. It normalizes prescription data, validates it against pharmacy-specific requirements, routes orders to the optimal pharmacy based on pricing and service coverage, and manages the full order lifecycle through approval and batch sending.

## Prerequisites

- **Node.js** >= 18 (tested on 20.x)
- **npm** >= 9

No external database required — uses SQLite locally via Prisma.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Generate Prisma client
npx prisma generate

# 3. Create SQLite database and apply schema
npx prisma db push

# 4. Seed sample data
npx tsx prisma/seed.ts

# 5. Start dev server
npm run dev

# Open http://localhost:3000
```

### Common Commands

```bash
npm run dev           # Start dev server (Turbopack)
npm run build         # Production build
npm test              # Run Jest tests
npx prisma studio     # Browse database with Prisma Studio
```

### Database Reset

If you need to start fresh (e.g. after schema changes):

```bash
rm -f prisma/dev.db*
npx prisma db push
npx tsx prisma/seed.ts
```

### Troubleshooting

**"Unknown field" or Prisma errors after schema changes:**
```bash
npx prisma generate    # Regenerate Prisma client
# Then restart the dev server
```

**"Attempt to write a readonly database":**
```bash
rm -f prisma/dev.db*   # Delete corrupted DB
npx prisma db push     # Recreate
npx tsx prisma/seed.ts  # Re-seed
```

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack) + TypeScript strict mode
- **Styling**: Tailwind CSS v4
- **Database**: SQLite (local MVP) via Prisma ORM
- **Validation**: Zod
- **Testing**: Jest + ts-jest

## Architecture

### Three-Layer Transformation Pipeline

```
Input Sources          Normalizer              Pharmacy Formatters
─────────────          ──────────              ───────────────────
ManualAdapter    →     normalizeIntake()   →   StandardFormatter
EhrAdapter       →     normalizeOrder()    →   LifefileFormatter
ApiAdapter       →                         →   (per-pharmacy)

                       ↓
                 NormalizedOrder
                 + ComplianceResult
                 + SendReadiness
```

**Intake adapters** (`src/lib/intake/`) parse source-specific data into a common `RawIntake` shape.

**Normalizer** (`src/lib/transformers/normalize.ts`) cleans data, checks compliance against pharmacy-specific requirements, and computes send readiness.

**Formatters** (`src/lib/transformers/formatters/`) convert normalized data into pharmacy-facing packets. Includes standard format and Lifefile CSV for pharmacy integration.

### Pharmacy Routing Engine

```
Inputs                  Engine                    Output
──────                  ──────                    ──────
Medication name    →    Filter by service area    → Recommended pharmacy
Patient state      →    Score by price            → Alternatives ranked
Brand preference   →    Apply freshness penalty   → Routing rationale
                   →    Apply policy config       → Status (recommended/needs_review/no_eligible)
```

The routing engine (`src/lib/routing.ts`) is deterministic and rules-based. All scoring parameters are configurable via the Settings page (`src/lib/routing-config.ts`).

### Data Model

| Model | Purpose |
|-------|---------|
| **Brand** | D2C business customer (e.g. "Vitality Wellness Co.") |
| **BrandPharmacyConfig** | Routes brands to pharmacies with priority and format overrides |
| **Patient** | Patient demographics |
| **Prescriber** | Prescriber info, keyed by NPI |
| **Pharmacy** | Compound pharmacy with service states, archival lifecycle |
| **Medication** | Network catalog with `sellPrice` (Rx-Bridge negotiated rate) |
| **MedicationPriceEntry** | Pharmacy-specific cost with temporal pricing (effectiveDate/endDate), verification tracking |
| **Order** | Core order with Rx data, workflow status, send readiness, routing metadata |
| **Issue** | Unified blocker/warning system — single source of truth for order blocks |
| **CorrectionRequest** | Tracks requests sent back to providers for inbound order corrections |
| **OrderStatusHistory** | Audit trail of status changes |
| **OrderTransmission** | Log of every send action with payload snapshot |
| **ExportBatch** | Groups of orders sent together to a pharmacy |
| **SystemConfig** | Key-value store for system settings (routing policy, etc.) |

### Two Separate Concerns

**Status** (human-driven): `draft → submitted → under_review → needs_clarification / correction_requested → approved → queued → sent_to_pharmacy → completed`

**Send Readiness** (system-computed): `ready | missing_data | needs_review` — derived from open Issues.

Status reflects workflow decisions. Send readiness reflects data quality. They never cross-contaminate.

### Inbound Order Workflow

Orders from external sources (EHR/API) cannot have their clinical data edited by Rx-Bridge. Instead:
- Prescription, Patient, and Prescriber sections are **read-only**
- Issues show a **"Request Correction"** action instead of "Fix"
- Correction requests are tracked with a **"Correction Requested"** status
- When corrections are received, the order returns to review

## Key Pages

### /orders (Home)
Workspace with workflow tiles (Draft, Needs Attention, Approved, Queued, Sent), inline header dropdowns for Status and Action Needed, typeahead search, and pharmacy filter support.

### /orders/[id] (Order Detail)
Guided workflow banner, open issues checklist with field-level linking, editable sections (read-only for inbound orders), correction request workflow, routing rationale, pricing with margin visibility.

### /orders/new (Manual Order Entry)
Multi-section form with auto-routing. Entering a medication name triggers the routing engine to recommend the optimal pharmacy based on price, service coverage, and freshness.

### /queue (Batch Send)
Queued orders grouped by pharmacy with checkbox selection for partial sends.

### /network (Medications)
Medication catalog with columns: Medication, Pharmacies, Lowest Cost, Sell Price, Best Margin. Click through to medication detail with per-pharmacy pricing and margin breakdown.

### /network/audit (Pricing Audit)
Pharmacy pricing audit with staleness tracking (Fresh/Aging/Stale/Missing), summary cards, search/filter, and status-aware row actions (Verify Price, Add Price, Remove).

### /network/pharmacies (Pharmacies)
Pharmacy management table with service states summary, deep-links to pricing audit and orders. Click row for pharmacy detail page; Edit button for edit drawer with archive/restore lifecycle.

### /network/pharmacies/[id] (Pharmacy Detail)
Pharmacy info, active medication pricing, order volume by brand, deep-links to audit and filtered orders.

### /settings (Routing Policy)
Configurable routing engine parameters: freshness thresholds, penalty values, brand default bonus, eligibility rules.

## Pricing Model

Rx-Bridge uses a **GPO (Group Purchasing Organization) model**:

- **Sell Price**: One negotiated price per medication, same for all brands — stored as `sellPrice` on the Medication model
- **Pharmacy Cost**: Per-pharmacy pricing with temporal history and verification tracking
- **Margin**: `sellPrice - pharmacyCost` — visible on medication detail, order detail, and the medications table

Routing optimizes for the lowest pharmacy cost while respecting service regions and pricing freshness.

## Seed Data

The seed script creates a realistic dataset:
- 3 brands, 3 pharmacies, 5 brand-pharmacy routing configs
- 21 medications with sell prices and per-pharmacy cost entries (varied freshness/verification)
- 3 prescribers, 12 patients
- 22 orders across all workflow states
- 7 issues (system-detected + human clarification requests)
- 1 transmission record

## Project Structure

```
src/
  app/
    orders/               # Orders workspace (tiles + table + filters)
    orders/[id]/          # Order detail with guided workflow
    orders/[id]/export/   # Print-friendly pharmacy document
    orders/new/           # Manual order entry form
    queue/                # Batch send queue
    network/              # Medication catalog
    network/[id]/         # Medication detail with pricing
    network/audit/        # Pharmacy pricing audit
    network/pharmacies/   # Pharmacy management
    network/pharmacies/[id]/ # Pharmacy detail
    settings/             # Routing policy configuration
  components/             # React components
  lib/
    actions.ts            # Server actions (CRUD, routing, audit, corrections)
    types.ts              # Status, readiness, issue type definitions
    routing.ts            # Pharmacy routing engine
    routing-config.ts     # Configurable routing policy
    pricing.ts            # Currency/percent formatting, pricing utilities
    format.ts             # Relative time utilities
    db.ts                 # Prisma client singleton
    validators/           # Zod schemas
    intake/               # Input adapters (manual, EHR, API)
    transformers/         # Normalization pipeline + pharmacy formatters
    __tests__/            # Jest tests
prisma/
  schema.prisma           # Database schema
  seed.ts                 # Sample data
```

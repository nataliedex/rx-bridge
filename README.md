# Rx-Bridge

Prescription standardization and routing platform for compound pharmacies.

Rx-Bridge acts as an intelligent middleware between prescribers (and their D2C brand partners) and compound pharmacies. It normalizes messy prescription data, validates it against pharmacy-specific requirements, and routes orders through an approval workflow before batch-sending to the fulfillment pharmacy.

## Quick Start

```bash
# Install dependencies
npm install

# Generate Prisma client + create SQLite database + seed sample data
npx prisma generate
npx prisma db push
npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts

# Start dev server
npm run dev

# Open http://localhost:3000
```

### Other Commands

```bash
npm test              # Run Jest tests
npm run db:studio     # Browse database with Prisma Studio
npm run db:reset      # Reset database and re-seed
npm run build         # Production build
```

## Tech Stack

- **Framework**: Next.js 16 (App Router) + TypeScript
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
EhrAdapter       →     normalizeOrder()    →   (future: per-pharmacy)
ApiAdapter       →                         →
                       ↓
                 NormalizedOrder
                 + ComplianceResult
                 + SendReadiness
```

**Intake adapters** (`src/lib/intake/`) parse source-specific data into a common `RawIntake` shape.

**Normalizer** (`src/lib/transformers/normalize.ts`) cleans data (phone formatting, state abbreviation, whitespace trimming), checks compliance against pharmacy-specific requirements, and computes send readiness.

**Formatters** (`src/lib/transformers/formatters/`) convert normalized data into pharmacy-facing packets. Currently only a standard format; the registry pattern supports adding pharmacy-specific formatters.

### Data Model

| Model | Purpose |
|-------|---------|
| **Brand** | D2C business customer (e.g. "Vitality Wellness Co.") |
| **BrandPharmacyConfig** | Routes brands to pharmacies with priority and format overrides |
| **Patient** | Patient demographics |
| **Prescriber** | Prescriber info, keyed by NPI |
| **Pharmacy** | Compound pharmacy with configurable field requirements |
| **Order** | Core order with denormalized Rx data, workflow status, and send readiness |
| **Issue** | Unified blocker/warning system — single source of truth for why an order can't be sent |
| **OrderStatusHistory** | Audit trail of human-driven status changes |
| **OrderTransmission** | Log of every send action with payload snapshot |

### Two Separate Concerns

**Status** (human-driven): `draft → submitted → under_review → needs_clarification → approved → queued → sent_to_pharmacy → completed`

**Send Readiness** (system-computed): `ready | missing_data | needs_review` — derived from open Issues, not from status.

Status reflects workflow decisions. Send readiness reflects data quality. They never cross-contaminate.

## Key Pages

### /orders (Home)
The single workspace. Workflow tiles at the top (Draft, Needs Attention, Approved, Queued, Sent) filter the table below. Inline header dropdowns for Status and Action Needed. Typeahead search across patient, medication, brand, pharmacy.

### /orders/[id] (Order Detail)
Guided workflow banner at top ("Fix issues → Approve → Add to Queue → Send"). Open Issues checklist with field-level linking — clicking an issue opens edit mode on the target section and highlights the specific field. Editable Patient, Prescriber, Prescription sections with save-and-resolve flow.

### /orders/[id]/export (Pharmacy Document)
Print-friendly pharmacy-facing order summary with structured layout.

### /orders/new (Manual Order Entry)
Multi-section form with brand-pharmacy routing. Selecting a brand auto-selects the recommended pharmacy based on routing config.

### /queue (Batch Send)
Queued orders grouped by pharmacy. "Send all orders" per group with checkbox selection for partial sends. Orders disappear from the list after successful transmission.

## Workflow

1. **Order arrives** (manual entry, EHR, or API)
2. **System generates Issues** for missing required fields
3. **Operator fixes data** using inline editing on the order detail page
4. **Issues auto-resolve** when data is corrected; human issues require manual resolution
5. **Operator approves** the order once all blocking issues are cleared
6. **Operator adds to queue** (or sends immediately for urgent orders)
7. **Batch send** from the queue page transmits to the pharmacy and logs the payload

## Issue System

Issues are the single source of truth for "why can't this order be sent?"

| Type | Severity | Source | Example |
|------|----------|--------|---------|
| `missing_required_field` | blocking | system | "Required by pharmacy: Quantity" |
| `clarification_request` | blocking | rx_bridge_user | "Prescriber needs to confirm concentration ratio" |
| `validation_warning` | warning | system | (future use) |
| `manual_review` | warning | rx_bridge_user | (future use) |

Send readiness derives from open issues:
- Any open **blocking** issue → `missing_data`
- Any open **warning** issue → `needs_review`
- No open issues → `ready`

## Pharmacy Requirements

Each pharmacy defines required and recommended fields in `requirementsJson`:

```json
{
  "requiredFields": ["patient.dob", "prescriber.npi", "medication.name", "medication.directions", "medication.quantity"],
  "recommendedFields": ["patient.phone", "medication.strength", "medication.dosageForm"]
}
```

The normalizer checks compliance against the target pharmacy's requirements. Missing required fields become blocking Issues automatically.

## Seed Data

The seed script creates a realistic dataset:
- 3 brands, 3 pharmacies, 5 brand-pharmacy routing configs
- 3 prescribers, 12 patients
- 22 orders across all workflow states (draft, submitted, approved, queued, sent, completed, needs clarification)
- 7 issues (system-detected missing fields + human clarification requests)
- 1 transmission record

## Project Structure

```
src/
  app/
    orders/           # Orders workspace (tiles + table + filters)
    orders/[id]/      # Order detail with guided workflow
    orders/[id]/export/ # Print-friendly pharmacy document
    orders/new/       # Manual order entry form
    queue/            # Batch send queue
  components/         # React components (editable sections, workflow banner, etc.)
  lib/
    actions.ts        # Server actions (CRUD, issue management, send)
    types.ts          # Status, readiness, issue type definitions
    format.ts         # Relative time, urgency tier utilities
    validators/       # Zod schemas
    intake/           # Input adapters (manual, EHR, API)
    transformers/     # Normalization pipeline + pharmacy formatters
    __tests__/        # Jest tests for normalization + compliance
prisma/
  schema.prisma       # Database schema
  seed.ts             # Sample data
```

## Future Improvements

- **Authentication & roles** (admin, operator, reviewer)
- **Pharmacy-specific formatters** (custom output per pharmacy)
- **PDF generation** for pharmacy documents
- **Real integrations** (fax, SFTP, pharmacy APIs)
- **EHR webhook receiver** for automated intake
- **Fulfillment pharmacy editing** with re-routing safeguards
- **Patient deduplication** (match by name + DOB)
- **Audit diffing** (track what changed between edits)
- **Analytics** (turnaround times, rejection rates, pharmacy performance)

---
name: Rx-Bridge MVP Overview
description: Rx-Bridge is a middleware/order-bridge between prescribers and compound pharmacies — core context for all work in this repo
type: project
---

Rx-Bridge is a startup building an internal operations tool that bridges prescriber orders into pharmacy-ready format.

**Why:** Compound pharmacies manually re-enter prescription/order info. Rx-Bridge normalizes, validates, and formats order data once so pharmacies get a clean structured package.

**How to apply:** All features should prioritize operational reliability — complete data capture, missing-info detection, easy review, standardized output. This is NOT a consumer pharmacy app — it's an ops workflow tool. Design decisions should favor compliance and data completeness over polish.

Tech stack: Next.js (App Router) + TypeScript + Tailwind CSS + Prisma + SQLite (local MVP) + Zod validation.

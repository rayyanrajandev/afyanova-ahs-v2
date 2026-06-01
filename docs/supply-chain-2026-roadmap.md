# Hospital supply chain 2026 roadmap

Afyanova keeps **one supply-chain domain** (shared APIs and item master) while evolving the experience toward task-based, role-aware workspaces suitable for Tanzanian hospitals (MSD, facility tiers, clinical consumables).

## North star

Staff complete store work in minutes with full traceability: receipt → storage → issue → clinical consumption → audit.

## Phases

| Phase | Focus | Status |
|-------|--------|--------|
| **0** | Personas, metrics, contract refresh | This document |
| **1** | Supply chain **home** + **workspace** routes, deep links | **In progress** |
| **2** | Cycle counting, PAR levels, GRN, barcode wizards | Planned |
| **3** | Pharmacy lane, MSD depth, finance GRN export, clinical history | Planned |
| **4** | Analytics actions, SoD, notifications | Planned |
| **5** | CSSD, consignment, CMMS (tier-dependent) | Optional |

## Phase 1 (shipped increment)

- `/inventory-procurement` — **Supply chain home** (queues, KPIs, task cards)
- `/inventory-procurement/workspace?section=` — full operational workspace (former single page)
- `/inventory-procurement?section=` — backward compatible (opens workspace)
- Shared helpers: `resources/js/lib/inventoryProcurement.ts`

## Success metrics (pilot facility)

- Median receive time &lt; 3 minutes
- Median ward issue &lt; 2 minutes
- VEN-A stock-out days trending down
- Zero expired batch issues at dispense/issue
- Cycle count variance &lt; 2% of SKUs

## Personas

| Persona | Primary tasks |
|---------|----------------|
| Storekeeper | Receive, issue, transfer, reconcile |
| Procurement officer | Requests, MSD orders, suppliers |
| Pharmacist | Pharmaceutical items (future dedicated lane) |
| Ward lead | Requisitions, shortage visibility |
| Auditor | Ledger export, audit logs |

## Technical notes

- Backend remains `app/Modules/InventoryProcurement` (no split).
- Frontend: decompose `Workspace.vue` over time into route-level pages (`/items`, `/receive`, …).
- Entitlements already split (`inventory.items`, `inventory.procurement`, …) — map to home cards by permission.

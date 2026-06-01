# Hospital supply chain 2026 roadmap

Afyanova keeps **one supply-chain domain** (shared APIs and item master) while evolving the experience toward task-based, role-aware workspaces suitable for Tanzanian hospitals (MSD, facility tiers, clinical consumables).

## North star

Staff complete store work in minutes with full traceability: receipt → storage → issue → clinical consumption → audit.

## Phases

| Phase | Focus | Status |
|-------|--------|--------|
| **0** | Personas, metrics, contract refresh | Done (this document) |
| **1** | Supply chain **home** + **workspace** routes, deep links | **Shipped** |
| **2** | Task wizards (receive, issue, count), barcode, PAR | **In progress** |
| **3** | Pharmacy lane, MSD depth, finance GRN export, clinical history | Planned |
| **4** | Analytics actions, SoD, notifications | Planned |
| **5** | CSSD, consignment, CMMS (tier-dependent) | Optional |

## Shipped routes

| Route | Purpose |
|-------|---------|
| `/inventory-procurement` | Supply chain home — KPIs and task cards |
| `/inventory-procurement/workspace?section=` | Full operational workspace |
| `/inventory-procurement/receive` | Receive wizard (PO + direct receipt) |
| `/inventory-procurement/issue` | Issue-to-department wizard |
| `/inventory-procurement/count` | Cycle count / reconciliation wizard |
| `/inventory-procurement/suppliers` | Supplier registry |
| `/inventory-procurement/warehouses` | Warehouse registry |

Backward compatible: `/inventory-procurement?section=` opens the workspace.

Shared helpers: `resources/js/lib/inventoryProcurement.ts`  
Access / lookups: `useInventoryProcurementAccess`, `useInventoryMasterLookups`

## Phase 2 remaining

- Barcode scan-to-receive on receive wizard
- Scheduled cycle count programs (by warehouse / ABC class)
- PAR levels per department with auto-requisition
- Procurement approval thresholds and printable GRN

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
- Decompose `Workspace.vue` over time; task pages already extract high-frequency flows.
- Entitlements map to routes (`inventory.stock_movements`, `inventory.stock_issue`, …).

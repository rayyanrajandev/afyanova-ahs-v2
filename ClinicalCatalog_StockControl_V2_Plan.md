# Clinical Catalog & Stock Control → V2 Page Format

## Goal

Bring `clinical-catalogs/Index.vue` and `stock-control/Index.vue` onto this codebase's
established "V2 page" shell — the same sticky-header layout already used by
`billing/ChargeableItemsV2.vue`, `patients/IndexV2.vue`, `billing/IndexV2.vue`,
`platform/admin/ward-beds/IndexV2.vue`, etc. This is a **shell/layout conversion**, not a
rewrite of business logic: forms, sheets, dialogs, API calls, and workflow state stay as-is.

Reference implementation to copy the pattern from: `resources/js/pages/billing/ChargeableItemsV2.vue`.

## What "V2 format" means here (confirmed from existing code, not invented)

- `useStickyScrollContainer()` composable — one bounded, independently-scrolling container
  (`<div ref="scrollContainer" :style="{ height: scrollContainerHeight }">`) so a pinned header
  can stay fixed while only the list below scrolls.
- A `sticky top-0 z-10 bg-background/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80`
  header block (replaces today's bordered `<Card>`/`<section>` header).
- Title row: `h1.text-lg.font-bold` + subtitle, with a right-aligned cluster of
  `Badge` (count) + Refresh button + primary action button(s) + overflow `DropdownMenu`
  (ellipsis) for secondary actions (Export CSV, Print, etc.).
- `Tabs`/`TabsList` used as the **primary** category/type filter, each `TabsTrigger` carrying
  a live count `Badge` — placed directly in the sticky header, not nested inside a `<Card>`.
- A filter row directly below tabs: `SearchInput` + `Select`s, each `h-9 bg-background`.
- A conditional bulk-action bar (`rounded-lg border border-primary/20 bg-primary/5 px-3 py-2`)
  shown only when rows are selected.
- Below the sticky header, still inside the scroll container: the list, in
  `overflow-hidden rounded-lg border bg-card` → `<ul class="divide-y px-3">` of
  `RegistryListRow` items (both pages already use `RegistryListRow`/`RegistryListSkeleton`,
  so this part barely changes).
- File is renamed `Index.vue` → `IndexV2.vue`, and `Inertia::render(...)` in `routes/web.php`
  is updated to the new page path (matching how prior pages — patients, billing, ward-beds —
  migrated).

## Current state (both pages, confirmed by reading the templates)

Both already have:
- A bordered header `<section class="rounded-lg border border-border bg-card shadow-sm">`
  with icon-in-rounded-square + `h1` + description + facility-scope line — this is the
  *pre-V2* "Phase 1.5" header style, not the sticky V2 one.
- Tabs + search + filters-popover living **inside** a `<Card>` with a `border-b` header row,
  not in a sticky top-of-page block.
- `RegistryListRow` / `RegistryListSkeleton` already used for the list body — good, minimal
  change needed here.
- No `useStickyScrollContainer` — instead a plain `flex h-full flex-1 flex-col ... p-4 md:p-6`
  wrapper with a `Card`/`ScrollArea` doing internal scrolling.

Clinical Catalog specifics (`platform/admin/clinical-catalogs/Index.vue`, 3740 lines):
- 5 sub-catalogs as tabs (`lab-tests`, `radiology-procedures`, `theatre-procedures`,
  `clinical-procedures`, `formulary-items`), each with its own field set for the create/edit
  sheets — tabs already carry per-tab counts (`getTabCount`).
- Filters live in a `Popover` (category, dosage form, per-page) rather than inline `Select`s.
- Actions: Refresh, "New <item>", "Bulk workspace" sheet, overflow menu (Chargeable Items /
  Inventory items links), Export CSV, Print — all already implemented, just need to move
  into the V2 header positions.
- Bulk selection bar already exists (Activate/Deactivate/Retire) — same shape as
  ChargeableItemsV2's, just needs re-positioning into the sticky header.

Stock Control specifics (`inventory-procurement/stock-control/Index.vue`, 2620 lines):
- 3 tabs (`inventory`, `ledger`, `department-stock`), each rendering a separate tab
  component (`SupplyChainInventoryTab`, `SupplyChainLedgerTab`, `SupplyChainDepartmentStockTab`)
  that pull from `supplyChainPageApi` — NOT `RegistryListRow` directly in this file (the list
  markup lives inside those child tab components, out of scope for this file's edit unless
  we find they also need the sticky-shell treatment; the container-level tab switch is what
  we're converting here).
- Filters live in `SupplyChainFilterPopover` (category/stock-state/sort/date-range/per-page,
  varies per tab) plus a single search input that swaps `v-model` target based on `activeTab`.
- Header actions are data-driven via a `headerActions` computed (auto-refresh dropdown,
  New Item / Stock Adjustment / etc., Export, Print) — this maps cleanly onto the V2
  title-row action cluster.
- Because the 3 tabs render entirely different child components with their own internal
  scrolling (`flex min-h-0 flex-1 flex-col overflow-hidden`), this page's conversion needs
  the sticky header at the container level while leaving each `SupplyChainXTab` component's
  internal list/scroll behavior untouched (they are out of scope — only the page shell wrapping
  them changes).

## Approach

Both conversions follow the same steps, applied per file:

1. **Add `useStickyScrollContainer` import and call it**, get `scrollContainerHeight`.
2. **Replace the outer wrapper**: swap
   `<div class="flex h-full flex-1 flex-col gap-4 overflow-x-hidden rounded-lg p-4 md:p-6">`
   for
   `<div ref="scrollContainer" class="flex flex-col gap-4 overflow-x-hidden overflow-y-auto rounded-lg" :style="{ height: scrollContainerHeight }">`.
3. **Collapse the two-part header** (bordered `<section>` info block + separate `<Card>`
   tabs/fil482ters block) into **one** sticky header div:
   `<div class="sticky top-0 z-10 bg-background/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">`
   containing, in order: title row (h1 + subtitle + right-aligned Badge/Refresh/primary
   action/overflow menu) → Tabs w/ count badges → search+filter Select row → conditional
   bulk-action bar.
4. **Keep everything below** (the list / tab content) as its own block with `px-6 pb-6`,
   preserving existing loading/empty/error states, `RegistryListRow` markup, pagination
   footers, and — for Stock Control — the three `SupplyChainXTab` child components
   unchanged.
5. **Leave all `<script setup>` logic untouched** except what's needed to support the new
   template positions (no new refs/computed should be needed — the same state already
   backs the old header, we're only relocating markup). Do not touch forms, sheets, dialogs,
   API calls, or business rules.
6. **Rename file** `Index.vue` → `IndexV2.vue` in both directories.
7. **Update routes**: in `routes/web.php`, change the two `Inertia::render('...')` calls
   (`platform-admin-clinical-catalogs.page`, `inventory-procurement-stock-control.page`) to
   point at the new `IndexV2` page paths.
8. **Verify**: run `npm run build` (or the project's type-check script) to confirm no Vue/TS
   errors, then manually smoke-test both pages in the browser (tabs switch, search/filter,
   bulk actions, create/edit sheets still open, export/print still work) before calling this
   done — static checks alone aren't sufficient here per this session's own testing
   convention.

## Order of work

1. Clinical Catalog first (single-file, `RegistryListRow`-based list already in this file —
   more direct 1:1 mapping to ChargeableItemsV2's pattern).
2. Stock Control second (tab-content is delegated to child components, so the shell
   conversion is more mechanical but the visual verification needs to cover all 3 tabs).
3. Manual browser verification of both, referencing the "test UI before reporting done"
   rule.

## Explicitly out of scope

- Any change to `SupplyChainInventoryTab` / `SupplyChainLedgerTab` /
  `SupplyChainDepartmentStockTab` internals.
- Any change to create/edit/details Sheets or Dialogs for either page.
- Migrating either page's data-fetching to TanStack Query composables (ChargeableItemsV2
  does this, but it's a heavier, separate lift — not required for the page to visually and
  structurally match "V2 format").
- Any backend/API changes.

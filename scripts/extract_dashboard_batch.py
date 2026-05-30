#!/usr/bin/env python3
"""One-off helper: extract Dashboard.vue preset switch into workflows/appendWorkflowBatch.ts"""
from pathlib import Path

root = Path(__file__).resolve().parents[1]
vue = (root / "resources/js/pages/Dashboard.vue").read_text(encoding="utf-8")
start = vue.index("    switch (preset) {")
end = vue.index("    if (preset === 'admin' || sharedOpsTelemetryLoaded.value)", start)
switch_body = vue[start + len("    switch (preset) {") : end].rstrip()
switch_body = switch_body.replace("break;", "break;").replace("batch.push", "batch.push")

header = """import type { DashboardLoaderDeps, DashboardBatchEntry } from '@/workflows/types';

export function appendWorkflowBatchEntries(
    preset: string,
    batch: DashboardBatchEntry[],
    deps: DashboardLoaderDeps,
): void {
    const { guardedRequest, apiGet, currentUserId } = deps;
    const clinicianAppointmentQuery = currentUserId !== null ? { clinicianUserId: currentUserId } : {};

    switch (preset) {
"""
footer = """
        default:
            break;
    }
}
"""

out = root / "resources/js/workflows/appendWorkflowBatch.ts"
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(header + switch_body + footer, encoding="utf-8")
print(f"Wrote {out} ({out.stat().st_size} bytes)")

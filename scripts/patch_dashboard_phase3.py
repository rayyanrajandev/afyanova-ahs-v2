from pathlib import Path
import re

path = Path(__file__).resolve().parents[1] / "resources/js/pages/Dashboard.vue"
text = path.read_text(encoding="utf-8")

if "buildWorkflowSurface" not in text:
    text = text.replace(
        "import { appendWorkflowBatchEntries } from '@/workflows/appendWorkflowBatch';",
        "import { appendWorkflowBatchEntries } from '@/workflows/appendWorkflowBatch';\nimport { buildWorkflowSurface } from '@/workflows/buildWorkflowSurface';",
    )

if "activeWorkflowSurface" not in text:
    anchor = "const activePresetKey = computed<DashboardPresetKey>(() => {"
    start = text.find(anchor)
    if start == -1:
        raise SystemExit("activePresetKey anchor not found")
    close = text.find("\n});\n\nconst activePreset = computed", start)
    if close == -1:
        raise SystemExit("activePreset anchor not found")
    insert_pos = close + len("\n});\n")
    insert = """
const activeWorkflowWidgets = computed(() =>
    workflowDefinitions.value.find((workflow) => workflow.key === activePresetKey.value)?.widgets ?? [],
);

const activeWorkflowSurface = computed(() =>
    buildWorkflowSurface(
        activePresetKey.value,
        counts.value,
        lists.value,
        { numberValue, metric },
        activeWorkflowWidgets.value,
    ),
);

"""
    text = text[:insert_pos] + insert + text[insert_pos:]

# kpis
for key in ("operations", "records", "supply"):
    pattern = rf"    if \(activePresetKey\.value === '{key}'\) \{{\n        return \[[\s\S]*?\n        \];\n    \}}\n"
    text, n = re.subn(pattern, "", text, count=1)
    if n == 0:
        print(f"warn: kpis block for {key} not removed")

text = text.replace(
    "const kpis = computed(() => {",
    "const kpis = computed(() => {\n    const surface = activeWorkflowSurface.value;\n    if (surface?.kpis.length) {\n        return surface.kpis;\n    }\n",
    1,
)

# actions
for key in ("operations", "records", "supply"):
    pattern = rf"    if \(activePresetKey\.value === '{key}'\) \{{\n        return \[[\s\S]*?\n        \];\n    \}}\n"
    text, n = re.subn(pattern, "", text, count=1)

text = text.replace(
    "const actions = computed(() => {",
    "const actions = computed(() => {\n    const surface = activeWorkflowSurface.value;\n    if (surface?.actions.length) {\n        return surface.actions;\n    }\n",
    1,
)

# queueRows - remove operations, records, supply blocks
ops_q = """    if (activePresetKey.value === 'operations') {
        const alertRows = (lists.value.operationsCredentialingAlerts ?? []).map((item: any) => mapCredentialingAlertToQueueRow(item));
        const privilegeRows = (lists.value.operationsPrivilegeQueue ?? []).map((entry: any) =>
            mapPrivilegeGrantToQueueRow(entry.privilege ?? {}, entry.staff ?? {}),
        );

        return [...alertRows, ...privilegeRows].slice(0, 10);
    }
"""
text = text.replace(ops_q, "")

rec_q = """    if (activePresetKey.value === 'records') {
        return (lists.value.draftMedicalRecords ?? [])
            .slice(0, 8)
            .map((item: Record<string, unknown>) => mapMedicalRecordToQueueRow(item));
    }
"""
text = text.replace(rec_q, "")

sup_q = """    if (activePresetKey.value === 'supply') {
        return (lists.value.procurementRequests ?? [])
            .slice(0, 8)
            .map((item: Record<string, unknown>) => mapProcurementRequestToQueueRow(item));
    }
"""
text = text.replace(sup_q, "")

text = text.replace(
    "const queueRows = computed<QueueRow[]>(() => {",
    "const queueRows = computed<QueueRow[]>(() => {\n    const surface = activeWorkflowSurface.value;\n    if (surface?.queueRows.length) {\n        return surface.queueRows;\n    }\n",
    1,
)

# queueTitle / queueDescription / search placeholder
for key in ("operations", "records", "supply"):
    text = re.sub(
        rf"    if \(activePresetKey\.value === '{key}'\) return '[^']+';\n",
        "",
        text,
        count=1,
    )

text = text.replace(
    "const queueTitle = computed(() => {",
    "const queueTitle = computed(() => {\n    const surface = activeWorkflowSurface.value;\n    if (surface?.queueTitle) {\n        return surface.queueTitle;\n    }\n",
    1,
)

text = text.replace(
    "const queueDescription = computed(() => {",
    "const queueDescription = computed(() => {\n    const surface = activeWorkflowSurface.value;\n    if (surface?.queueDescription) {\n        return surface.queueDescription;\n    }\n",
    1,
)

# remove operations/records/supply branches in queueDescription
text = re.sub(
    r"    if \(activePresetKey\.value === 'operations'\) \{\n        return '[^']+';\n    \}\n",
    "",
    text,
    count=1,
)
text = re.sub(
    r"    if \(activePresetKey\.value === 'records'\) \{\n        return '[^']+';\n    \}\n",
    "",
    text,
    count=1,
)
text = re.sub(
    r"    if \(activePresetKey\.value === 'supply'\) \{\n        return '[^']+';\n    \}\n",
    "",
    text,
    count=1,
)

# dashboardSearchPlaceholder - remove records/supply/operations branches added earlier
text = re.sub(
    r"    if \(activePresetKey\.value === 'operations'\) \{\n        return '[^']+';\n    \}\n",
    "",
    text,
    count=1,
)
text = re.sub(
    r"    if \(activePresetKey\.value === 'records'\) \{\n        return '[^']+';\n    \}\n",
    "",
    text,
    count=1,
)
text = re.sub(
    r"    if \(activePresetKey\.value === 'supply'\) \{\n        return '[^']+';\n    \}\n",
    "",
    text,
    count=1,
)

text = text.replace(
    "const dashboardSearchPlaceholder = computed(() => {",
    "const dashboardSearchPlaceholder = computed(() => {\n    const surface = activeWorkflowSurface.value;\n    if (surface?.searchPlaceholder) {\n        return surface.searchPlaceholder;\n    }\n",
    1,
)

# handoff - remove operations block
ops_h = """    if (activePresetKey.value === 'operations') {
        const alertTotal = Number(counts.value.credentialingAlertTotal ?? 0);
        const privilegePending = (lists.value.operationsPrivilegeQueue ?? []).length;
        const activeStaff = numberValue(counts.value.staffProfiles, 'active');

        return {
            title: 'HR & quality handoff',
            note: 'Staff credentialing and privileging',
            blockerTitle:
                alertTotal > 0
                    ? 'Credentialing alerts open'
                    : privilegePending > 0
                      ? 'Privilege reviews pending'
                      : 'No critical operations blockers',
            blockerNote:
                alertTotal > 0
                    ? 'Profiles need credentialing follow-up before privileging or activation.'
                    : privilegePending > 0
                      ? 'Privilege grants are waiting for reviewer or approver action.'
                      : 'Staff compliance queues look stable for the next shift.',
            nextAction:
                alertTotal > 0
                    ? 'Start with credentialing alerts sorted by regulatory risk.'
                    : privilegePending > 0
                      ? 'Review requested and under-review privilege grants next.'
                      : 'Spot-check active staff profiles and upcoming expiries.',
            primaryAction: {
                label: alertTotal > 0 ? 'Open credentialing' : 'Open privileges',
                href: alertTotal > 0 ? '/staff-credentialing' : '/staff-privileges',
            },
            secondaryAction: { label: 'Staff directory', href: '/staff' },
            chips: [
                { label: 'Alerts', value: alertTotal },
                { label: 'Privilege queue', value: privilegePending },
                { label: 'Active staff', value: activeStaff },
            ],
        };
    }
"""
text = text.replace(ops_h, "")

text = text.replace(
    "const handoff = computed(() => {",
    "const handoff = computed(() => {\n    const surface = activeWorkflowSurface.value;\n    if (surface?.handoff) {\n        return surface.handoff;\n    }\n",
    1,
)

text = text.replace(
    "const watchItems = computed(() => {",
    "const watchItems = computed(() => {\n    const surface = activeWorkflowSurface.value;\n    if (surface?.watchItems.length) {\n        return surface.watchItems;\n    }\n",
    1,
)

# Remove unused imports if mappers only used in extracted blocks
# Keep mapCredentialingAlertToQueueRow etc - may still be unused; build will tell us

path.write_text(encoding="utf-8", data=text)
print("patched", path)

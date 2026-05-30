from pathlib import Path
import re

path = Path(__file__).resolve().parents[1] / "resources/js/pages/Dashboard.vue"
text = path.read_text(encoding="utf-8")

if "dashboardSurfaceRuntime" not in text:
    insert_after = """const activeWorkflowSurface = computed(() =>
    buildWorkflowSurface(
        activePresetKey.value,
        counts.value,
        lists.value,
        { numberValue, metric },
        activeWorkflowWidgets.value,
        dashboardSurfaceRuntime.value,
    ),
);
"""
    runtime_block = """const dashboardSurfaceRuntime = computed(() => ({
    today,
    nowTick: nowTick.value,
    clinicianClinicalDepartment: clinicianClinicalDepartment.value,
    vitalsOverdueCount: vitalsOverdueCount.value,
    mciModeActive: mciModeActive.value,
    directServiceModules: directServiceModules.value,
    singleDirectServiceModule: singleDirectServiceModule.value,
    primaryDirectServiceModule: primaryDirectServiceModule.value,
    auditExportHealth: auditExportHealth.value,
    scopeData: scopeData.value,
    TRIAGE_P_ORDER,
    formatDateTime,
    formatMoney,
    formatEnumLabel,
    clinicianQueueHref,
    departmentQueueHref,
    activeConsultationWorkspaceHref,
    directServiceModuleHref,
    dashboardPatientLabel,
    appointmentTriageCategory,
    appointmentQueueSearchHaystack,
    mapDirectServiceOrdersToQueueRows,
    openResourcesTab: () => {
        activeTab.value = 'resources';
    },
}));

"""
    text = text.replace(
        insert_after,
        runtime_block
        + """const activeWorkflowSurface = computed(() =>
    buildWorkflowSurface(
        activePresetKey.value,
        counts.value,
        lists.value,
        { numberValue, metric },
        activeWorkflowWidgets.value,
        dashboardSurfaceRuntime.value,
    ),
);
""",
    )

COMPUTED_REPLACEMENTS = {
    "kpis": "const kpis = computed(() => activeWorkflowSurface.value?.kpis ?? []);",
    "actions": "const actions = computed(() => activeWorkflowSurface.value?.actions ?? []);",
    "queueRows": "const queueRows = computed<QueueRow[]>(() => activeWorkflowSurface.value?.queueRows ?? []);",
    "handoff": "const handoff = computed(() => activeWorkflowSurface.value?.handoff ?? {\n"
    "    title: 'Dashboard handoff',\n"
    "    note: 'Workflow context',\n"
    "    blockerTitle: 'Loading',\n"
    "    blockerNote: 'Refresh the dashboard to load workflow context.',\n"
    "    nextAction: 'Refresh the dashboard.',\n"
    "    primaryAction: { label: 'Refresh', href: '/dashboard' },\n"
    "    secondaryAction: { label: 'Open resources', href: '/dashboard#dashboard-resources' },\n"
    "    chips: [],\n"
    "});",
    "watchItems": "const watchItems = computed(() => activeWorkflowSurface.value?.watchItems ?? []);",
    "queueTitle": "const queueTitle = computed(() => activeWorkflowSurface.value?.queueTitle ?? 'Workflow queue');",
    "queueDescription": "const queueDescription = computed(() => activeWorkflowSurface.value?.queueDescription ?? '');",
    "dashboardSearchPlaceholder": "const dashboardSearchPlaceholder = computed(\n    () => activeWorkflowSurface.value?.searchPlaceholder ?? 'Patient name, MRN, phone, or appointment #',\n);",
}

for name, replacement in COMPUTED_REPLACEMENTS.items():
    pattern = rf"const {name} = computed(?:<[^>]+>)?\(\(\) => \{{"
    match = re.search(pattern, text)
    if not match:
        raise SystemExit(f"Could not find computed {name}")
    start = match.start()
    depth = 0
    index = match.end() - 1
    while index < len(text):
        if text[index] == "{":
            depth += 1
        elif text[index] == "}":
            depth -= 1
            if depth == 0:
                end = index + 1
                if text[end : end + 2] == ");":
                    end += 2
                elif text[end] == ")":
                    end += 1
                text = text[:start] + replacement + text[end:]
                break
        index += 1

path.write_text(encoding="utf-8", data=text)
print("patched", path)

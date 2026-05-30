from pathlib import Path

path = Path(__file__).resolve().parents[1] / "resources/js/pages/Dashboard.vue"
text = path.read_text(encoding="utf-8")

ops_import = "import { mapCredentialingAlertToQueueRow, mapPrivilegeGrantToQueueRow } from '@/lib/dashboardOperationsQueue';"
ops_import_new = (
    "import { buildOperationsPrivilegeQueueRows, mapCredentialingAlertToQueueRow, mapPrivilegeGrantToQueueRow } "
    "from '@/lib/dashboardOperationsQueue';\n"
    "import { mapMedicalRecordToQueueRow } from '@/lib/dashboardRecordsQueue';\n"
    "import { mapProcurementRequestToQueueRow } from '@/lib/dashboardSupplyQueue';\n"
    "import { appendWorkflowBatchEntries } from '@/workflows/appendWorkflowBatch';"
)
if "appendWorkflowBatchEntries" not in text:
    text = text.replace(ops_import, ops_import_new)
elif "buildOperationsPrivilegeQueueRows" not in text:
    text = text.replace(ops_import, ops_import_new.split("\n")[0] + ";")

start = text.find("const PRIVILEGE_QUEUE_STATUSES")
end = text.find("async function loadDashboard(depth = 0)")
if start != -1 and end != -1:
    text = text[:start] + text[end:]

switch_start = text.find("    switch (preset) {")
switch_end = text.find("    if (preset === 'admin' || sharedOpsTelemetryLoaded.value)")
if switch_start == -1 or switch_end == -1:
    raise SystemExit("switch markers not found")

replacement = """    appendWorkflowBatchEntries(preset, batch, {
        guardedRequest,
        apiGet,
        currentUserId: currentUserId.value,
    });

"""
text = text[:switch_start] + replacement + text[switch_end:]

text = text.replace(
    "        theatreProcedures: [],\n    };",
    "        theatreProcedures: [],\n        draftMedicalRecords: [],\n        procurementRequests: [],\n    };",
)

needle = "        theatreProcedures: Array.isArray(bag.theatreProcedures?.data) ? bag.theatreProcedures.data : [],\n    };"
if needle in text:
    text = text.replace(
        needle,
        """        theatreProcedures: Array.isArray(bag.theatreProcedures?.data) ? bag.theatreProcedures.data : [],
        draftMedicalRecords: Array.isArray(bag.draftMedicalRecords?.data) ? bag.draftMedicalRecords.data : [],
        procurementRequests: Array.isArray(bag.procurementRequests?.data) ? bag.procurementRequests.data : [],
    };""",
    )

queue_old = """    if (activePresetKey.value === 'records' || activePresetKey.value === 'supply') {
        return [];
    }"""
queue_new = """    if (activePresetKey.value === 'records') {
        return (lists.value.draftMedicalRecords ?? [])
            .slice(0, 8)
            .map((item: Record<string, unknown>) => mapMedicalRecordToQueueRow(item));
    }
    if (activePresetKey.value === 'supply') {
        return (lists.value.procurementRequests ?? [])
            .slice(0, 8)
            .map((item: Record<string, unknown>) => mapProcurementRequestToQueueRow(item));
    }"""
if queue_old in text:
    text = text.replace(queue_old, queue_new)

path.write_text(encoding="utf-8", data=text)
print("patched", path)

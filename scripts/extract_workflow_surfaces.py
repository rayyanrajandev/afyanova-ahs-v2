from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DASHBOARD = ROOT / "resources/js/pages/Dashboard.vue"

WORKFLOW_KEYS = [
    "front_desk",
    "clinician",
    "direct_service",
    "nursing",
    "emergency",
    "cashier",
    "theatre",
]

REPLACEMENTS = [
    (r"\bcounts\.value\b", "counts"),
    (r"\blists\.value\b", "lists"),
    (r"\bmetric\(", "helpers.metric("),
    (r"\bnumberValue\(", "helpers.numberValue("),
    (r"\$\{today\}", "${runtime.today}"),
    (r"\bnowTick\.value\b", "runtime.nowTick"),
    (r"\bclinicianClinicalDepartment\.value\b", "runtime.clinicianClinicalDepartment"),
    (r"\bvitalsOverdueCount\.value\b", "runtime.vitalsOverdueCount"),
    (r"\bmciModeActive\.value\b", "runtime.mciModeActive"),
    (r"\bdirectServiceModules\.value\b", "runtime.directServiceModules"),
    (r"\bsingleDirectServiceModule\.value\b", "runtime.singleDirectServiceModule"),
    (r"\bprimaryDirectServiceModule\.value\b", "runtime.primaryDirectServiceModule"),
    (r"\bauditExportHealth\.value\b", "runtime.auditExportHealth"),
    (r"\bscopeData\.value\b", "runtime.scopeData"),
    (r"\bclinicianQueueHref\(", "runtime.clinicianQueueHref("),
    (r"\bdepartmentQueueHref\(", "runtime.departmentQueueHref("),
    (r"\bactiveConsultationWorkspaceHref\(", "runtime.activeConsultationWorkspaceHref("),
    (r"\bdirectServiceModuleHref\(", "runtime.directServiceModuleHref("),
    (r"\bdashboardPatientLabel\(", "runtime.dashboardPatientLabel("),
    (r"\bappointmentTriageCategory\(", "runtime.appointmentTriageCategory("),
    (r"\bappointmentQueueSearchHaystack\(", "runtime.appointmentQueueSearchHaystack("),
    (r"\bmapDirectServiceOrdersToQueueRows\(", "runtime.mapDirectServiceOrdersToQueueRows("),
    (r"\bformatDateTime\(", "runtime.formatDateTime("),
    (r"\bformatMoney\(", "runtime.formatMoney("),
    (r"\bformatEnumLabel\(", "runtime.formatEnumLabel("),
    (r"\bTRIAGE_P_ORDER\b", "runtime.TRIAGE_P_ORDER"),
    (r"void dashboardPatientDirectory\.value;", ""),
    (r" as AppIconName", ""),
    (r" as 'default' \| 'outline'", ""),
]

HEADER = """import type {{ DashboardQueueRow }} from '@/lib/dashboardOperationsQueue';
import type {{ WorkflowSurface, WorkflowSurfaceBuilder }} from '@/workflows/surfaceTypes';

export const build{export_name}Surface: WorkflowSurfaceBuilder = ({{ counts, lists, helpers, runtime, hasWidget }}) => {{
"""

ADMIN_HEADER = """import { formatEnumLabel } from '@/lib/labels';
import type { DashboardQueueRow } from '@/lib/dashboardOperationsQueue';
import type { WorkflowSurface, WorkflowSurfaceBuilder } from '@/workflows/surfaceTypes';

export const buildAdminSurface: WorkflowSurfaceBuilder = ({ counts, lists, helpers, runtime }) => {
    const { numberValue, metric } = helpers;
"""

FOOTER = """
    return {
        kpis,
        actions,
        queueRows,
        handoff,
        watchItems,
        queueTitle,
        queueDescription,
        searchPlaceholder,
    };
};
"""


def export_name(key: str) -> str:
    return "".join(part.capitalize() for part in key.split("_"))


def transform(body: str) -> str:
    for pattern, repl in REPLACEMENTS:
        body = re.sub(pattern, repl, body)
    return body


def extract_if_block(source: str, key: str) -> str | None:
    pattern = rf"    if \(activePresetKey\.value === '{key}'\) \{{"
    match = re.search(pattern, source)
    if not match:
        return None

    start = match.end()
    depth = 1
    index = start
    while index < len(source) and depth > 0:
        if source[index : index + 1] == "{":
            depth += 1
        elif source[index : index + 1] == "}":
            depth -= 1
        index += 1

    return source[start : index - 1].strip()


def extract_return_block(source: str, is_final: bool = False) -> str | None:
    if is_final:
        marker = "    return ["
        start = source.rfind(marker)
        if start == -1:
            marker = "    return ("
            start = source.rfind(marker)
        if start == -1:
            return None
        return source[start:].strip().rstrip("});").strip()

    return None


def extract_scalar_return(source: str, key: str) -> str | None:
    pattern = rf"    if \(activePresetKey\.value === '{key}'\) return '([^']+)';"
    match = re.search(pattern, source)
    if match:
        return f"return '{match.group(1)}';"

    pattern_block = rf"    if \(activePresetKey\.value === '{key}'\) \{{\n        return ([^;]+);\n    \}}"
    match = re.search(pattern_block, source, re.S)
    if match:
        return f"return {match.group(1).strip()};"

    return None


def read_computed(source: str, name: str) -> str:
    pattern = rf"const {name} = computed(?:<[^>]+>)?\(\(\) => \{{"
    match = re.search(pattern, source)
    if not match:
        raise SystemExit(f"computed {name} not found")
    start = match.end()
    depth = 1
    index = start
    while index < len(source) and depth > 0:
        if source[index : index + 1] == "{":
            depth += 1
        elif source[index : index + 1] == "}":
            depth -= 1
        index += 1
    return source[start : index - 1]


def build_surface_file(key: str, dashboard: str) -> str:
    kpis_src = read_computed(dashboard, "kpis")
    actions_src = read_computed(dashboard, "actions")
    queue_src = read_computed(dashboard, "queueRows")
    handoff_src = read_computed(dashboard, "handoff")
    watch_src = read_computed(dashboard, "watchItems")
    title_src = read_computed(dashboard, "queueTitle")
    desc_src = read_computed(dashboard, "queueDescription")
    search_src = read_computed(dashboard, "dashboardSearchPlaceholder")

    kpis_body = extract_if_block(kpis_src, key)
    actions_body = extract_if_block(actions_src, key)
    queue_body = extract_if_block(queue_src, key)
    handoff_body = extract_if_block(handoff_src, key)
    watch_body = extract_if_block(watch_src, key)

    title_body = extract_scalar_return(title_src, key)
    desc_body = extract_scalar_return(desc_src, key)

    if not title_body:
        block = extract_if_block(title_src, key)
        if block:
            title_body = f"return {block.strip()};" if not block.strip().startswith("return") else block.strip()
    if not desc_body:
        block = extract_if_block(desc_src, key)
        if block:
            desc_body = f"return {block.strip()};" if not block.strip().startswith("return") else block.strip()

    search_default = "'Patient name, MRN, phone, or appointment #'"
    if key == "direct_service":
        search_body = "return 'Patient name, MRN, phone, order #, or status';"
    else:
        search_body = search_default
        if key in ("operations", "records", "supply"):
            search_body = None

    if not all([kpis_body, actions_body, queue_body]):
        missing = [name for name, body in [
            ("kpis", kpis_body), ("actions", actions_body), ("queueRows", queue_body),
        ] if not body]
        raise SystemExit(f"{key}: missing sections {missing}")

    if not handoff_body:
        handoff_body = "return buildDefaultHandoff();"
    if not watch_body:
        watch_body = "return [];"

    title_body = title_body or "return 'Workflow queue';"
    desc_body = desc_body or "return 'Workflow queue preview.';"

    parts = [
        HEADER.format(export_name=export_name(key)),
        "    const kpis = (() => {",
        transform(kpis_body),
        "    })();",
        "",
        "    const actions = (() => {",
        transform(actions_body),
        "    })();",
        "",
        "    const queueRows: DashboardQueueRow[] = (() => {",
        transform(queue_body),
        "    })();",
        "",
        "    const handoff = (() => {",
        transform(handoff_body),
        "    })();",
        "",
        "    const watchItems = (() => {",
        transform(watch_body),
        "    })();",
        "",
        f"    const queueTitle = (() => {{ {transform(title_body)} }})();",
        f"    const queueDescription = (() => {{ {transform(desc_body)} }})();",
    ]

    if search_body:
        parts.append(f"    const searchPlaceholder = (() => {{ {transform(search_body)} }})();")
    else:
        parts.append("    const searchPlaceholder = 'Patient name, MRN, phone, or appointment #';")

    parts.append(FOOTER)
    return "\n".join(parts)


def build_admin_surface(dashboard: str) -> str:
    kpis_src = read_computed(dashboard, "kpis")
    actions_src = read_computed(dashboard, "actions")
    queue_src = read_computed(dashboard, "queueRows")
    handoff_src = read_computed(dashboard, "handoff")
    watch_src = read_computed(dashboard, "watchItems")

    kpis_body = kpis_src[kpis_src.rfind("    return [") :].strip().rstrip("});").strip()
    actions_body = actions_src[actions_src.rfind("    return [") :].strip().rstrip("});").strip()
    queue_body = queue_src[queue_src.rfind("    return (") :].strip().rstrip("});").strip()
    handoff_body = handoff_src[handoff_src.rfind("    const recentExportFailures") : handoff_src.rfind("};") + 2]
    watch_body = watch_src[watch_src.rfind("    return [") :].strip().rstrip("});").strip()

    return "\n".join([
        ADMIN_HEADER,
        "    const kpis = " + transform(kpis_body) + ";",
        "",
        "    const actions = " + transform(actions_body.replace(
            "onClick: () => { activeTab.value = 'resources'; }",
            "onClick: () => { runtime.openResourcesTab?.(); }",
        )) + ";",
        "",
        "    const queueRows: DashboardQueueRow[] = " + transform(queue_body) + ";",
        "",
        "    const handoff = " + transform(handoff_body) + ";",
        "",
        "    const watchItems = " + transform(watch_body) + ";",
        "",
        "    const queueTitle = 'Recent export failures';",
        "    const queueDescription = 'Failures and backlog signals from audit export health.';",
        "    const searchPlaceholder = 'Patient name, MRN, phone, or appointment #';",
        FOOTER,
    ])


def main() -> None:
    dashboard = DASHBOARD.read_text(encoding="utf-8")

    for key in WORKFLOW_KEYS:
        content = build_surface_file(key, dashboard)
        out = ROOT / f"resources/js/workflows/{key}/surface.ts"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(content, encoding="utf-8")
        print("wrote", out)

    admin_out = ROOT / "resources/js/workflows/admin/surface.ts"
    admin_out.parent.mkdir(parents=True, exist_ok=True)
    admin_out.write_text(build_admin_surface(dashboard), encoding="utf-8")
    print("wrote", admin_out)


if __name__ == "__main__":
    main()

import type { DashboardQueueRow } from '@/lib/dashboardOperationsQueue';
import type { WorkflowSurface, WorkflowSurfaceBuilder } from '@/workflows/surfaceTypes';

export const buildEmergencySurface: WorkflowSurfaceBuilder = ({ counts, lists, helpers, runtime, hasWidget }) => {

    const kpis = (() => {
const triageRows = lists.checkedInAppointments ?? [];
        const now = runtime.nowTick;
        const avgWaitMins = (() => {
            if (triageRows.length === 0) return 0;
            const total = triageRows.reduce((acc: number, item: any) => {
                const t = item.checkedInAt ?? item.scheduledAt;
                return t ? acc + Math.max(0, now - new Date(t).getTime()) : acc;
            }, 0);
            return Math.floor(total / triageRows.length / 60_000);
        })();
        const longestWaitMins = (() => {
            if (triageRows.length === 0) return 0;
            // rows are sorted by checkedInAt asc — first row = longest wait
            const earliest = triageRows[0];
            const t = earliest?.checkedInAt ?? earliest?.scheduledAt;
            return t ? Math.max(0, Math.floor((now - new Date(t).getTime()) / 60_000)) : 0;
        })();
        return [
            helpers.metric('Awaiting triage', 'Checked-in patients not yet assessed by clinical staff.', 'heart-pulse', helpers.numberValue(counts.appointments, 'checked_in')),
            helpers.metric('Avg triage wait', 'Average time since check-in across all patients currently in the triage queue.', 'calendar-clock', avgWaitMins, 'm'),
            helpers.metric('Longest wait', 'Time since the earliest unassessed patient checked in. Exceeds 30 min = critical.', 'alert-triangle', longestWaitMins, 'm'),
            helpers.metric('In treatment', 'Emergency triage cases currently in active treatment.', 'stethoscope', helpers.numberValue(counts.emergencyTriageCases, 'in_treatment')),
        ];
    })();

    const actions = (() => {
return [
            { label: 'Register emergency walk-in', icon: 'calendar-plus-2', variant: 'default', href: `/appointments?open=schedule&type=walkin&view=queue&from=${runtime.today}` },
            { label: 'Triage queue', icon: 'heart-pulse', variant: 'outline', href: runtime.triageQueueHref() },
            { label: 'Admit patient', icon: 'bed-double', variant: 'outline', href: '/admissions' },
        ];
    })();

    const queueRows: DashboardQueueRow[] = (() => {
const now = runtime.nowTick;
        const sortByArrival = (a: any, b: any) => {
            const ta = a.checkedInAt ?? a.scheduledAt;
            const tb = b.checkedInAt ?? b.scheduledAt;
            if (!ta && !tb) return 0;
            if (!ta) return 1;
            if (!tb) return -1;
            return new Date(ta).getTime() - new Date(tb).getTime();
        };
        return [...(lists.checkedInAppointments ?? [])]
            .sort(sortByArrival)
            .slice(0, 10)
            .map((item: any) => {
            const arrivalTime = item.checkedInAt ?? item.scheduledAt;
            const waitMs = arrivalTime ? now - new Date(arrivalTime).getTime() : 0;
            const waitMins = Math.max(0, Math.floor(waitMs / 60_000));
            const isOverdue = waitMins >= 30;
            const cat = runtime.appointmentTriageCategory(item);
            const typeLabel = item.appointmentType === 'walk_in' ? 'Walk-in' : null;
            const subtitleParts = [item.department, item.reason].filter(Boolean);
            if (typeLabel) subtitleParts.unshift(typeLabel);
            return {
                id: String(item.id ?? item.appointmentNumber ?? Math.random()),
                title: String(item.appointmentNumber ?? 'Walk-in / arrival'),
                subtitle: subtitleParts.join(' | ') || 'Awaiting triage assessment.',
                meta: arrivalTime ? `Waiting ${waitMins}m${cat ? ` · ${cat}` : ''}` : (cat ? cat : 'Wait time unknown'),
                status: runtime.formatEnumLabel(String(item.status ?? 'checked_in')),
                href: runtime.triageQueueHref(String(item.id ?? '')),
                actionLabel: 'Open triage',
                isOverdue,
                triageCategory: cat,
                searchHaystack: runtime.appointmentQueueSearchHaystack(item),
            };
        })
        .sort((a, b) => {
            const pa = runtime.TRIAGE_P_ORDER[a.triageCategory ?? ''] ?? 5;
            const pb = runtime.TRIAGE_P_ORDER[b.triageCategory ?? ''] ?? 5;
            if (pa !== pb) return pa - pb;
            // same category: overdue patients first
            if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
            return 0;
        });
    })();

    const handoff = (() => {
const waitingTriage = helpers.numberValue(counts.appointments, 'checked_in');
        const activeAdmissions = helpers.numberValue(counts.admissions, 'admitted');
        const inTreatment = helpers.numberValue(counts.emergencyTriageCases, 'in_treatment');
        const statLab = helpers.numberValue(counts.laboratory, ['ordered', 'collected', 'in_progress']);
        const registeredBeds = helpers.numberValue(counts.wardBeds, 'active');
        const hasWaiting = Number(waitingTriage ?? 0) > 0;
        const hasLab = Number(statLab ?? 0) > 0;

        return {
            title: 'Emergency handoff',
            note: 'Triage and emergency care flow',
            blockerTitle: hasWaiting
                ? `${(waitingTriage ?? 0).toLocaleString()} patient${Number(waitingTriage) === 1 ? '' : 's'} awaiting triage`
                : hasLab
                    ? 'Pending stat lab orders need follow-up'
                    : 'No critical emergency blockers',
            blockerNote: hasWaiting
                ? 'Patients have checked in and are waiting for initial clinical assessment. Prioritise longest-wait patients.'
                : hasLab
                    ? 'Stat laboratory orders are pending results — treatment decisions may be blocked.'
                    : 'Triage queue is clear and admission load looks stable.',
            nextAction: hasWaiting
                ? 'Open the triage queue sorted by wait time and begin assessments from the top.'
                : 'Review current admissions for discharge or escalation decisions.',
            primaryAction: {
                label: hasWaiting ? 'Open triage queue' : 'Open admissions',
                href: hasWaiting ? runtime.triageQueueHref() : '/admissions?view=queue',
            },
            secondaryAction: { label: 'Register emergency walk-in', href: `/appointments?open=schedule&type=walkin&view=queue&from=${runtime.today}` },
            chips: [
                { label: 'Awaiting triage', value: waitingTriage },
                { label: 'In treatment', value: inTreatment },
                { label: 'Admitted', value: activeAdmissions },
                ...(registeredBeds !== null ? [{ label: 'Reg. beds', value: registeredBeds }] : []),
            ],
        };
    })();

    const watchItems = (() => {
return [
            {
                label: 'Triage queue',
                note: 'Patients checked in and waiting for initial clinical assessment.',
                value: helpers.numberValue(counts.appointments, 'checked_in'),
                href: runtime.triageQueueHref(),
                actionLabel: 'Open triage queue',
                icon: 'heart-pulse',
            },
            {
                label: 'P1 — Resuscitation',
                note: 'Immediately life-threatening patients in triage. Requires instantaneous response.',
                value: (counts.appointments?.triage_categories as any)?.P1 ?? 0,
                href: runtime.triageQueueHref(undefined, 'P1'),
                actionLabel: 'View P1 patients',
                icon: 'alert-triangle',
            },
            {
                label: 'P2 — Emergent',
                note: 'Very urgent patients. Clinical assessment target: within 10 minutes of check-in.',
                value: (counts.appointments?.triage_categories as any)?.P2 ?? 0,
                href: runtime.triageQueueHref(undefined, 'P2'),
                actionLabel: 'View P2 patients',
                icon: 'activity',
            },
            {
                label: 'Active admissions',
                note: 'Current inpatient census from emergency and ward intake.',
                value: helpers.numberValue(counts.admissions, 'admitted'),
                href: '/admissions?view=queue',
                actionLabel: 'Open admissions',
                icon: 'bed-double',
            },
            {
                label: 'In treatment',
                note: 'Emergency triage cases currently under active clinical treatment.',
                value: helpers.numberValue(counts.emergencyTriageCases, 'in_treatment'),
                href: '/emergency-triage-cases',
                actionLabel: 'Open emergency cases',
                icon: 'stethoscope',
            },
            {
                label: 'Stat lab orders',
                note: 'Laboratory orders still pending collection, processing, or results.',
                value: helpers.numberValue(counts.laboratory, ['ordered', 'collected', 'in_progress']),
                href: '/laboratory-orders',
                actionLabel: 'Open laboratory',
                icon: 'flask-conical',
            },
            {
                label: 'Pending medication orders',
                note: 'Pharmacy orders waiting preparation or dispense for emergency patients.',
                value: helpers.numberValue(counts.pharmacy, ['pending', 'in_preparation', 'partially_dispensed']),
                href: '/pharmacy-orders',
                actionLabel: 'Open pharmacy',
                icon: 'pill',
            },
            {
                label: 'Registered beds',
                note: 'Active ward beds registered in scope. Compared against admitted census to gauge capacity pressure.',
                value: helpers.numberValue(counts.wardBeds, 'active'),
                href: '/platform/admin/ward-beds',
                actionLabel: 'Open bed registry',
                icon: 'bed-double',
            },
            ...(runtime.mciModeActive ? [{
                label: 'MCI mode active',
                note: 'Mass Casualty Incident protocols are active. Surge triage workflows apply — coordinate with the incident commander.',
                value: null,
                href: '#',
                actionLabel: 'Incident active',
                icon: 'alert-triangle',
            }] : []),
        ];
    })();

    const queueTitle = (() => { return 'Emergency triage queue'; })();
    const queueDescription = (() => { return 'All checked-in patients sorted by arrival time — longest wait shown first. Rows overdue at 30 min.'; })();
    const searchPlaceholder = 'Patient name, MRN, phone, or appointment #';

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

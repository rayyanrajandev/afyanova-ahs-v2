import {
    mapCredentialingAlertToQueueRow,
    mapPrivilegeGrantToQueueRow,
} from '@/lib/dashboardOperationsQueue';
import type { WorkflowSurface, WorkflowSurfaceBuilder } from '@/workflows/surfaceTypes';

export const buildOperationsSurface: WorkflowSurfaceBuilder = ({ counts, lists, helpers, hasWidget }) => {
    const { numberValue, metric } = helpers;
    const privilegePending = Array.isArray(lists.operationsPrivilegeQueue) ? lists.operationsPrivilegeQueue.length : 0;
    const alertTotal = Number(counts.credentialingAlertTotal ?? 0);

    const kpis = [
        hasWidget('staff')
            ? metric(
                  'Active staff',
                  'Staff profiles currently active in facility scope.',
                  'users',
                  numberValue(counts.staffProfiles, 'active'),
              )
            : null,
        hasWidget('credentialing')
            ? metric(
                  'Credentialing alerts',
                  'Profiles with blocked, pending, or watch credentialing states.',
                  'shield-check',
                  alertTotal,
              )
            : null,
        hasWidget('privileges')
            ? metric(
                  'Privilege reviews',
                  'Requested or under-review privilege grants on the coverage board.',
                  'shield-check',
                  privilegePending,
              )
            : null,
        hasWidget('staff')
            ? metric(
                  'Inactive staff',
                  'Profiles inactive or suspended and needing HR follow-up.',
                  'user-x',
                  numberValue(counts.staffProfiles, 'inactive'),
              )
            : null,
    ].filter((entry): entry is NonNullable<typeof entry> => entry !== null);

    const alertRows = hasWidget('credentialing')
        ? (Array.isArray(lists.operationsCredentialingAlerts) ? lists.operationsCredentialingAlerts : []).map(
              (item: Record<string, unknown>) => mapCredentialingAlertToQueueRow(item),
          )
        : [];
    const privilegeRows = hasWidget('privileges')
        ? (Array.isArray(lists.operationsPrivilegeQueue) ? lists.operationsPrivilegeQueue : []).map(
              (entry: Record<string, unknown>) =>
                  mapPrivilegeGrantToQueueRow(
                      (entry.privilege ?? {}) as Record<string, unknown>,
                      (entry.staff ?? {}) as Record<string, unknown>,
                  ),
          )
        : [];

    return {
        kpis,
        actions: [
            { label: 'Staff directory', icon: 'users', variant: 'default', href: '/staff' },
            { label: 'Credentialing', icon: 'shield-check', variant: 'outline', href: '/staff-credentialing' },
            { label: 'Privileges', icon: 'shield-check', variant: 'outline', href: '/staff-privileges' },
        ],
        queueRows: [...alertRows, ...privilegeRows].slice(0, 10),
        handoff: {
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
                { label: 'Active staff', value: numberValue(counts.staffProfiles, 'active') },
            ],
        },
        watchItems: [
            {
                label: 'Credentialing alerts',
                note: 'Profiles blocked or pending credentialing review.',
                value: alertTotal,
                href: '/staff-credentialing',
                actionLabel: 'Open credentialing',
                icon: 'shield-check',
            },
            {
                label: 'Privilege reviews pending',
                note: 'Requested or under-review grants on the coverage board.',
                value: privilegePending,
                href: '/staff-privileges',
                actionLabel: 'Open privileges',
                icon: 'shield-check',
            },
            {
                label: 'Inactive staff profiles',
                note: 'Profiles needing HR reactivation or offboarding follow-up.',
                value: numberValue(counts.staffProfiles, 'inactive'),
                href: '/staff?status=inactive',
                actionLabel: 'Open staff directory',
                icon: 'user-x',
            },
        ],
        queueTitle: 'Credentialing & privileging queue',
        queueDescription:
            'Credentialing alerts and privilege grants that need HR or quality review before clinical activation.',
        searchPlaceholder: 'Staff name, employee #, department, or alert type',
    };
};

import { computed, type ComputedRef, type Ref } from 'vue';
import type { StaffGovernanceSetupStep } from '@/components/staff/StaffGovernanceSetupChecklist.vue';

type StaffProfileLike = {
    id: string;
    userId: number | null;
    userName: string | null;
    userEmail?: string | null;
    userEmailVerifiedAt?: string | null;
    jobTitle?: string | null;
    department?: string | null;
} | null;

type CredentialingSummaryLike = {
    credentialingState: string | null;
    blockingReasons: string[];
    registrationSummary: {
        total: number;
        verified: number;
        pendingVerification: number;
    };
} | null;

type PrivilegeSummaryLike = {
    total: number;
    active: number;
} | null;

function credentialingNotApplicable(state: string | null | undefined): boolean {
    return String(state ?? '').trim().toLowerCase() === 'not_required';
}

export function credentialingStateFriendlyLabel(
    state: string | null | undefined,
    blockingReasons: string[] = [],
): string {
    const normalized = String(state ?? '').trim().toLowerCase();
    if (normalized === 'not_required') return 'Not applicable';
    if (normalized === 'pending_verification') return 'Pending verification';
    if (normalized === 'ready') return 'Ready';
    if (normalized === 'watch') return 'Ready (expiry watch)';
    if (normalized === 'blocked') {
        const severe = blockingReasons.some((reason) =>
            /restricted|withdrawn|revoked|suspended/i.test(String(reason ?? '')),
        );
        return severe ? 'Blocked' : 'Setup incomplete';
    }

    return String(state ?? 'Unknown')
        .replace(/[_-]+/g, ' ')
        .trim()
        .replace(/\b\w/g, (match) => match.toUpperCase()) || 'Unknown';
}

export function credentialingStateFriendlyVariant(
    state: string | null | undefined,
    blockingReasons: string[] = [],
): 'outline' | 'secondary' | 'destructive' {
    const normalized = String(state ?? '').trim().toLowerCase();
    if (normalized === 'ready' || normalized === 'watch') return 'secondary';
    if (normalized === 'blocked') {
        const severe = blockingReasons.some((reason) =>
            /restricted|withdrawn|revoked|suspended/i.test(String(reason ?? '')),
        );
        return severe ? 'destructive' : 'outline';
    }
    return 'outline';
}

export function buildStaffGovernanceSetupSteps(input: {
    staff: StaffProfileLike;
    summary: CredentialingSummaryLike;
    hasRegulatoryProfile: boolean;
    registrationCount: number;
    emailBlockerMessage: string | null;
    privilegeSummary?: PrivilegeSummaryLike;
    includePrivilegingStep?: boolean;
}): StaffGovernanceSetupStep[] {
    const staff = input.staff;
    if (!staff) return [];

    const steps: StaffGovernanceSetupStep[] = [];
    const notRequired = credentialingNotApplicable(input.summary?.credentialingState);
    const hasLinkedUser = Boolean(staff.userId);
    const emailVerified = hasLinkedUser && Boolean(staff.userEmailVerifiedAt);

    steps.push({
        id: 'linked_user',
        label: 'Link platform user account',
        detail: hasLinkedUser
            ? `Linked to ${staff.userName?.trim() || 'platform user'}.`
            : 'In Staff Directory, link this profile to the user you created.',
        status: hasLinkedUser ? 'complete' : 'current',
    });

    steps.push({
        id: 'email_verified',
        label: 'Verify user email',
        detail: emailVerified
            ? 'User completed the invite or password setup flow.'
            : input.emailBlockerMessage
              || 'Ask the user to accept their invite email before editing clinical governance records.',
        status: !hasLinkedUser ? 'upcoming' : emailVerified ? 'complete' : 'current',
    });

    if (notRequired) {
        steps.push({
            id: 'clinical_na',
            label: 'Clinical credentialing & privileging',
            detail: `Role "${[staff.jobTitle, staff.department].filter(Boolean).join(' · ') || 'current placement'}" is treated as non-clinical. No council registration or privileges are required unless the role changes.`,
            status: 'skipped',
        });
        return steps;
    }

    const hasRegulatory = input.hasRegulatoryProfile;
    steps.push({
        id: 'regulatory',
        label: 'Regulatory profile',
        detail: hasRegulatory
            ? 'Regulator, cadre, practice authority, and good standing are recorded.'
            : 'Open Regulatory Profile and record council / cadre details.',
        status: !emailVerified ? 'upcoming' : hasRegulatory ? 'complete' : 'current',
    });

    const regTotal = input.summary?.registrationSummary.total ?? input.registrationCount;
    steps.push({
        id: 'registration',
        label: 'Professional registration',
        detail:
            regTotal > 0
                ? `${regTotal} registration record${regTotal === 1 ? '' : 's'} on file.`
                : 'Add council license or registration evidence under Registrations.',
        status: !hasRegulatory ? 'upcoming' : regTotal > 0 ? 'complete' : 'current',
    });

    const verified = input.summary?.registrationSummary.verified ?? 0;
    const pending = input.summary?.registrationSummary.pendingVerification ?? 0;
    steps.push({
        id: 'verification',
        label: 'Verify registration',
        detail:
            verified > 0
                ? 'At least one registration is verified.'
                : pending > 0
                  ? `${pending} registration${pending === 1 ? '' : 's'} awaiting verification.`
                  : 'Credentialing staff must verify the registration before privileging.',
        status: regTotal === 0 ? 'upcoming' : verified > 0 ? 'complete' : 'current',
    });

    const state = String(input.summary?.credentialingState ?? '').trim().toLowerCase();
    steps.push({
        id: 'credentialing_ready',
        label: 'Credentialing ready',
        detail:
            state === 'ready' || state === 'watch'
                ? 'Clinical credentialing is complete. Continue to privileging when needed.'
                : input.summary?.blockingReasons.find((value) => value?.trim())
                  || 'Complete the steps above. "Setup incomplete" is normal for newly linked clinical staff.',
        status:
            state === 'ready' || state === 'watch'
                ? 'complete'
                : state === 'blocked'
                  ? 'blocked'
                  : 'upcoming',
    });

    if (input.includePrivilegingStep) {
        const total = input.privilegeSummary?.total ?? 0;
        const active = input.privilegeSummary?.active ?? 0;
        const credReady = state === 'ready' || state === 'watch';
        steps.push({
            id: 'privileges',
            label: 'Privilege request',
            detail:
                active > 0
                    ? `${active} active privilege${active === 1 ? '' : 's'} on file.`
                    : total > 0
                      ? `${total} privilege request${total === 1 ? '' : 's'} recorded — continue workflow review/activation.`
                      : 'Submit a governed privilege request once credentialing is ready.',
            status: !credReady ? 'upcoming' : total > 0 ? 'complete' : 'current',
        });
    }

    return steps;
}

export function useStaffGovernanceSetupSteps(input: {
    selectedStaff: Ref<StaffProfileLike>;
    summary: Ref<CredentialingSummaryLike>;
    hasRegulatoryProfile: Ref<boolean>;
    registrationCount: Ref<number>;
    emailBlockerMessage: ComputedRef<string | null>;
    privilegeSummary?: ComputedRef<PrivilegeSummaryLike>;
    includePrivilegingStep?: boolean;
}) {
    return computed(() =>
        buildStaffGovernanceSetupSteps({
            staff: input.selectedStaff.value,
            summary: input.summary.value,
            hasRegulatoryProfile: input.hasRegulatoryProfile.value,
            registrationCount: input.registrationCount.value,
            emailBlockerMessage: input.emailBlockerMessage.value,
            privilegeSummary: input.privilegeSummary?.value,
            includePrivilegingStep: input.includePrivilegingStep,
        }),
    );
}

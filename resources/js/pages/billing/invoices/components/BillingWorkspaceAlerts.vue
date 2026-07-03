<script setup lang="ts">
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '../helpers';

type BillingAuditExportRetryHandoff = {
    jobId: number | string;
    savedAt: string | null;
    targetInvoiceId: number | string;
};

type BillingAuditExportRetryResumeTelemetry = {
    attempts: number;
    failures: number;
    lastFailureReason: string | null;
    successes: number;
};

const props = defineProps<{
    scopeWarning: string | null;
    listErrors: string[];
    lastBillingAuditExportRetryHandoff: BillingAuditExportRetryHandoff | null;
    billingAuditExportRetryResumeTelemetry: BillingAuditExportRetryResumeTelemetry;
    resumingBillingAuditExportRetryHandoff: boolean;
    auditExportRetryHandoffCompletedMessage: string | null;
}>();

defineEmits<{
    (event: 'resume-last-handoff'): void;
    (event: 'clear-last-handoff'): void;
    (event: 'reset-resume-telemetry'): void;
    (event: 'dismiss-completed-message'): void;
}>();
</script>

<template>
    <Alert v-if="props.scopeWarning" variant="destructive">
        <AlertTitle>Scope warning</AlertTitle>
        <AlertDescription>{{ props.scopeWarning }}</AlertDescription>
    </Alert>

    <Alert v-if="props.listErrors.length" variant="destructive">
        <AlertTitle>Request error</AlertTitle>
        <AlertDescription>
            <div class="space-y-1">
                <p
                    v-for="errorMessage in props.listErrors"
                    :key="errorMessage"
                    class="text-xs"
                >
                    {{ errorMessage }}
                </p>
            </div>
        </AlertDescription>
    </Alert>

    <Alert v-if="props.lastBillingAuditExportRetryHandoff">
        <AlertTitle>Resume last handoff target</AlertTitle>
        <AlertDescription>
            <div class="space-y-2">
                <p class="text-xs">
                    Last billing handoff: invoice
                    {{ props.lastBillingAuditExportRetryHandoff.targetInvoiceId }}
                    | export job
                    {{ props.lastBillingAuditExportRetryHandoff.jobId }}
                    | saved
                    {{ formatDateTime(props.lastBillingAuditExportRetryHandoff.savedAt) }}
                </p>
                <p class="text-[11px] text-muted-foreground">
                    Resume telemetry: attempts
                    {{ props.billingAuditExportRetryResumeTelemetry.attempts }} |
                    success
                    {{ props.billingAuditExportRetryResumeTelemetry.successes }} |
                    failure
                    {{ props.billingAuditExportRetryResumeTelemetry.failures }}
                </p>
                <p
                    v-if="props.billingAuditExportRetryResumeTelemetry.lastFailureReason"
                    class="text-[11px] text-muted-foreground"
                >
                    Last failure:
                    {{ props.billingAuditExportRetryResumeTelemetry.lastFailureReason }}
                </p>
                <div class="flex flex-wrap gap-2">
                    <Button
                        type="button"
                        size="sm"
                        :disabled="props.resumingBillingAuditExportRetryHandoff"
                        @click="$emit('resume-last-handoff')"
                    >
                        {{
                            props.resumingBillingAuditExportRetryHandoff
                                ? 'Resuming...'
                                : 'Resume Last Handoff'
                        }}
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        @click="$emit('clear-last-handoff')"
                    >
                        Clear
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        @click="$emit('reset-resume-telemetry')"
                    >
                        Reset Telemetry
                    </Button>
                </div>
            </div>
        </AlertDescription>
    </Alert>

    <Alert v-if="props.auditExportRetryHandoffCompletedMessage">
        <AlertTitle>Retry handoff ready</AlertTitle>
        <AlertDescription>
            <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p class="text-xs">
                    {{ props.auditExportRetryHandoffCompletedMessage }}
                </p>
                <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    @click="$emit('dismiss-completed-message')"
                >
                    Dismiss
                </Button>
            </div>
        </AlertDescription>
    </Alert>
</template>

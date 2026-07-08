<script setup lang="ts">
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
    attestationActorLabel,
    useMedicalRecordAttestations,
} from '@/composables/clinical/useMedicalRecordAttestations';
import { formatDateTime } from '@/composables/clinical/useEncounterOrdering';
import { notifySuccess } from '@/lib/notify';

const props = defineProps<{
    recordId: string;
    canCreate: boolean;
}>();

const attestations = useMedicalRecordAttestations(() => props.recordId);

async function submit(): Promise<void> {
    const ok = await attestations.submit();
    if (ok) {
        notifySuccess('Signer attestation recorded.');
    }
}
</script>

<template>
    <section class="space-y-3 rounded-lg border bg-card p-4 shadow-sm">
        <div class="flex items-center justify-between gap-2">
            <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Signer attestations
            </p>
            <Badge v-if="attestations.attestations.value.length" variant="outline" class="text-[11px]">
                {{ attestations.attestations.value.length }}
            </Badge>
        </div>

        <div v-if="attestations.isLoading.value" class="space-y-2">
            <Skeleton class="h-10 w-full" />
        </div>

        <p v-else-if="!attestations.attestations.value.length" class="text-sm text-muted-foreground">
            No attestations recorded yet.
        </p>

        <ul v-else class="space-y-2">
            <li
                v-for="attestation in attestations.attestations.value"
                :key="attestation.id"
                class="rounded-md border p-2 text-sm"
            >
                <p class="font-medium">{{ attestationActorLabel(attestation) }}</p>
                <p class="text-muted-foreground">{{ formatDateTime(attestation.attestedAt) }}</p>
                <p v-if="attestation.attestationNote" class="mt-1">{{ attestation.attestationNote }}</p>
            </li>
        </ul>

        <div v-if="canCreate" class="space-y-2 border-t pt-3">
            <Textarea
                v-model="attestations.note.value"
                class="min-h-16"
                placeholder="Attestation note"
                :disabled="attestations.isSubmitting.value"
            />
            <Alert v-if="attestations.submitError.value" variant="destructive">
                <AlertDescription>{{ attestations.submitError.value }}</AlertDescription>
            </Alert>
            <Button
                size="sm"
                :disabled="attestations.isSubmitting.value || !attestations.note.value.trim()"
                @click="void submit()"
            >
                {{ attestations.isSubmitting.value ? 'Recording…' : 'Record attestation' }}
            </Button>
        </div>
    </section>
</template>

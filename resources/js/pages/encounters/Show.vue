<script setup lang="ts">
import { defineAsyncComponent } from 'vue';

const EncounterWorkspace = defineAsyncComponent(
    () => import('@/pages/encounters/Workspace.vue'),
);

defineProps<{
    encounterId?: string;
    legacyAppointmentId?: string;
}>();
</script>

<template>
    <EncounterWorkspace
        :encounter-id="encounterId ?? ''"
        :legacy-appointment-id="legacyAppointmentId ?? ''"
    />
</template>

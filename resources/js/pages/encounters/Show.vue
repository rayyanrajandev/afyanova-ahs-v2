<script setup lang="ts">
import EncounterWorkspace from '@/pages/encounters/Workspace.vue';

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

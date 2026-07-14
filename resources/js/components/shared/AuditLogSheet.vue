<script setup lang="ts">
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import AuditLogPanel from '@/components/clinical/panels/AuditLogPanel.vue';
import type { AuditLogLike, AuditLogQueryResult } from '@/lib/audit';

/**
 * One lightweight Sheet (filter row + list + CSV export + pagination, no
 * tabs, no nesting) wrapping the domain-agnostic AuditLogPanel.vue. Built
 * during Emergency's P0c (Reception/Emergency/Admission/Bed-Management
 * audit follow-through) as EmergencyAuditLogSheet.vue, then generalized
 * here once Admission's parity work (AdmB) needed the identical shell —
 * the component never actually depended on anything Emergency-specific,
 * only on the `audit` prop's shape. Any domain's use{X}AuditLog(id)
 * composable works here: pass its return value as `audit`.
 * Opened directly from a row/chip's "Activity" icon button — never nested
 * inside another overlay, per this initiative's design-direction note.
 */
defineProps<{
    title: string;
    subtitle?: string;
    audit: AuditLogQueryResult<AuditLogLike & { id: string; createdAt: string | null }>;
}>();

const open = defineModel<boolean>('open', { required: true });
</script>

<template>
    <Sheet :open="open" @update:open="(value) => (open = value)">
        <SheetContent side="right" variant="form" size="xl">
            <SheetHeader class="shrink-0 border-b bg-background/95 px-6 py-4 text-left backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <SheetTitle>{{ title }}</SheetTitle>
                <SheetDescription v-if="subtitle">{{ subtitle }}</SheetDescription>
            </SheetHeader>

            <div class="min-h-0 flex-1 overflow-y-auto px-6 py-4">
                <AuditLogPanel :audit="audit" />
            </div>
        </SheetContent>
    </Sheet>
</template>

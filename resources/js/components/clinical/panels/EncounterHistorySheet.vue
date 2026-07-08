<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AuditLogPanel from './AuditLogPanel.vue';
import SignerAttestationPanel from './SignerAttestationPanel.vue';
import VersionHistoryPanel from './VersionHistoryPanel.vue';

/**
 * Version history / signer attestations / audit log, moved out of the main
 * page flow into a proper workspace Sheet (reports/clinical-notes-frontend-
 * rebuild-plan.md layout plan, step 3) — same `variant="workspace" size="6xl"`
 * shape as billing's InvoiceDetailsSheet.vue. These are compliance/trust
 * concerns, not part of the moment-to-moment note-writing task, so they
 * belong one click away rather than always rendered inline. The three panel
 * components themselves are unchanged — only their container moved.
 */
const open = defineModel<boolean>('open', { required: true });
const tab = defineModel<string>('tab', { default: 'versions' });

defineProps<{
    recordId: string | null;
    canCreateAttestation: boolean;
    canViewAuditLogs: boolean;
}>();
</script>

<template>
    <Sheet :open="open" @update:open="(value) => (open = value)">
        <SheetContent side="right" variant="workspace" size="6xl">
            <SheetHeader
                class="shrink-0 border-b bg-background/95 px-6 py-4 text-left backdrop-blur supports-[backdrop-filter]:bg-background/80"
            >
                <SheetTitle>Note history &amp; compliance</SheetTitle>
                <SheetDescription>
                    Version history, signer attestations, and the audit trail
                    for this note.
                </SheetDescription>
            </SheetHeader>

            <div v-if="recordId" class="flex min-h-0 flex-1 flex-col">
                <Tabs v-model="tab" class="flex min-h-0 flex-1 flex-col gap-0">
                    <div
                        class="shrink-0 border-b bg-background/95 px-6 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80"
                    >
                        <TabsList class="grid h-auto w-full grid-cols-3">
                            <TabsTrigger
                                value="versions"
                                class="inline-flex items-center gap-1.5 text-xs sm:text-sm"
                            >
                                <AppIcon name="clock" class="size-3.5" />
                                Versions
                            </TabsTrigger>
                            <TabsTrigger
                                value="attestations"
                                class="inline-flex items-center gap-1.5 text-xs sm:text-sm"
                            >
                                <AppIcon name="shield-check" class="size-3.5" />
                                Attestations
                            </TabsTrigger>
                            <TabsTrigger
                                v-if="canViewAuditLogs"
                                value="audit"
                                class="inline-flex items-center gap-1.5 text-xs sm:text-sm"
                            >
                                <AppIcon name="file-text" class="size-3.5" />
                                Audit log
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <ScrollArea class="min-h-0 flex-1">
                        <div class="space-y-4 p-6">
                            <TabsContent value="versions">
                                <VersionHistoryPanel :record-id="recordId" />
                            </TabsContent>
                            <TabsContent value="attestations">
                                <SignerAttestationPanel
                                    :record-id="recordId"
                                    :can-create="canCreateAttestation"
                                />
                            </TabsContent>
                            <TabsContent v-if="canViewAuditLogs" value="audit">
                                <AuditLogPanel :record-id="recordId" />
                            </TabsContent>
                        </div>
                    </ScrollArea>
                </Tabs>
            </div>
        </SheetContent>
    </Sheet>
</template>

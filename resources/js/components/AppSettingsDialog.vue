<script setup lang="ts">
import { ref } from 'vue';
import AppearanceTabs from '@/components/AppearanceTabs.vue';
import AppIcon from '@/components/AppIcon.vue';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import UiPreferencesPanel from '@/components/UiPreferencesPanel.vue';
import { edit as editAppearance } from '@/routes/appearance';
import { Link } from '@inertiajs/vue3';

type Props = {
    open: boolean;
};

defineProps<Props>();

const emit = defineEmits<{
    (e: 'update:open', value: boolean): void;
}>();
</script>

<template>
    <Sheet :open="open" @update:open="emit('update:open', $event)">
        <SheetContent variant="workspace" size="2xl" side="right" showCloseButton>

            <!-- Header -->
            <SheetHeader class="shrink-0 border-b px-6 py-4 text-left pr-12">
                <div class="flex items-center gap-3">
                    <div class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/60">
                        <AppIcon name="sliders-horizontal" class="size-4 text-muted-foreground" />
                    </div>
                    <div>
                        <SheetTitle class="text-sm font-semibold leading-snug">Preferences</SheetTitle>
                        <SheetDescription class="text-xs">Appearance, density &amp; icons</SheetDescription>
                    </div>
                </div>
            </SheetHeader>

            <!-- Scrollable content -->
            <ScrollArea class="min-h-0 flex-1">
                <div class="space-y-6 px-6 py-5">
                    <section class="space-y-2.5">
                        <div>
                            <p class="text-sm font-semibold text-foreground">Appearance mode</p>
                            <p class="text-xs text-muted-foreground">Switch between light, dark, or system.</p>
                        </div>
                        <AppearanceTabs />
                    </section>

                    <Separator />

                    <UiPreferencesPanel />
                </div>
            </ScrollArea>

            <!-- Footer -->
            <SheetFooter class="shrink-0 border-t bg-muted/20 px-6 py-3">
                <Link
                    :href="editAppearance()"
                    class="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-primary"
                >
                    <AppIcon name="arrow-up-right" class="size-3" />
                    Open full settings
                </Link>
            </SheetFooter>

        </SheetContent>
    </Sheet>
</template>

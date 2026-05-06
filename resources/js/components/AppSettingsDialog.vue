<script setup lang="ts">
import { Link } from '@inertiajs/vue3';
import AppearanceTabs from '@/components/AppearanceTabs.vue';
import AppIcon from '@/components/AppIcon.vue';
import { Button } from '@/components/ui/button';
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
import { useAppearance } from '@/composables/useAppearance';
import { useUiPreferences } from '@/composables/useUiPreferences';
import { edit as editAppearance } from '@/routes/appearance';

type Props = {
    open: boolean;
};

defineProps<Props>();

const emit = defineEmits<{
    (e: 'update:open', value: boolean): void;
}>();

const { updateAppearance } = useAppearance();
const { resetUiPreferences } = useUiPreferences();

function resetSettings(): void {
    updateAppearance('system');
    resetUiPreferences();
}

function closeSettings(): void {
    emit('update:open', false);
}
</script>

<template>
    <Sheet :open="open" @update:open="emit('update:open', $event)">
        <SheetContent
            variant="workspace"
            size="xl"
            side="right"
            showCloseButton
            class="border-l"
        >
            <SheetHeader class="shrink-0 border-b bg-card px-6 py-4 pr-12 text-left">
                <div class="flex items-start gap-3">
                    <div class="flex size-9 shrink-0 items-center justify-center rounded-md border bg-background">
                        <AppIcon name="sliders-horizontal" class="size-4 text-primary" />
                    </div>
                    <div class="min-w-0">
                        <SheetTitle class="text-base font-semibold leading-snug">Theme Settings</SheetTitle>
                        <SheetDescription class="text-xs">
                            Customize the workspace look for this browser.
                        </SheetDescription>
                    </div>
                </div>
            </SheetHeader>

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

            <SheetFooter class="shrink-0 border-t bg-card px-6 py-3 sm:flex-row sm:items-center">
                <Link
                    :href="editAppearance()"
                    class="inline-flex items-center gap-1.5 self-start text-xs text-muted-foreground transition-colors hover:text-primary sm:self-center"
                >
                    <AppIcon name="arrow-up-right" class="size-3" />
                    Full settings
                </Link>
                <div class="flex flex-col gap-2 sm:ml-auto sm:flex-row">
                    <Button variant="outline" size="sm" class="gap-1.5" @click="resetSettings">
                        <AppIcon name="rotate-ccw" class="size-3.5" />
                        Reset changes
                    </Button>
                    <Button size="sm" @click="closeSettings">
                        Save
                    </Button>
                </div>
            </SheetFooter>
        </SheetContent>
    </Sheet>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const props = withDefaults(
    defineProps<{
        open: boolean;
        title: string;
        description: string;
        searchInputId: string;
        searchLabel: string;
        searchPlaceholder?: string;
        query: string;
        errorMessage?: string | null;
        contentClass?: string;
        plainResults?: boolean;
    }>(),
    {
        searchPlaceholder: 'Search',
        errorMessage: null,
        contentClass: 'sm:max-w-5xl',
        plainResults: false,
    },
);

const emit = defineEmits<{
    'update:open': [value: boolean];
    'update:query': [value: string];
}>();

const openProxy = computed({
    get: () => props.open,
    set: (value: boolean) => emit('update:open', value),
});

const queryProxy = computed({
    get: () => props.query,
    set: (value: string) => emit('update:query', value),
});

watch(
    () => props.open,
    (value) => {
        if (!value) return;

        window.setTimeout(() => {
            const input = document.getElementById(props.searchInputId) as HTMLInputElement | null;
            input?.focus();
            input?.select();
        }, 0);
    },
);
</script>

<template>
    <Dialog v-model:open="openProxy">
        <DialogContent :class="['overflow-hidden p-0', contentClass]">
            <div class="flex max-h-[85vh] flex-col">
                <DialogHeader class="shrink-0 gap-1.5 border-b bg-muted/10 px-4 py-3 text-left">
                    <DialogTitle class="text-base">{{ title }}</DialogTitle>
                    <DialogDescription class="max-w-3xl text-sm leading-5">
                        {{ description }}
                    </DialogDescription>
                </DialogHeader>

                <div class="grid gap-3 px-4 py-3">
                    <div class="grid gap-1.5">
                        <Label :for="searchInputId">{{ searchLabel }}</Label>
                        <div class="flex flex-nowrap items-stretch overflow-hidden rounded-md border border-input bg-background shadow-xs focus-within:ring-2 focus-within:ring-ring/50 focus-within:ring-offset-0">
                            <span class="flex h-8 shrink-0 items-center border-0 border-r border-input bg-muted/30 pl-3 pr-2 text-muted-foreground">
                                <AppIcon name="search" class="size-4" aria-hidden />
                            </span>
                            <Input
                                :id="searchInputId"
                                v-model="queryProxy"
                                :placeholder="searchPlaceholder"
                                class="h-8 min-w-0 flex-1 rounded-none border-0 bg-transparent py-1.5 pl-2 pr-3 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                                autocomplete="off"
                            />
                        </div>
                    </div>

                    <Alert v-if="errorMessage" variant="destructive">
                        <AlertDescription class="text-sm">
                            {{ errorMessage }}
                        </AlertDescription>
                    </Alert>

                    <div :class="props.plainResults ? 'bg-transparent' : 'overflow-hidden rounded-md border bg-background'">
                        <div :class="props.plainResults ? 'max-h-[60vh] overflow-y-auto' : 'max-h-[60vh] overflow-y-auto p-2.5 sm:p-3'">
                            <slot />
                        </div>
                    </div>
                </div>
            </div>
        </DialogContent>
    </Dialog>
</template>





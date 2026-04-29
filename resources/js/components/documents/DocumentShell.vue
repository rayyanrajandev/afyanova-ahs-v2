<script setup lang="ts">
import AppBrandMark from '@/components/AppBrandMark.vue';
import { Button } from '@/components/ui/button';
import type { SharedDocumentBranding } from '@/types';

withDefaults(
    defineProps<{
        documentBranding: SharedDocumentBranding;
        eyebrow?: string;
        title: string;
        subtitle?: string | null;
        documentNumber?: string | null;
        statusLabel?: string | null;
        generatedAtLabel?: string | null;
    }>(),
    {
        eyebrow: 'Document',
        subtitle: null,
        documentNumber: null,
        statusLabel: null,
        generatedAtLabel: null,
    },
);

const emit = defineEmits<{
    print: [];
}>();
</script>

<template>
    <div class="document-shell min-h-screen bg-white text-slate-950">
        <div class="fixed right-3 top-3 z-20 print:hidden sm:right-5 sm:top-5">
            <div class="flex items-center gap-2 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 shadow-sm backdrop-blur">
                <div class="hidden pr-2 sm:block">
                    <p class="text-[11px] font-medium uppercase tracking-[0.24em] text-slate-500">
                        {{ eyebrow }}
                    </p>
                    <p class="text-sm text-slate-700">
                        {{ title }}
                    </p>
                </div>
                <div class="flex items-center gap-2">
                    <slot name="actions">
                        <Button type="button" variant="outline" class="gap-2" @click="emit('print')">
                            Print
                        </Button>
                    </slot>
                </div>
            </div>
        </div>

        <main class="mx-auto max-w-5xl px-2 py-3 sm:px-4 sm:py-4">
            <section class="overflow-hidden border border-slate-200 bg-white">
                <header class="border-b border-slate-200 bg-white px-4 py-4 sm:px-5 sm:py-5">
                    <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div class="flex items-start gap-4">
                            <div class="flex size-14 items-center justify-center border border-slate-200 bg-white">
                                <AppBrandMark
                                    :branding="documentBranding"
                                    :class-name="'max-h-9 max-w-9 object-contain'"
                                    :alt="`${documentBranding.systemName} logo`"
                                />
                            </div>
                            <div class="space-y-1.5">
                                <p class="text-xs font-medium uppercase tracking-[0.3em] text-slate-500">
                                    {{ eyebrow }}
                                </p>
                                <div>
                                    <h1 class="text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">
                                        {{ title }}
                                    </h1>
                                    <p v-if="subtitle" class="mt-1 max-w-2xl text-sm leading-5 text-slate-600">
                                        {{ subtitle }}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div class="grid gap-2 border border-slate-200 bg-white p-3 sm:min-w-[240px]">
                            <div>
                                <p class="text-xs uppercase tracking-[0.24em] text-slate-500">
                                    Issued By
                                </p>
                                <p class="mt-1 text-sm font-medium text-slate-900">
                                    {{ documentBranding.issuedByName }}
                                </p>
                            </div>
                            <div v-if="documentNumber || statusLabel" class="grid gap-2 sm:grid-cols-2">
                                <div v-if="documentNumber">
                                    <p class="text-xs uppercase tracking-[0.24em] text-slate-500">
                                        Document No.
                                    </p>
                                    <p class="mt-1 text-sm font-medium text-slate-900">
                                        {{ documentNumber }}
                                    </p>
                                </div>
                                <div v-if="statusLabel">
                                    <p class="text-xs uppercase tracking-[0.24em] text-slate-500">
                                        Status
                                    </p>
                                    <p class="mt-1 text-sm font-medium text-slate-900">
                                        {{ statusLabel }}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </header>

                <div class="px-4 py-4 sm:px-5 sm:py-5">
                    <slot />
                </div>

                <footer class="border-t border-slate-200 bg-white px-4 py-3 sm:px-5">
                    <div class="flex flex-col gap-3 text-xs text-slate-600 sm:flex-row sm:items-end sm:justify-between">
                        <div class="space-y-1">
                            <p class="font-medium text-slate-900">
                                {{ documentBranding.systemName }}
                            </p>
                            <p v-if="documentBranding.supportEmail">
                                Support: {{ documentBranding.supportEmail }}
                            </p>
                            <p>
                                {{ documentBranding.footerText }}
                            </p>
                        </div>
                        <p v-if="generatedAtLabel" class="text-slate-500">
                            Generated {{ generatedAtLabel }}
                        </p>
                    </div>
                </footer>
            </section>
        </main>
    </div>
</template>

<style>
@media print {
    @page {
        margin: 8mm;
    }

    .document-shell {
        background: #fff;
    }
}
</style>

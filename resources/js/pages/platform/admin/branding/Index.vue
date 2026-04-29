<script setup lang="ts">
import { Head, router, usePage } from '@inertiajs/vue3';
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';
import AppBrandMark from '@/components/AppBrandMark.vue';
import AppIcon from '@/components/AppIcon.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/AppLayout.vue';
import {
    buildDefaultMailFooterText,
    DEFAULT_APP_ICON_URL,
    normalizeBranding,
    normalizeMailBranding,
    syncClientBranding,
} from '@/lib/branding';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import type {
    BreadcrumbItem,
    SharedBranding,
    SharedMailBranding,
} from '@/types';

type PageProps = {
    name?: string;
    branding?: Partial<SharedBranding>;
    mailBranding?: Partial<SharedMailBranding>;
};

type ValidationPayload = {
    data?: {
        branding?: SharedBranding;
        mail?: SharedMailBranding;
    };
    errors?: Record<string, string[]>;
    message?: string;
};

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Platform Admin', href: '/platform/admin/branding' },
    { title: 'Branding', href: '/platform/admin/branding' },
];

const page = usePage<PageProps>();
const errors = ref<Record<string, string[]>>({});
const saving = ref(false);
const selectedLogo = ref<File | null>(null);
const selectedLogoPreviewUrl = ref<string | null>(null);
const selectedAppIcon = ref<File | null>(null);
const selectedAppIconPreviewUrl = ref<string | null>(null);

const form = reactive({
    systemName: '',
    shortName: '',
    mailFromName: '',
    mailFromAddress: '',
    mailReplyToAddress: '',
    mailFooterText: '',
    removeLogo: false,
    removeAppIcon: false,
});

const savedBranding = computed(() =>
    normalizeBranding(page.props.branding, page.props.name),
);

const savedMailBranding = computed(() =>
    normalizeMailBranding(page.props.mailBranding, savedBranding.value.systemName),
);

function normalizeOptionalText(value: string): string | null {
    const trimmed = value.trim();

    return trimmed !== '' ? trimmed : null;
}

const normalizedShortName = computed(() => normalizeOptionalText(form.shortName));
const normalizedMailFromName = computed(() =>
    normalizeOptionalText(form.mailFromName),
);
const normalizedMailFromAddress = computed(() =>
    normalizeOptionalText(form.mailFromAddress),
);
const normalizedMailReplyToAddress = computed(() =>
    normalizeOptionalText(form.mailReplyToAddress),
);
const normalizedMailFooterText = computed(() =>
    normalizeOptionalText(form.mailFooterText),
);

const previewBranding = computed(() =>
    normalizeBranding({
        systemName: form.systemName.trim() || savedBranding.value.systemName,
        shortName: normalizedShortName.value,
        logoUrl:
            selectedLogoPreviewUrl.value ??
            (form.removeLogo ? null : savedBranding.value.logoUrl),
        hasCustomLogo:
            selectedLogoPreviewUrl.value !== null ||
            (!form.removeLogo && savedBranding.value.hasCustomLogo),
        appIconUrl:
            selectedAppIconPreviewUrl.value ??
            (form.removeAppIcon
                ? DEFAULT_APP_ICON_URL
                : savedBranding.value.appIconUrl),
        hasCustomAppIcon:
            selectedAppIconPreviewUrl.value !== null ||
            (!form.removeAppIcon && savedBranding.value.hasCustomAppIcon),
    }),
);

const previewMailBranding = computed(() =>
    normalizeMailBranding(
        {
            fromName:
                normalizedMailFromName.value ?? previewBranding.value.systemName,
            fromAddress:
                normalizedMailFromAddress.value ??
                savedMailBranding.value.defaults.fromAddress,
            replyToAddress: normalizedMailReplyToAddress.value,
            footerText:
                normalizedMailFooterText.value ??
                buildDefaultMailFooterText(previewBranding.value.systemName),
            defaults: {
                fromAddress: savedMailBranding.value.defaults.fromAddress,
            },
        },
        previewBranding.value.systemName,
    ),
);

const emailHeaderPreviewAssetUrl = computed(
    () => previewBranding.value.logoUrl ?? previewBranding.value.appIconUrl,
);

const hasPendingChanges = computed(
    () =>
        form.systemName.trim() !== savedBranding.value.systemName ||
        normalizedShortName.value !== savedBranding.value.shortName ||
        previewMailBranding.value.fromName !== savedMailBranding.value.fromName ||
        previewMailBranding.value.fromAddress !==
            savedMailBranding.value.fromAddress ||
        previewMailBranding.value.replyToAddress !==
            savedMailBranding.value.replyToAddress ||
        previewMailBranding.value.footerText !==
            savedMailBranding.value.footerText ||
        selectedLogo.value !== null ||
        selectedAppIcon.value !== null ||
        (form.removeLogo && savedBranding.value.hasCustomLogo) ||
        (form.removeAppIcon && savedBranding.value.hasCustomAppIcon),
);

function firstError(field: string): string | null {
    return errors.value[field]?.[0] ?? null;
}

function csrfToken(): string | null {
    return (
        document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')
            ?.content ?? null
    );
}

function resetForm(): void {
    form.systemName = savedBranding.value.systemName;
    form.shortName = savedBranding.value.shortName ?? '';
    form.mailFromName = savedMailBranding.value.usesCustomFromName
        ? savedMailBranding.value.fromName
        : '';
    form.mailFromAddress = savedMailBranding.value.usesCustomFromAddress
        ? savedMailBranding.value.fromAddress
        : '';
    form.mailReplyToAddress = savedMailBranding.value.replyToAddress ?? '';
    form.mailFooterText = savedMailBranding.value.usesCustomFooterText
        ? savedMailBranding.value.footerText
        : '';
    form.removeLogo = false;
    form.removeAppIcon = false;
    errors.value = {};
    clearSelectedLogo();
    clearSelectedAppIcon();
}

function clearSelectedLogo(): void {
    if (selectedLogoPreviewUrl.value !== null) {
        URL.revokeObjectURL(selectedLogoPreviewUrl.value);
    }

    selectedLogo.value = null;
    selectedLogoPreviewUrl.value = null;
}

function clearSelectedAppIcon(): void {
    if (selectedAppIconPreviewUrl.value !== null) {
        URL.revokeObjectURL(selectedAppIconPreviewUrl.value);
    }

    selectedAppIcon.value = null;
    selectedAppIconPreviewUrl.value = null;
}

function onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    clearSelectedLogo();
    errors.value = {};

    if (file === null) {
        return;
    }

    selectedLogo.value = file;
    selectedLogoPreviewUrl.value = URL.createObjectURL(file);
    form.removeLogo = false;
}

function onAppIconSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    clearSelectedAppIcon();
    errors.value = {};

    if (file === null) {
        return;
    }

    selectedAppIcon.value = file;
    selectedAppIconPreviewUrl.value = URL.createObjectURL(file);
    form.removeAppIcon = false;
}

function useDefaultLogo(): void {
    clearSelectedLogo();
    form.removeLogo = true;
}

function useDefaultAppIcon(): void {
    clearSelectedAppIcon();
    form.removeAppIcon = true;
}

async function saveBranding(): Promise<void> {
    if (saving.value) {
        return;
    }

    saving.value = true;
    errors.value = {};

    const payload = new FormData();
    payload.set('systemName', form.systemName.trim());
    payload.set('shortName', form.shortName.trim());
    payload.set('mailFromName', form.mailFromName.trim());
    payload.set('mailFromAddress', form.mailFromAddress.trim());
    payload.set('mailReplyToAddress', form.mailReplyToAddress.trim());
    payload.set('mailFooterText', form.mailFooterText.trim());
    payload.set('removeLogo', form.removeLogo ? '1' : '0');
    payload.set('removeAppIcon', form.removeAppIcon ? '1' : '0');

    if (selectedLogo.value !== null) {
        payload.set('logo', selectedLogo.value);
    }

    if (selectedAppIcon.value !== null) {
        payload.set('appIcon', selectedAppIcon.value);
    }

    try {
        const headers: Record<string, string> = {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
        };
        const token = csrfToken();
        if (token) {
            headers['X-CSRF-TOKEN'] = token;
        }

        const response = await fetch('/api/v1/platform/admin/branding', {
            method: 'POST',
            credentials: 'same-origin',
            headers,
            body: payload,
        });

        const json = (await response.json().catch(() => ({}))) as ValidationPayload;
        if (!response.ok) {
            if (response.status === 422 && json.errors) {
                errors.value = json.errors;
                return;
            }

            throw new Error(json.message ?? `${response.status} ${response.statusText}`);
        }

        const branding = normalizeBranding(
            json.data?.branding,
            form.systemName.trim() || page.props.name,
        );
        normalizeMailBranding(json.data?.mail, branding.systemName);
        syncClientBranding(branding);
        notifySuccess('System branding and email identity updated.');
        clearSelectedLogo();
        clearSelectedAppIcon();
        form.removeLogo = false;
        form.removeAppIcon = false;

        router.reload({
            only: ['branding', 'name', 'mailBranding'],
            preserveScroll: true,
            preserveState: true,
        });
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to save branding.'));
    } finally {
        saving.value = false;
    }
}

watch(
    [savedBranding, savedMailBranding],
    () => {
        if (!saving.value) {
            resetForm();
        }
    },
    { immediate: true },
);

onBeforeUnmount(() => {
    clearSelectedLogo();
    clearSelectedAppIcon();
});
</script>

<template>
    <Head title="Branding" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-lg p-4 md:p-6">
            <div class="flex flex-col gap-1">
                <h1 class="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                    <AppIcon name="pencil" class="size-7 text-primary" />
                    System Branding
                </h1>
                <p class="text-sm text-muted-foreground">
                    Update the Afyanova identity once and reuse it across browser titles,
                    auth screens, notifications, tabs, and the main app shell.
                </p>
            </div>

            <Alert>
                <AlertTitle>Shared across the product</AlertTitle>
                <AlertDescription>
                    This workspace updates the main system name, optional short name,
                    uploaded logo and app icon, plus the sender identity and footer
                    used in outgoing notifications.
                </AlertDescription>
            </Alert>

            <div class="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,420px)]">
                <Card class="rounded-lg border-sidebar-border/70">
                    <CardHeader>
                        <CardTitle>Brand Settings</CardTitle>
                        <CardDescription>
                            Keep the full system name descriptive and use the short name for
                            compact UI surfaces like the sidebar chip while keeping email
                            sender details aligned with the same identity system.
                        </CardDescription>
                    </CardHeader>
                    <CardContent class="space-y-5">
                        <div class="grid gap-2">
                            <Label for="branding-system-name">System name</Label>
                            <Input
                                id="branding-system-name"
                                v-model="form.systemName"
                                maxlength="120"
                                placeholder="Afyanova AHS"
                            />
                            <p v-if="firstError('systemName')" class="text-xs text-destructive">
                                {{ firstError('systemName') }}
                            </p>
                        </div>

                        <div class="grid gap-2">
                            <Label for="branding-short-name">Short name</Label>
                            <Input
                                id="branding-short-name"
                                v-model="form.shortName"
                                maxlength="40"
                                placeholder="Afyanova"
                            />
                            <p class="text-xs text-muted-foreground">
                                Optional. Used when space is limited.
                            </p>
                            <p v-if="firstError('shortName')" class="text-xs text-destructive">
                                {{ firstError('shortName') }}
                            </p>
                        </div>

                        <div class="grid gap-3 rounded-lg border border-dashed p-4">
                            <div class="space-y-1">
                                <Label for="branding-logo">Custom logo</Label>
                                <Input
                                    id="branding-logo"
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp"
                                    @change="onLogoSelected"
                                />
                                <p class="text-xs text-muted-foreground">
                                    Upload a PNG, JPG, or WebP logo up to 3MB. Leave empty to
                                    keep the built-in Afyanova mark.
                                </p>
                                <p v-if="firstError('logo')" class="text-xs text-destructive">
                                    {{ firstError('logo') }}
                                </p>
                            </div>

                            <div class="flex flex-wrap gap-2">
                                <Button
                                    variant="outline"
                                    type="button"
                                    :disabled="
                                        selectedLogo === null && !savedBranding.hasCustomLogo
                                    "
                                    @click="useDefaultLogo"
                                >
                                    Use Default Mark
                                </Button>
                            </div>
                        </div>

                        <div class="grid gap-3 rounded-lg border border-dashed p-4">
                            <div class="space-y-1">
                                <Label for="branding-app-icon">App icon</Label>
                                <Input
                                    id="branding-app-icon"
                                    type="file"
                                    accept="image/png"
                                    @change="onAppIconSelected"
                                />
                                <p class="text-xs text-muted-foreground">
                                    Upload a square PNG icon at least 128 x 128 pixels.
                                    This is used for browser tabs and touch icons.
                                </p>
                                <p v-if="firstError('appIcon')" class="text-xs text-destructive">
                                    {{ firstError('appIcon') }}
                                </p>
                            </div>

                            <div class="flex flex-wrap gap-2">
                                <Button
                                    variant="outline"
                                    type="button"
                                    :disabled="
                                        selectedAppIcon === null &&
                                        !savedBranding.hasCustomAppIcon
                                    "
                                    @click="useDefaultAppIcon"
                                >
                                    Use Default App Icon
                                </Button>
                            </div>
                        </div>

                        <div class="grid gap-4 rounded-lg border border-dashed p-4">
                            <div class="space-y-1">
                                <h3 class="text-sm font-medium">Email identity</h3>
                                <p class="text-xs text-muted-foreground">
                                    Control the sender label, reply handling, and the footer
                                    line applied to system notifications.
                                </p>
                            </div>

                            <div class="grid gap-4 md:grid-cols-2">
                                <div class="grid gap-2">
                                    <Label for="branding-mail-from-name">Sender name</Label>
                                    <Input
                                        id="branding-mail-from-name"
                                        v-model="form.mailFromName"
                                        maxlength="120"
                                        :placeholder="previewBranding.systemName"
                                    />
                                    <p class="text-xs text-muted-foreground">
                                        Leave this aligned with the system name unless mail
                                        should come from a dedicated team label. Current
                                        effective value: {{ previewMailBranding.fromName }}.
                                    </p>
                                    <p
                                        v-if="firstError('mailFromName')"
                                        class="text-xs text-destructive"
                                    >
                                        {{ firstError('mailFromName') }}
                                    </p>
                                </div>

                                <div class="grid gap-2">
                                    <Label for="branding-mail-from-address">
                                        Sender address
                                    </Label>
                                    <Input
                                        id="branding-mail-from-address"
                                        v-model="form.mailFromAddress"
                                        type="email"
                                        maxlength="190"
                                        :placeholder="savedMailBranding.defaults.fromAddress"
                                    />
                                    <p class="text-xs text-muted-foreground">
                                        Use an address allowed by the configured mail transport.
                                        Current effective value: {{ previewMailBranding.fromAddress }}.
                                    </p>
                                    <p
                                        v-if="firstError('mailFromAddress')"
                                        class="text-xs text-destructive"
                                    >
                                        {{ firstError('mailFromAddress') }}
                                    </p>
                                </div>

                                <div class="grid gap-2">
                                    <Label for="branding-mail-reply-to">
                                        Reply-to address
                                    </Label>
                                    <Input
                                        id="branding-mail-reply-to"
                                        v-model="form.mailReplyToAddress"
                                        type="email"
                                        maxlength="190"
                                        placeholder="support@afyanova.so"
                                    />
                                    <p class="text-xs text-muted-foreground">
                                        Optional. Replies will go here instead of the sender
                                        address.
                                    </p>
                                    <p
                                        v-if="firstError('mailReplyToAddress')"
                                        class="text-xs text-destructive"
                                    >
                                        {{ firstError('mailReplyToAddress') }}
                                    </p>
                                </div>

                                <div class="grid gap-2 md:col-span-2">
                                    <Label for="branding-mail-footer-text">
                                        Footer text
                                    </Label>
                                    <Textarea
                                        id="branding-mail-footer-text"
                                        v-model="form.mailFooterText"
                                        rows="3"
                                        maxlength="240"
                                        :placeholder="buildDefaultMailFooterText(previewBranding.systemName)"
                                    />
                                    <p class="text-xs text-muted-foreground">
                                        Keep the default copyright line or replace it with a
                                        short support or compliance note. Current effective
                                        value: {{ previewMailBranding.footerText }}.
                                    </p>
                                    <p
                                        v-if="firstError('mailFooterText')"
                                        class="text-xs text-destructive"
                                    >
                                        {{ firstError('mailFooterText') }}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div class="flex flex-wrap justify-end gap-2 border-t pt-4">
                            <Button
                                variant="ghost"
                                type="button"
                                :disabled="saving || !hasPendingChanges"
                                @click="resetForm"
                            >
                                Reset Changes
                            </Button>
                            <Button
                                :disabled="saving || !hasPendingChanges"
                                @click="saveBranding"
                            >
                                {{ saving ? 'Saving...' : 'Save Branding' }}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <Card class="rounded-lg border-sidebar-border/70">
                    <CardHeader>
                        <CardTitle>Live Preview</CardTitle>
                        <CardDescription>
                            Review how the current changes will look before saving.
                        </CardDescription>
                    </CardHeader>
                    <CardContent class="space-y-4">
                        <div class="rounded-lg border bg-card p-4 shadow-sm">
                            <p class="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                                Sidebar chip
                            </p>
                            <div class="mt-3 flex items-center gap-3">
                                <div
                                    :class="
                                        previewBranding.hasCustomLogo
                                            ? 'flex size-12 items-center justify-center overflow-hidden rounded-lg border bg-white p-1 shadow-sm'
                                            : 'flex size-11 items-center justify-center rounded-lg bg-primary text-primary-foreground'
                                    "
                                >
                                    <AppBrandMark
                                        :branding="previewBranding"
                                        :class-name="
                                            previewBranding.hasCustomLogo
                                                ? 'size-full object-contain'
                                                : 'size-6 fill-current text-white'
                                        "
                                    />
                                </div>
                                <div class="min-w-0">
                                    <p class="truncate text-sm font-semibold">
                                        {{ previewBranding.displayName }}
                                    </p>
                                    <p class="truncate text-xs text-muted-foreground">
                                        {{ previewBranding.systemName }}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div class="rounded-lg border bg-muted/30 p-4">
                            <p class="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                                Browser title
                            </p>
                            <div class="mt-2 flex items-center gap-3">
                                <img
                                    :src="previewBranding.appIconUrl"
                                    alt="App icon preview"
                                    class="size-9 rounded-lg border bg-white p-1 shadow-sm"
                                />
                                <div>
                                    <p class="text-sm font-medium">
                                        Dashboard - {{ previewBranding.systemName }}
                                    </p>
                                    <p class="text-xs text-muted-foreground">
                                        {{
                                            previewBranding.hasCustomAppIcon
                                                ? 'Custom app icon active'
                                                : 'Default app icon active'
                                        }}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div class="rounded-lg border bg-card/70 p-4 space-y-3 shadow-sm">
                            <p class="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                                Email identity
                            </p>
                            <div class="flex items-center gap-3">
                                <img
                                    :src="emailHeaderPreviewAssetUrl"
                                    alt="Email header preview"
                                    class="size-10 rounded-lg border bg-white p-1 shadow-sm object-contain"
                                />
                                <div class="min-w-0">
                                    <p class="truncate text-sm font-medium">
                                        {{ previewMailBranding.fromName }} &lt;{{
                                            previewMailBranding.fromAddress
                                        }}&gt;
                                    </p>
                                    <p class="truncate text-xs text-muted-foreground">
                                        {{
                                            previewMailBranding.replyToAddress
                                                ? `Replies route to ${previewMailBranding.replyToAddress}`
                                                : 'Replies follow the sender address.'
                                        }}
                                    </p>
                                </div>
                            </div>
                            <div class="rounded-lg bg-muted/35 p-3">
                                <p class="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                                    Footer
                                </p>
                                <p class="mt-2 text-sm text-foreground">
                                    {{ previewMailBranding.footerText }}
                                </p>
                            </div>
                            <p class="text-xs text-muted-foreground">
                                {{
                                    previewBranding.hasCustomLogo
                                        ? 'Email headers will use the current logo.'
                                        : 'Email headers will fall back to the current app icon when no wide logo is uploaded.'
                                }}
                            </p>
                        </div>

                        <div class="rounded-lg border bg-muted/20 p-4 space-y-3">
                            <p class="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                                Current source
                            </p>
                            <div>
                                <p class="text-sm text-foreground">
                                    {{
                                        previewBranding.hasCustomLogo
                                            ? 'Custom uploaded logo'
                                            : 'Built-in Afyanova monogram'
                                    }}
                                </p>
                                <p class="mt-1 text-xs text-muted-foreground">
                                    {{
                                        previewBranding.shortName
                                            ? `Short name: ${previewBranding.shortName}`
                                            : 'Short name disabled; full system name will be used.'
                                    }}
                                </p>
                            </div>
                            <div class="border-t pt-3">
                                <p class="text-sm text-foreground">
                                    {{
                                        previewBranding.hasCustomAppIcon
                                            ? 'Custom uploaded app icon'
                                            : 'Default app icon'
                                    }}
                                </p>
                                <p class="mt-1 text-xs text-muted-foreground">
                                    Browser tabs and touch icon surfaces will use this asset.
                                </p>
                            </div>
                            <p class="text-xs text-muted-foreground">
                                {{
                                    previewBranding.appIconUrl === DEFAULT_APP_ICON_URL
                                        ? 'Preview is showing the bundled default icon before save.'
                                        : 'Preview is showing the selected app icon asset.'
                                }}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    </AppLayout>
</template>

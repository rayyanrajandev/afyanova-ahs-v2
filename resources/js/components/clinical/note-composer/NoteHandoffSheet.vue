<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useMedicalRecordHandoff } from '@/composables/clinical/useMedicalRecordHandoff';
import { apiGet } from '@/lib/apiClient';

const props = defineProps<{
    medicalRecordId: string;
}>();

const open = defineModel<boolean>('open', { required: true });

const emit = defineEmits<{
    handedOff: [];
}>();

type StaffClinician = {
    id: string;
    userId: number | null;
    userName: string | null;
    userEmail: string | null;
    department: string | null;
    jobTitle: string | null;
};

const { initiateHandoff } = useMedicalRecordHandoff();

const popoverOpen = ref(false);
const searchQuery = ref('');
const searchResults = ref<StaffClinician[]>([]);
const searchLoading = ref(false);
const selectedUser = ref<StaffClinician | null>(null);
const handoffNote = ref('');
const accessDenied = ref(false);
const lookupError = ref<string | null>(null);
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function clearDebounce(): void {
    if (debounceTimer !== null) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
    }
}

onBeforeUnmount(clearDebounce);

watch(searchQuery, (value) => {
    const current = value.trim();
    if (current.length < 2) {
        searchResults.value = [];
        lookupError.value = null;
        return;
    }
    if (accessDenied.value) return;
    if (selectedUser.value) {
        selectedUser.value = null;
    }

    clearDebounce();
    searchLoading.value = true;
    lookupError.value = null;

    debounceTimer = setTimeout(async () => {
        try {
            const res = await apiGet<{ data: StaffClinician[] }>(
                `/staff/clinical-directory?q=${encodeURIComponent(current)}&perPage=8`,
            );
            searchResults.value = res.data ?? [];
        } catch (error: unknown) {
            searchResults.value = [];
            const status = (error as { status?: number })?.status;
            if (status === 403) {
                accessDenied.value = true;
                popoverOpen.value = false;
                return;
            }
            lookupError.value = 'Unable to search clinicians right now.';
        } finally {
            searchLoading.value = false;
        }
    }, 300);
});

function selectUser(user: StaffClinician): void {
    selectedUser.value = user;
    searchQuery.value = '';
    searchResults.value = [];
    lookupError.value = null;
    popoverOpen.value = false;
}

function clearSelected(): void {
    selectedUser.value = null;
    searchQuery.value = '';
    searchResults.value = [];
    lookupError.value = null;
}

function onPopoverOpenChange(value: boolean): void {
    if (!value) {
        if (!selectedUser.value) {
            searchQuery.value = '';
        }
        searchResults.value = [];
        lookupError.value = null;
    }
    popoverOpen.value = value;
}

const canSubmit = computed(() => selectedUser.value !== null && !initiateHandoff.isPending.value);

async function submit(): Promise<void> {
    if (!selectedUser.value) return;

    try {
        await initiateHandoff.mutateAsync({
            medicalRecordId: props.medicalRecordId,
            targetUserId: selectedUser.value.userId,
            note: handoffNote.value || undefined,
        });
        open.value = false;
        emit('handedOff');
    } catch {
        // Error handled in composable
    }
}

function onOpenChange(value: boolean): void {
    if (!value) {
        searchQuery.value = '';
        searchResults.value = [];
        selectedUser.value = null;
        handoffNote.value = '';
        accessDenied.value = false;
        lookupError.value = null;
    }
    open.value = value;
}
</script>

<template>
    <Dialog :open="open" @update:open="onOpenChange">
        <DialogContent class="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>Hand off clinical note</DialogTitle>
                <DialogDescription>
                    Transfer this note to another clinician to continue.
                    The recipient will be notified and can accept or decline.
                </DialogDescription>
            </DialogHeader>

            <Alert variant="default" class="[&_svg]:text-muted-foreground">
                <AppIcon name="info" class="size-4" />
                <AlertDescription>
                    The recipient will be notified and can accept or decline. You can cancel the handoff anytime before they accept.
                </AlertDescription>
            </Alert>

            <div class="space-y-4">
                <div class="space-y-2">
                    <Label>Select clinician</Label>

                    <template v-if="accessDenied">
                        <Button
                            type="button"
                            variant="outline"
                            class="h-10 w-full justify-between px-3 font-normal"
                            disabled
                        >
                            <span class="truncate text-left text-muted-foreground">
                                Search by name or email...
                            </span>
                            <AppIcon name="search" class="size-4 shrink-0 text-muted-foreground" />
                        </Button>
                        <Alert variant="destructive">
                            <AlertDescription class="text-xs">
                                Clinician search is restricted by permissions.
                            </AlertDescription>
                        </Alert>
                    </template>

                    <template v-else>
                        <Popover v-model:open="popoverOpen" @update:open="onPopoverOpenChange">
                            <PopoverTrigger as-child>
                                <Button
                                    type="button"
                                    variant="outline"
                                    class="h-10 w-full justify-between px-3 font-normal"
                                >
                                    <span
                                        class="truncate text-left"
                                        :class="{ 'text-muted-foreground': !selectedUser }"
                                    >
                                        {{ selectedUser?.userName ?? 'Search by name or email...' }}
                                    </span>
                                    <AppIcon
                                        :name="selectedUser ? 'x' : 'search'"
                                        class="size-4 shrink-0 text-muted-foreground"
                                        @click.stop="selectedUser ? clearSelected() : undefined"
                                    />
                                </Button>
                            </PopoverTrigger>

                            <PopoverContent align="start" class="w-[var(--reka-popover-trigger-width)] rounded-lg p-0">
                                <div class="border-b p-2">
                                    <Input
                                        v-model="searchQuery"
                                        placeholder="Search by name or email..."
                                        class="h-9"
                                        autocomplete="off"
                                    />
                                </div>

                                <div class="max-h-72 space-y-1 overflow-y-auto p-1.5">
                                    <div
                                        v-if="searchLoading"
                                        class="flex items-center gap-2 px-3 py-3 text-xs text-muted-foreground"
                                    >
                                        <AppIcon name="loader-circle" class="size-3 animate-spin" />
                                        Searching...
                                    </div>

                                    <Alert
                                        v-else-if="lookupError"
                                        variant="destructive"
                                        class="m-1"
                                    >
                                        <AlertDescription class="text-xs">
                                            {{ lookupError }}
                                        </AlertDescription>
                                    </Alert>

                                    <template v-else-if="searchResults.length > 0">
                                        <button
                                            v-for="user in searchResults"
                                            :key="user.id"
                                            type="button"
                                            class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted/50"
                                            @click="selectUser(user)"
                                        >
                                            <div class="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                                                {{ (user.userName ?? '?').charAt(0).toUpperCase() }}
                                            </div>
                                            <div class="min-w-0 flex-1">
                                                <p class="truncate font-medium">{{ user.userName }}</p>
                                                <p v-if="user.department" class="truncate text-xs text-muted-foreground">
                                                    {{ user.department }}
                                                </p>
                                            </div>
                                        </button>
                                    </template>

                                    <p
                                        v-else-if="searchQuery.trim().length >= 2"
                                        class="px-3 py-3 text-xs text-muted-foreground"
                                    >
                                        No clinicians matched your search.
                                    </p>

                                    <p
                                        v-else
                                        class="px-3 py-3 text-xs text-muted-foreground"
                                    >
                                        Type at least 2 characters to search.
                                    </p>
                                </div>
                            </PopoverContent>
                        </Popover>
                    </template>
                </div>

                <div class="space-y-2">
                    <Label for="handoff-note">Handoff note <span class="text-muted-foreground">(optional)</span></Label>
                    <textarea
                        id="handoff-note"
                        v-model="handoffNote"
                        rows="3"
                        placeholder="e.g. Patient needs review of recent lab results before discharge..."
                        class="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                </div>
            </div>

            <DialogFooter>
                <Button variant="outline" @click="open = false">
                    Cancel
                </Button>
                <Button :disabled="!canSubmit" @click="submit">
                    <AppIcon v-if="initiateHandoff.isPending.value" name="loader-circle" class="size-4 animate-spin" />
                    <AppIcon v-else name="user-plus" class="size-4" />
                    Hand off
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>

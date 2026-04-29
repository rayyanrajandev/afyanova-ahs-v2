<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import FormFieldShell from '@/components/forms/FormFieldShell.vue';
import AdvancedSearchDialog from '@/components/lookup/AdvancedSearchDialog.vue';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

type StaffLinkableUser = {
    id: number | null;
    name: string | null;
    email: string | null;
    displayName: string;
    status: string | null;
    emailVerifiedAt: string | null;
    roleLabels: string[];
    facilityLabels: string[];
    primaryFacilityLabel: string | null;
};

type StaffLinkableUserListResponse = {
    data: StaffLinkableUser[];
};

type StaffLinkableUserResponse = {
    data: StaffLinkableUser;
};

type ValidationErrorResponse = {
    message?: string;
};

type ApiError = Error & {
    status?: number;
    payload?: ValidationErrorResponse;
};

const props = withDefaults(
    defineProps<{
        modelValue: string;
        inputId: string;
        label: string;
        placeholder?: string;
        helperText?: string;
        errorMessage?: string | null;
        disabled?: boolean;
        perPage?: number;
    }>(),
    {
        placeholder: 'Search user by name or email',
        helperText: 'Search active user accounts that do not already have a staff profile.',
        errorMessage: null,
        disabled: false,
        perPage: 10,
    },
);

const emit = defineEmits<{
    'update:modelValue': [value: string];
    selected: [user: StaffLinkableUser | null];
}>();

const searchQuery = ref('');
const selectedUser = ref<StaffLinkableUser | null>(null);
const searchResults = ref<StaffLinkableUser[]>([]);
const searchLoading = ref(false);
const hydrateLoading = ref(false);
const lookupError = ref<string | null>(null);
const accessDenied = ref(false);
const accessDeniedMessage = ref<string | null>(null);
const open = ref(false);
const advancedSearchOpen = ref(false);

let debounceTimer: number | null = null;
let suppressSearchWatch = false;

function clearDebounce() {
    if (debounceTimer !== null) {
        window.clearTimeout(debounceTimer);
        debounceTimer = null;
    }
}

function normalizeValue(value: string | number | null | undefined): string {
    return String(value ?? '').trim().toLowerCase();
}

function userSummary(user: StaffLinkableUser | null): string {
    if (!user) return '';

    return user.primaryFacilityLabel
        ? `${user.displayName} | ${user.primaryFacilityLabel}`
        : user.displayName;
}

const selectedSummary = computed(() => {
    if (selectedUser.value) {
        return userSummary(selectedUser.value);
    }

    return props.placeholder;
});

function verificationVariant(user: StaffLinkableUser): 'default' | 'secondary' | 'outline' {
    return user.emailVerifiedAt ? 'default' : 'secondary';
}

function verificationLabel(user: StaffLinkableUser): string {
    return user.emailVerifiedAt ? 'Email verified' : 'Invite pending';
}

async function apiRequest<T>(
    path: string,
    query?: Record<string, string | number | null | undefined>,
): Promise<T> {
    const url = new URL(`/api/v1${path}`, window.location.origin);

    Object.entries(query ?? {}).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '') return;
        url.searchParams.set(key, String(value));
    });

    const response = await fetch(url.toString(), {
        method: 'GET',
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
        },
    });

    const payload = (await response.json().catch(() => ({}))) as ValidationErrorResponse;

    if (!response.ok) {
        const error = new Error(payload.message ?? `${response.status} ${response.statusText}`) as ApiError;
        error.status = response.status;
        error.payload = payload;
        throw error;
    }

    return payload as T;
}

function isForbiddenError(error: unknown): boolean {
    return (error as ApiError | undefined)?.status === 403;
}

function setSearchQueryValue(value: string) {
    suppressSearchWatch = true;
    searchQuery.value = value;
    window.setTimeout(() => {
        suppressSearchWatch = false;
    }, 0);
}

async function searchUsers() {
    if (accessDenied.value) return;

    const query = searchQuery.value.trim();
    clearDebounce();

    if (query.length === 1) {
        searchResults.value = [];
        lookupError.value = null;
        return;
    }

    searchLoading.value = true;
    lookupError.value = null;

    try {
        const response = await apiRequest<StaffLinkableUserListResponse>('/staff/linkable-users', {
            q: query,
            perPage: props.perPage,
        });
        searchResults.value = response.data ?? [];
    } catch (error) {
        searchResults.value = [];

        if (isForbiddenError(error)) {
            accessDenied.value = true;
            accessDeniedMessage.value = 'User lookup is restricted by permissions.';
            open.value = false;
            advancedSearchOpen.value = false;
            return;
        }

        lookupError.value = 'Unable to search users right now.';
    } finally {
        searchLoading.value = false;
    }
}

async function hydrateSelectedUser(value: string) {
    const normalizedValue = value.trim();
    if (!normalizedValue || accessDenied.value) {
        if (!normalizedValue) {
            selectedUser.value = null;
            setSearchQueryValue('');
        }
        return;
    }

    if (selectedUser.value && normalizeValue(selectedUser.value.id) === normalizeValue(normalizedValue)) {
        if (searchQuery.value.trim()) {
            setSearchQueryValue('');
        }
        return;
    }

    hydrateLoading.value = true;
    lookupError.value = null;

    try {
        const response = await apiRequest<StaffLinkableUserResponse>(
            `/staff/linkable-users/${encodeURIComponent(normalizedValue)}`,
        );
        selectedUser.value = response.data;
        setSearchQueryValue('');
        emit('selected', response.data);
    } catch (error) {
        selectedUser.value = null;
        emit('selected', null);

        if (isForbiddenError(error)) {
            accessDenied.value = true;
            accessDeniedMessage.value = 'User lookup is restricted by permissions.';
            return;
        }

        lookupError.value = 'Selected user is not available for staff profile creation.';
        setSearchQueryValue('');
    } finally {
        hydrateLoading.value = false;
    }
}

function selectUser(user: StaffLinkableUser) {
    selectedUser.value = user;
    searchResults.value = [];
    lookupError.value = null;
    setSearchQueryValue('');
    open.value = false;
    advancedSearchOpen.value = false;
    emit('update:modelValue', String(user.id ?? ''));
    emit('selected', user);
}

function clearSelection() {
    selectedUser.value = null;
    searchResults.value = [];
    lookupError.value = null;
    setSearchQueryValue('');
    open.value = false;
    advancedSearchOpen.value = false;
    emit('update:modelValue', '');
    emit('selected', null);
}

function openAdvancedSearch() {
    advancedSearchOpen.value = true;
    open.value = false;

    if (searchResults.value.length === 0 && !searchLoading.value) {
        void searchUsers();
    }
}

const quickSearchResults = computed(() => searchResults.value.slice(0, 8));

watch(
    () => props.modelValue,
    (value) => {
        const normalizedValue = value.trim();
        if (!normalizedValue) {
            selectedUser.value = null;
            if (!searchQuery.value.trim()) {
                emit('selected', null);
            }
            return;
        }

        void hydrateSelectedUser(normalizedValue);
    },
    { immediate: true },
);

watch(searchQuery, (value, previousValue) => {
    if (suppressSearchWatch) return;

    const current = value.trim();
    const previous = (previousValue ?? '').trim();
    if (current === previous) return;

    if (selectedUser.value && current.length > 0) {
        selectedUser.value = null;
        emit('update:modelValue', '');
        emit('selected', null);
    }

    clearDebounce();
    debounceTimer = window.setTimeout(() => {
        void searchUsers();
        debounceTimer = null;
    }, 300);
});

watch(advancedSearchOpen, (value) => {
    if (value) {
        open.value = false;
    }
});

watch(open, (value) => {
    if (!value) {
        searchResults.value = [];
        lookupError.value = null;
        if (!advancedSearchOpen.value) {
            searchQuery.value = '';
        }
        return;
    }

    void nextTick(() => {
        const searchInput = document.getElementById(`${props.inputId}-search`) as HTMLInputElement | null;
        searchInput?.focus();
        searchInput?.select();
    });

    if (!searchQuery.value.trim() && searchResults.value.length === 0 && !searchLoading.value) {
        void searchUsers();
    }
});

onBeforeUnmount(clearDebounce);

const hasSelection = computed(() => Boolean(props.modelValue.trim() || selectedUser.value));
</script>

<template>
    <FormFieldShell
        :input-id="inputId"
        :label="label"
        :helper-text="helperText"
        :error-message="errorMessage"
    >
        <template v-if="accessDenied">
            <Button
                :id="inputId"
                type="button"
                variant="outline"
                class="h-10 w-full justify-between px-3 font-normal"
                disabled
            >
                <span class="truncate text-left text-muted-foreground">
                    {{ placeholder }}
                </span>
                <AppIcon name="search" class="size-4 shrink-0 text-muted-foreground" />
            </Button>

            <Alert variant="destructive">
                <AlertDescription class="text-xs">
                    {{ accessDeniedMessage }}
                </AlertDescription>
            </Alert>
        </template>

        <template v-else>
            <Popover v-model:open="open">
                <PopoverTrigger as-child>
                    <Button
                        :id="inputId"
                        type="button"
                        variant="outline"
                        class="h-10 w-full justify-between px-3 font-normal"
                        :class="{ 'border-destructive': Boolean(errorMessage) }"
                        :disabled="disabled"
                    >
                        <span
                            class="truncate text-left"
                            :class="{ 'text-muted-foreground': !hasSelection }"
                        >
                            {{ selectedSummary }}
                        </span>
                        <AppIcon name="search" class="size-4 shrink-0 text-muted-foreground" />
                    </Button>
                </PopoverTrigger>

                <PopoverContent align="start" class="w-[var(--reka-popover-trigger-width)] rounded-lg p-0">
                    <div class="border-b p-2">
                        <Input
                            :id="`${inputId}-search`"
                            v-model="searchQuery"
                            :placeholder="placeholder"
                            class="h-9"
                            autocomplete="off"
                        />
                    </div>

                    <div class="max-h-72 space-y-1 overflow-y-auto p-1.5">
                        <div
                            v-if="searchLoading || hydrateLoading"
                            class="px-3 py-3 text-xs text-muted-foreground"
                        >
                            Searching users...
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

                        <template v-else-if="quickSearchResults.length > 0">
                            <button
                                v-for="user in quickSearchResults"
                                :key="`staff-user-quick-${user.id}`"
                                type="button"
                                class="flex w-full flex-col items-start gap-1 rounded-md px-3 py-2 text-left text-sm hover:bg-muted/50"
                                @click="selectUser(user)"
                            >
                                <div class="flex w-full flex-wrap items-center gap-2">
                                    <span class="font-medium">{{ user.displayName }}</span>
                                    <Badge v-if="user.primaryFacilityLabel" variant="outline">
                                        {{ user.primaryFacilityLabel }}
                                    </Badge>
                                    <Badge :variant="verificationVariant(user)">
                                        {{ verificationLabel(user) }}
                                    </Badge>
                                </div>
                                <span class="text-xs text-muted-foreground">
                                    <template v-if="user.email">
                                        {{ user.email }}
                                    </template>
                                    <template v-if="user.email && user.roleLabels[0]">
                                        |
                                    </template>
                                    <template v-if="user.roleLabels[0]">
                                        {{ user.roleLabels[0] }}
                                    </template>
                                    <template v-if="user.roleLabels.length > 1">
                                        | +{{ user.roleLabels.length - 1 }} more roles
                                    </template>
                                </span>
                            </button>
                        </template>

                        <p
                            v-else-if="searchQuery.trim().length === 1"
                            class="px-3 py-3 text-xs text-muted-foreground"
                        >
                            Type at least 2 characters to search users.
                        </p>

                        <p
                            v-else-if="searchQuery.trim().length > 1"
                            class="px-3 py-3 text-xs text-muted-foreground"
                        >
                            No eligible users matched your search.
                        </p>

                        <p
                            v-else
                            class="px-3 py-3 text-xs text-muted-foreground"
                        >
                            No eligible users are available right now.
                        </p>
                    </div>

                    <div class="flex items-center justify-between border-t bg-muted/20 p-2">
                        <p
                            v-if="quickSearchResults.length > 0"
                            class="text-[11px] text-muted-foreground"
                        >
                            {{ quickSearchResults.length }} result{{ quickSearchResults.length === 1 ? '' : 's' }}
                        </p>
                        <span v-else class="text-[11px] text-muted-foreground"></span>

                        <div class="flex items-center gap-2">
                            <Button
                                v-if="hasSelection"
                                type="button"
                                size="sm"
                                variant="ghost"
                                class="h-8 px-3 text-xs"
                                :disabled="disabled"
                                @click="clearSelection"
                            >
                                Clear
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                class="h-8 shrink-0 px-3 text-xs"
                                :disabled="disabled"
                                @click="openAdvancedSearch"
                            >
                                Advanced search
                            </Button>
                        </div>
                    </div>
                </PopoverContent>
            </Popover>
        </template>

        <AdvancedSearchDialog
            :open="advancedSearchOpen"
            title="Advanced user search"
            description="Search active user accounts, compare facilities and roles, then link the correct person to a staff profile."
            :search-input-id="`${inputId}-advanced`"
            search-label="Search users"
            search-placeholder="Search by name or email"
            :query="searchQuery"
            :error-message="lookupError"
            @update:open="advancedSearchOpen = $event"
            @update:query="searchQuery = $event"
        >
            <template v-if="searchLoading || hydrateLoading">
                <p class="text-sm text-muted-foreground">
                    Searching users...
                </p>
            </template>

            <template v-else-if="searchResults.length > 0">
                <div class="mb-3 text-xs text-muted-foreground">
                    {{ searchResults.length }} match{{ searchResults.length === 1 ? '' : 'es' }} found.
                </div>
                <div class="overflow-x-auto">
                    <table class="min-w-full text-sm">
                        <thead class="border-b bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                            <tr>
                                <th class="px-3 py-2 text-left font-medium">User</th>
                                <th class="px-3 py-2 text-left font-medium">Email</th>
                                <th class="px-3 py-2 text-left font-medium">Facility</th>
                                <th class="px-3 py-2 text-left font-medium">Role</th>
                                <th class="px-3 py-2 text-left font-medium">Verification</th>
                                <th class="px-3 py-2 text-right font-medium">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr
                                v-for="user in searchResults"
                                :key="`staff-user-advanced-${user.id}`"
                                class="border-b align-top last:border-b-0"
                            >
                                <td class="px-3 py-3">
                                    <div class="font-medium text-foreground">{{ user.displayName }}</div>
                                </td>
                                <td class="px-3 py-3 text-muted-foreground">
                                    {{ user.email || 'No email recorded' }}
                                </td>
                                <td class="px-3 py-3 text-muted-foreground">
                                    {{ user.primaryFacilityLabel || 'No active facility' }}
                                </td>
                                <td class="px-3 py-3 text-muted-foreground">
                                    {{ user.roleLabels[0] || 'No role assigned' }}
                                    <span v-if="user.roleLabels.length > 1">
                                        | +{{ user.roleLabels.length - 1 }} more
                                    </span>
                                </td>
                                <td class="px-3 py-3">
                                    <Badge :variant="verificationVariant(user)">
                                        {{ verificationLabel(user) }}
                                    </Badge>
                                </td>
                                <td class="px-3 py-3 text-right">
                                    <Button type="button" size="sm" variant="outline" @click="selectUser(user)">
                                        Select
                                    </Button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </template>

            <p
                v-else-if="searchQuery.trim().length === 1"
                class="text-sm text-muted-foreground"
            >
                Type at least 2 characters to search users.
            </p>

            <p
                v-else-if="searchQuery.trim().length > 1"
                class="text-sm text-muted-foreground"
            >
                No eligible users matched your search.
            </p>

            <p
                v-else
                class="text-sm text-muted-foreground"
            >
                No eligible users are available right now.
            </p>
        </AdvancedSearchDialog>
    </FormFieldShell>
</template>

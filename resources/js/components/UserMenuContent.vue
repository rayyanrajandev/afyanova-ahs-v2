<script setup lang="ts">
import { Link, router } from '@inertiajs/vue3';
import AppIcon from '@/components/AppIcon.vue';
import {
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import UserInfo from '@/components/UserInfo.vue';
import type { AppIconName } from '@/lib/icons';
import { logout } from '@/routes';
import type { User } from '@/types';

type Props = {
    user: User;
};

type HelpLink = {
    title: string;
    href: string;
    iconName: AppIconName;
};

const helpLinks: HelpLink[] = [
    { title: 'Help & Shortcuts', href: '/help/shortcuts', iconName: 'book-open' },
    { title: 'OPD Sprint Status', href: '/docs/opd-ui-sprint1-workflow-status', iconName: 'folder' },
    { title: 'Project Restructure Plan', href: '/docs/project-restructure-plan', iconName: 'folder' },
    { title: 'Controlled Breadth Plan', href: '/docs/controlled-breadth-first-plan', iconName: 'folder' },
    { title: 'Radiology v1 Contract', href: '/docs/radiology-v1-contract', iconName: 'folder' },
    { title: 'Emergency & Triage v1 Contract', href: '/docs/emergency-triage-v1-contract', iconName: 'folder' },
    {
        title: 'Inpatient Ward v1 Contract',
        href: '/docs/inpatient-ward-operations-v1-contract',
        iconName: 'folder',
    },
    {
        title: 'Theatre/Procedure v1 Contract',
        href: '/docs/theatre-procedure-workflow-v1-contract',
        iconName: 'folder',
    },
    {
        title: 'Claims/Insurance v1 Contract',
        href: '/docs/claims-insurance-adjudication-v1-contract',
        iconName: 'folder',
    },
    {
        title: 'Inventory/Procurement v1 Contract',
        href: '/docs/inventory-procurement-stores-v1-contract',
        iconName: 'folder',
    },
    {
        title: 'Billing Payer Contract v1 Contract',
        href: '/docs/billing-payer-contract-auth-rules-v1-contract',
        iconName: 'folder',
    },
    {
        title: 'Billing Service Catalog v1 Contract',
        href: '/docs/billing-service-catalog-v1-contract',
        iconName: 'folder',
    },
    {
        title: 'Clinical Catalog Governance v1 Contract',
        href: '/docs/clinical-catalog-governance-v1-contract',
        iconName: 'folder',
    },
    {
        title: 'Facility Config/Ownership v1 Contract',
        href: '/docs/platform-facility-configuration-and-ownership-v1-contract',
        iconName: 'folder',
    },
];

const handleLogout = () => {
    router.flushAll();
};

defineProps<Props>();

const emit = defineEmits<{
    (e: 'open-settings'): void;
}>();
</script>

<template>
    <DropdownMenuLabel class="p-0 font-normal">
        <div class="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
            <UserInfo :user="user" :show-email="true" />
        </div>
    </DropdownMenuLabel>

    <DropdownMenuSeparator />

    <DropdownMenuGroup>
        <DropdownMenuItem @select="emit('open-settings')">
            <AppIcon name="layout-grid" class="size-4" />
            Settings
        </DropdownMenuItem>

        <DropdownMenuSub>
            <DropdownMenuSubTrigger class="gap-2">
                <AppIcon name="book-open" class="size-4" />
                Help & Docs
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent class="w-72 p-0">
                <ScrollArea class="max-h-80">
                    <div class="p-1 pb-2">
                        <DropdownMenuItem
                            v-for="item in helpLinks"
                            :key="item.href"
                            :as-child="true"
                        >
                            <a
                                :href="item.href"
                                target="_blank"
                                rel="noopener noreferrer"
                                class="flex w-full items-center gap-2"
                            >
                                <AppIcon :name="item.iconName" class="size-4" />
                                <span class="truncate">{{ item.title }}</span>
                            </a>
                        </DropdownMenuItem>
                    </div>
                </ScrollArea>
            </DropdownMenuSubContent>
        </DropdownMenuSub>
    </DropdownMenuGroup>

    <DropdownMenuSeparator />

    <DropdownMenuItem :as-child="true">
        <Link
            class="flex w-full cursor-pointer items-center gap-2"
            :href="logout()"
            @click="handleLogout"
            as="button"
            data-test="logout-button"
        >
            <AppIcon name="shield-check" class="size-4" />
            Log out
        </Link>
    </DropdownMenuItem>
</template>

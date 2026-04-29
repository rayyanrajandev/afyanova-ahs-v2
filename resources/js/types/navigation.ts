import type { InertiaLinkProps } from '@inertiajs/vue3';
import type { Component } from 'vue';
import type { AppIconName } from '@/lib/icons';

export type BreadcrumbItem = {
    title: string;
    href?: string;
};

export type NavItem = {
    title: string;
    href: NonNullable<InertiaLinkProps['href']>;
    icon?: Component;
    iconName?: AppIconName;
    isActive?: boolean;
};

<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import {
    Activity,
    ArrowRight,
    Building2,
    Monitor,
    Moon,
    ShieldCheck,
    Stethoscope,
    Sun,
} from 'lucide-vue-next';
import AppBrandMark from '@/components/AppBrandMark.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useAppearance } from '@/composables/useAppearance';
import { useBranding } from '@/composables/useBranding';
import { dashboard, login, register } from '@/routes';

withDefaults(
    defineProps<{
        canRegister: boolean;
    }>(),
    {
        canRegister: true,
    },
);

const { branding, displayName, systemName, hasCustomLogo } = useBranding();
const { appearance, updateAppearance } = useAppearance();

const platformSignals = [
    {
        title: 'Clinical operations',
        description:
            'Coordinate queues, consultations, and downstream orders from one workspace.',
        icon: Stethoscope,
    },
    {
        title: 'Facility aware',
        description:
            'Support multi-facility workflows with clear operational context and safe handoffs.',
        icon: Building2,
    },
    {
        title: 'Governed access',
        description:
            'Protect sensitive patient and financial workflows with role-based access controls.',
        icon: ShieldCheck,
    },
];

const workflowChips = [
    'Patients',
    'Appointments',
    'Admissions',
    'Medical Records',
    'Laboratory',
    'Pharmacy',
    'Billing',
];

const themeTabs = [
    { value: 'light', Icon: Sun, label: 'Light' },
    { value: 'dark', Icon: Moon, label: 'Dark' },
    { value: 'system', Icon: Monitor, label: 'System' },
] as const;
</script>

<template>
    <Head title="Welcome" />

    <div class="relative min-h-screen overflow-hidden bg-background text-foreground">
        <!-- Decorative background gradients -->
        <div
            class="pointer-events-none absolute inset-0"
            aria-hidden="true"
        >
            <div
                class="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.06),_transparent_32%),radial-gradient(circle_at_85%_20%,_rgba(251,191,36,0.05),_transparent_24%)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_32%),radial-gradient(circle_at_85%_20%,_rgba(251,191,36,0.14),_transparent_24%)]"
            />
        </div>
        <div
            class="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent"
            aria-hidden="true"
        />

        <div
            class="relative flex min-h-screen w-full flex-col px-6 py-6 sm:px-8 lg:px-10 xl:px-14 2xl:px-20"
        >
            <!-- Header -->
            <header
                class="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6"
            >
                <div class="flex items-center gap-4">
                    <div
                        class="flex h-14 w-14 items-center justify-center rounded-lg border border-border bg-card shadow-sm"
                    >
                        <AppBrandMark
                            :branding="branding"
                            :class-name="
                                hasCustomLogo
                                    ? 'size-10 object-contain'
                                    : 'size-8 text-primary'
                            "
                        />
                    </div>
                    <div>
                        <p
                            class="text-xs font-semibold uppercase tracking-[0.24em] text-primary"
                        >
                            Digital Health Platform
                        </p>
                        <h1 class="mt-1 text-xl font-semibold tracking-tight">
                            {{ displayName }}
                        </h1>
                    </div>
                </div>

                <div class="flex items-center gap-3">
                    <!-- Theme toggle -->
                    <div
                        class="inline-flex items-center gap-0.5 rounded-lg border border-border bg-muted/50 p-0.5"
                        role="group"
                        aria-label="Color theme"
                    >
                        <button
                            v-for="{ value, Icon, label } in themeTabs"
                            :key="value"
                            type="button"
                            @click="updateAppearance(value)"
                            :title="label"
                            :aria-pressed="appearance === value"
                            :class="[
                                'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all duration-150',
                                appearance === value
                                    ? 'bg-background text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground',
                            ]"
                        >
                            <component :is="Icon" class="size-3.5" />
                            <span class="hidden sm:inline">{{ label }}</span>
                        </button>
                    </div>

                    <Separator orientation="vertical" class="h-6" />

                    <!-- Nav links -->
                    <nav class="flex items-center gap-2">
                        <Button v-if="$page.props.auth.user" as-child>
                            <Link :href="dashboard()">
                                Go to dashboard
                                <ArrowRight />
                            </Link>
                        </Button>
                        <template v-else>
                            <Button variant="ghost" as-child>
                                <Link :href="login()">Log in</Link>
                            </Button>
                            <Button v-if="canRegister" as-child>
                                <Link :href="register()">Get started</Link>
                            </Button>
                        </template>
                    </nav>
                </div>
            </header>

            <!-- Main -->
            <main
                class="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(400px,0.9fr)] lg:gap-16 lg:py-14 xl:grid-cols-[minmax(0,1.5fr)_minmax(460px,0.9fr)]"
            >
                <!-- Left: Hero -->
                <section class="w-full lg:pr-8 xl:pr-14">
                    <Badge variant="secondary" class="gap-2 px-4 py-2 text-xs uppercase tracking-[0.18em]">
                        <Activity class="size-3.5" />
                        {{ hasCustomLogo ? 'Custom identity active' : 'Afyanova identity ready' }}
                    </Badge>

                    <h2
                        class="mt-6 text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl"
                    >
                        {{ systemName }}
                        <span class="block text-muted-foreground">
                            built for modern care operations.
                        </span>
                    </h2>

                    <p class="mt-6 max-w-3xl text-lg leading-8 text-muted-foreground xl:max-w-4xl">
                        Run clinical, operational, and platform workflows from one
                        coordinated workspace with clearer branding, safer access,
                        and a system identity teams can actually recognize.
                    </p>

                    <div class="mt-8 flex flex-wrap gap-3">
                        <Button v-if="$page.props.auth.user" size="lg" as-child>
                            <Link :href="dashboard()">
                                Open workspace
                                <ArrowRight />
                            </Link>
                        </Button>
                        <template v-else>
                            <Button size="lg" as-child>
                                <Link :href="login()">
                                    Log in to continue
                                    <ArrowRight />
                                </Link>
                            </Button>
                            <Button v-if="canRegister" size="lg" variant="outline" as-child>
                                <Link :href="register()">Create account</Link>
                            </Button>
                        </template>
                    </div>

                    <div class="mt-10 flex flex-wrap gap-2">
                        <Badge
                            v-for="chip in workflowChips"
                            :key="chip"
                            variant="outline"
                            class="px-3 py-1.5 text-sm font-normal"
                        >
                            {{ chip }}
                        </Badge>
                    </div>
                </section>

                <!-- Right: Feature cards -->
                <section class="w-full lg:max-w-2xl lg:justify-self-end">
                    <div class="space-y-3">
                        <!-- Platform identity card -->
                        <Card>
                            <CardContent>
                                <div class="flex items-start justify-between gap-4">
                                    <div class="min-w-0">
                                        <p
                                            class="text-xs font-semibold uppercase tracking-[0.2em] text-primary"
                                        >
                                            Platform identity
                                        </p>
                                        <h3 class="mt-2 text-2xl font-semibold">
                                            {{ systemName }}
                                        </h3>
                                        <p class="mt-2 text-sm leading-6 text-muted-foreground">
                                            One name, one logo, and one recognizable
                                            experience across authentication, navigation,
                                            browser titles, and notifications.
                                        </p>
                                    </div>
                                    <div
                                        class="flex size-16 shrink-0 items-center justify-center rounded-lg border border-border bg-muted"
                                    >
                                        <AppBrandMark
                                            :branding="branding"
                                            :class-name="
                                                hasCustomLogo
                                                    ? 'size-12 object-contain'
                                                    : 'size-10 text-primary'
                                            "
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <!-- Feature signal cards -->
                        <div class="grid gap-3 sm:grid-cols-3">
                            <Card
                                v-for="signal in platformSignals"
                                :key="signal.title"
                                class="gap-3"
                            >
                                <CardContent>
                                    <component
                                        :is="signal.icon"
                                        class="size-5 text-warning"
                                    />
                                    <h4 class="mt-3 text-sm font-semibold">
                                        {{ signal.title }}
                                    </h4>
                                    <p class="mt-1.5 text-sm leading-6 text-muted-foreground">
                                        {{ signal.description }}
                                    </p>
                                </CardContent>
                            </Card>
                        </div>

                        <!-- Ready for teams card -->
                        <Card class="border-success/25 bg-success/5">
                            <CardContent>
                                <p
                                    class="text-xs font-semibold uppercase tracking-[0.18em] text-success"
                                >
                                    Ready for teams
                                </p>
                                <div class="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                                    <div class="rounded-md bg-background/70 p-4 dark:bg-muted/40">
                                        <p class="font-medium">Cleaner first impression</p>
                                        <p class="mt-1 text-muted-foreground">
                                            Staff see Afyanova branding immediately instead
                                            of starter-kit defaults.
                                        </p>
                                    </div>
                                    <div class="rounded-md bg-background/70 p-4 dark:bg-muted/40">
                                        <p class="font-medium">Scalable settings model</p>
                                        <p class="mt-1 text-muted-foreground">
                                            Branding now has a dedicated settings layer that
                                            can expand beyond name and logo.
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </section>
            </main>
        </div>
    </div>
</template>

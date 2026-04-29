<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import {
    Activity,
    ArrowRight,
    Building2,
    ShieldCheck,
    Stethoscope,
} from 'lucide-vue-next';
import AppBrandMark from '@/components/AppBrandMark.vue';
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
</script>

<template>
    <Head title="Welcome" />

    <div class="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
        <div
            class="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.2),_transparent_32%),radial-gradient(circle_at_85%_20%,_rgba(251,191,36,0.16),_transparent_24%),linear-gradient(180deg,_rgba(15,23,42,0.96),_rgba(2,6,23,1))]"
        />
        <div
            class="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/50 to-transparent"
        />

        <div
            class="relative flex min-h-screen w-full flex-col px-6 py-6 sm:px-8 lg:px-10 xl:px-14 2xl:px-20"
        >
            <header
                class="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6"
            >
                <div class="flex items-center gap-4">
                    <div
                        class="flex h-14 w-14 items-center justify-center rounded-lg border border-white/15 bg-white/10 shadow-[0_20px_60px_-30px_rgba(16,185,129,0.8)] backdrop-blur"
                    >
                        <AppBrandMark
                            :branding="branding"
                            :class-name="
                                hasCustomLogo
                                    ? 'size-10 object-contain'
                                    : 'size-8 text-emerald-300'
                            "
                        />
                    </div>
                    <div>
                        <p
                            class="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300/90"
                        >
                            Digital Health Platform
                        </p>
                        <h1 class="mt-1 text-xl font-semibold tracking-tight text-white">
                            {{ displayName }}
                        </h1>
                    </div>
                </div>

                <nav class="flex items-center gap-3 text-sm">
                    <Link
                        v-if="$page.props.auth.user"
                        :href="dashboard()"
                        class="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-white transition hover:border-emerald-300/40 hover:bg-white/15"
                    >
                        Go to dashboard
                        <ArrowRight class="size-4" />
                    </Link>
                    <template v-else>
                        <Link
                            :href="login()"
                            class="inline-flex items-center rounded-full px-4 py-2 text-slate-200 transition hover:bg-white/10 hover:text-white"
                        >
                            Log in
                        </Link>
                        <Link
                            v-if="canRegister"
                            :href="register()"
                            class="inline-flex items-center rounded-full bg-emerald-400 px-4 py-2 font-medium text-slate-950 transition hover:bg-emerald-300"
                        >
                            Get started
                        </Link>
                    </template>
                </nav>
            </header>

            <main
                class="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(400px,0.9fr)] lg:gap-16 lg:py-14 xl:grid-cols-[minmax(0,1.5fr)_minmax(460px,0.9fr)]"
            >
                <section class="w-full lg:pr-8 xl:pr-14">
                    <div
                        class="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-emerald-200"
                    >
                        <Activity class="size-4" />
                        {{ hasCustomLogo ? 'Custom identity active' : 'Afyanova identity ready' }}
                    </div>

                    <h2
                        class="mt-6 max-w-none text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl xl:max-w-6xl"
                    >
                        {{ systemName }}
                        <span class="block text-slate-300">
                            built for modern care operations.
                        </span>
                    </h2>

                    <p class="mt-6 max-w-3xl text-lg leading-8 text-slate-300 xl:max-w-4xl">
                        Run clinical, operational, and platform workflows from one
                        coordinated workspace with clearer branding, safer access,
                        and a system identity teams can actually recognize.
                    </p>

                    <div class="mt-8 flex flex-wrap gap-3">
                        <Link
                            v-if="$page.props.auth.user"
                            :href="dashboard()"
                            class="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 font-medium text-slate-950 transition hover:bg-slate-100"
                        >
                            Open workspace
                            <ArrowRight class="size-4" />
                        </Link>
                        <template v-else>
                            <Link
                                :href="login()"
                                class="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 font-medium text-slate-950 transition hover:bg-slate-100"
                            >
                                Log in to continue
                                <ArrowRight class="size-4" />
                            </Link>
                            <Link
                                v-if="canRegister"
                                :href="register()"
                                class="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-5 py-3 font-medium text-white transition hover:border-emerald-300/40 hover:bg-white/15"
                            >
                                Create account
                            </Link>
                        </template>
                    </div>

                    <div class="mt-10 flex flex-wrap gap-2">
                        <span
                            v-for="chip in workflowChips"
                            :key="chip"
                            class="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-300"
                        >
                            {{ chip }}
                        </span>
                    </div>
                </section>

                <section class="relative w-full lg:max-w-2xl lg:justify-self-end">
                    <div
                        class="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-emerald-400/20 via-transparent to-amber-300/10 blur-2xl"
                    />
                    <div
                        class="relative space-y-4 rounded-[2rem] border border-white/10 bg-white/8 p-5 shadow-2xl shadow-slate-950/40 backdrop-blur-xl sm:p-6"
                    >
                        <div
                            class="rounded-[1.5rem] border border-white/10 bg-slate-950/70 p-5"
                        >
                            <div class="flex items-start justify-between gap-4">
                                <div>
                                    <p
                                        class="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300/80"
                                    >
                                        Platform identity
                                    </p>
                                    <h3 class="mt-2 text-2xl font-semibold text-white">
                                        {{ systemName }}
                                    </h3>
                                    <p class="mt-2 text-sm leading-6 text-slate-300">
                                        One name, one logo, and one recognizable
                                        experience across authentication, navigation,
                                        browser titles, and notifications.
                                    </p>
                                </div>
                                <div
                                    class="flex h-16 w-16 items-center justify-center rounded-lg border border-white/10 bg-white/10"
                                >
                                    <AppBrandMark
                                        :branding="branding"
                                        :class-name="
                                            hasCustomLogo
                                                ? 'size-12 object-contain'
                                                : 'size-10 text-emerald-300'
                                        "
                                    />
                                </div>
                            </div>
                        </div>

                        <div class="grid gap-3 sm:grid-cols-3">
                            <article
                                v-for="signal in platformSignals"
                                :key="signal.title"
                                class="rounded-[1.25rem] border border-white/10 bg-white/6 p-4"
                            >
                                <component
                                    :is="signal.icon"
                                    class="size-5 text-amber-300"
                                />
                                <h4 class="mt-4 text-sm font-semibold text-white">
                                    {{ signal.title }}
                                </h4>
                                <p class="mt-2 text-sm leading-6 text-slate-300">
                                    {{ signal.description }}
                                </p>
                            </article>
                        </div>

                        <div
                            class="rounded-[1.5rem] border border-emerald-400/20 bg-emerald-400/10 p-5"
                        >
                            <p
                                class="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200"
                            >
                                Ready for teams
                            </p>
                            <div
                                class="mt-3 grid gap-3 text-sm text-emerald-50 sm:grid-cols-2"
                            >
                                <div class="rounded-lg bg-slate-950/35 p-4">
                                    <p class="font-medium">Cleaner first impression</p>
                                    <p class="mt-1 text-emerald-50/80">
                                        Staff see Afyanova branding immediately instead
                                        of starter-kit defaults.
                                    </p>
                                </div>
                                <div class="rounded-lg bg-slate-950/35 p-4">
                                    <p class="font-medium">Scalable settings model</p>
                                    <p class="mt-1 text-emerald-50/80">
                                        Branding now has a dedicated settings layer that
                                        can expand beyond name and logo.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    </div>
</template>

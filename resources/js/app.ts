import { createInertiaApp } from '@inertiajs/vue3';
import { configureEcho } from '@laravel/echo-vue';
import { VueQueryPlugin } from '@tanstack/vue-query';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createPinia } from 'pinia';
import type { DefineComponent } from 'vue';
import { createApp, Fragment, h } from 'vue';
import 'vue-sonner/style.css';
import '../css/app.css';
import { Toaster } from './components/ui/sonner';
import { initializeTheme } from './composables/useAppearance';
import { initializeUiPreferences } from './composables/useUiPreferences';
import { buildDocumentTitle, syncClientBranding } from './lib/branding';
import { purgeKnownSensitiveBrowserStorage } from './lib/browserStoragePolicy';
import { createAppQueryClient } from './lib/queryClient';

// Patient-Flow Board live updates (Phase 2): reads VITE_REVERB_* env vars and
// the existing <meta name="csrf-token"> tag by default — no custom
// authorizer needed, this app's session-cookie auth is exactly what Echo's
// default Reverb/Pusher-protocol authorizer already expects.
configureEcho({
    broadcaster: 'reverb',
});

syncClientBranding(
    typeof window !== 'undefined' ? window.__AFYANOVA_BRANDING__ : undefined,
);

initializeTheme();
initializeUiPreferences();
purgeKnownSensitiveBrowserStorage();

createInertiaApp({
    title: (title) => buildDocumentTitle(title),
    resolve: (name) =>
        resolvePageComponent(
            `./pages/${name}.vue`,
            import.meta.glob<DefineComponent>('./pages/**/*.vue'),
        ),
    setup({ el, App, props, plugin }) {
        createApp({
            render: () => h(Fragment, null, [h(App, props), h(Toaster)]),
        })
            .use(plugin)
            .use(createPinia())
            .use(VueQueryPlugin, { queryClient: createAppQueryClient() })
            .mount(el);
    },
    progress: {
        color: '#4B5563',
    },
});

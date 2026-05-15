import { createInertiaApp } from '@inertiajs/vue3';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import type { DefineComponent } from 'vue';
import { createApp, Fragment, h } from 'vue';
import 'vue-sonner/style.css';
import '../css/app.css';
import { Toaster } from './components/ui/sonner';
import { initializeTheme } from './composables/useAppearance';
import { initializeUiPreferences } from './composables/useUiPreferences';
import { purgeKnownSensitiveBrowserStorage } from './lib/browserStoragePolicy';
import { buildDocumentTitle, syncClientBranding } from './lib/branding';

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
            render: () =>
                h(Fragment, null, [
                    h(App, props),
                    h(Toaster, { richColors: true }),
                ]),
        })
            .use(plugin)
            .mount(el);
    },
    progress: {
        color: '#4B5563',
    },
});

import { createInertiaApp } from '@inertiajs/vue3';
import createServer from '@inertiajs/vue3/server';
import { VueQueryPlugin } from '@tanstack/vue-query';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createPinia } from 'pinia';
import type { DefineComponent } from 'vue';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { buildSsrDocumentTitle } from './lib/branding';
import { createAppQueryClient } from './lib/queryClient';

createServer(
    (page) =>
        createInertiaApp({
            page,
            render: renderToString,
            title: (title) =>
                buildSsrDocumentTitle(
                    title,
                    (page.props as { branding?: unknown }).branding,
                ),
            resolve: (name) =>
                resolvePageComponent(
                    `./pages/${name}.vue`,
                    import.meta.glob<DefineComponent>('./pages/**/*.vue'),
                ),
            // Fresh Pinia + QueryClient per render — SSR must not share cache/state
            // across requests for different users.
            setup: ({ App, props, plugin }) =>
                createSSRApp({ render: () => h(App, props) })
                    .use(plugin)
                    .use(createPinia())
                    .use(VueQueryPlugin, { queryClient: createAppQueryClient() }),
        }),
    { cluster: true },
);

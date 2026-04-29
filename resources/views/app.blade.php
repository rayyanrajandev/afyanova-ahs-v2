<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}"  @class(['dark' => ($appearance ?? 'system') == 'dark'])>
    <head>
        @php($branding = app(\App\Support\Branding\SystemBrandingManager::class)->publicBranding())
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="csrf-token" content="{{ csrf_token() }}">
        <meta name="application-name" content="{{ $branding['systemName'] }}">

        {{-- Inline script to detect system dark mode preference and apply it immediately --}}
        <script>
            (function() {
                const appearance = '{{ $appearance ?? "system" }}';

                if (appearance === 'system') {
                    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

                    if (prefersDark) {
                        document.documentElement.classList.add('dark');
                    }
                }
            })();
        </script>

        {{-- Inline surface so the browser paints the real theme before Vue mounts --}}
        <style>
            html,
            body {
                min-height: 100%;
                background-color: hsl(0 0% 98%);
                color-scheme: light;
            }

            html.dark,
            html.dark body {
                background-color: hsl(0 0% 12%);
                color-scheme: dark;
            }

            body {
                margin: 0;
            }
        </style>

        <title inertia>{{ $branding['systemName'] }}</title>

        <script>
            window.__AFYANOVA_BRANDING__ = @json($branding);
        </script>

        <link id="app-favicon" rel="icon" href="{{ $branding['appIconUrl'] }}" type="image/png">
        <link id="app-apple-touch-icon" rel="apple-touch-icon" href="{{ $branding['appIconUrl'] }}">

        <link rel="preconnect" href="https://fonts.bunny.net">
        <link href="https://fonts.bunny.net/css?family=instrument-sans:400,500,600" rel="stylesheet" />

        @vite(['resources/js/app.ts', "resources/js/pages/{$page['component']}.vue"])
        @inertiaHead
    </head>
    <body class="font-sans antialiased">
        @inertia
    </body>
</html>

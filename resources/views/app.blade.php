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

        {{-- Inline script to apply UI scale before first paint to prevent FOUC --}}
        <script>
            (function() {
                var UI_SCALE_FONT_SIZE_MAP = {
                    'ultra-compact': '12px',
                    'extra-compact': '12.8px',
                    'compact': '14px',
                    'comfortable': '16px',
                    'spacious': '18px'
                };
                var validScales = Object.keys(UI_SCALE_FONT_SIZE_MAP);
                var stored = localStorage.getItem('ui.scale-preset');
                var scale = (stored && validScales.indexOf(stored) !== -1) ? stored : 'comfortable';
                document.documentElement.dataset.uiScale = scale;
                document.documentElement.style.fontSize = UI_SCALE_FONT_SIZE_MAP[scale];
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

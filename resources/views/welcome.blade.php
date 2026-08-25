<!DOCTYPE html>
<html lang="pt-br">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>SkyMaps GPS</title>
    
    <link rel="icon" type="image/svg+xml" href="/favicon.svg">
    <link rel="icon" type="image/x-icon" href="/favicon.ico">
    <link rel="apple-touch-icon" href="/icons/icon-192x192.png">
    <link rel="manifest" href="/manifest.json">
    <meta name="theme-color" content="#1a1a1a">

    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>

<body class="bg-slate-900 overflow-hidden">
    <div id="app"></div>

    <script>
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js')
                    .then((reg) => console.log('Service Worker registrado:', reg.scope))
                    .catch((err) => console.error('Erro ao registrar Service Worker:', err));
            });
        }
    </script>
</body>

</html>
import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
    plugins: [
        tailwindcss(),
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.js'],
            refresh: true,
        }),
        vue(),
        VitePWA({
            outDir: 'public',
            buildBase: '/',
            scope: '/',
            registerType: 'autoUpdate',
            filename: 'sw.js',
            manifestFilename: 'manifest.json',
            manifest: {
                name: 'SkyMaps',
                short_name: 'SkyMaps',
                description: 'Seu mapa GPS',
                start_url: '/',
                display: 'standalone',
                background_color: '#ffffff',
                theme_color: '#1a1a1a',
                icons: [
                    {
                        src: '/icons/icon-192x192.png',
                        sizes: '192x192',
                        type: 'image/png'
                    },
                    {
                        src: '/icons/icon-512x512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'any maskable'
                    }
                ]
            }
        })
    ],
    resolve: {
        alias: {
            vue: 'vue/dist/vue.esm-bundler.js',
        },
    },
});
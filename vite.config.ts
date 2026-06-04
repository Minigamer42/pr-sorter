import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { localCustomizeWriter } from './dev/localCustomizeWriter';
import type { Plugin } from 'vite';

const activeRoute = process.env.VITE_PAGES_PREVIEW === 'true'
    ? '/src/routes/PagesPreviewRoute.tsx'
    : process.env.VITE_SORTER_INDEX === 'true'
        ? '/src/routes/SorterIndexRoute.tsx'
        : '/src/routes/SorterAppRoute.tsx';

export default defineConfig({
    base: './',
    resolve: {
        alias: {
            'active-route': activeRoute,
        },
    },
    plugins: [react(), localCustomizeWriter(), pagesPreviewAssetRewrite()],
});

function pagesPreviewAssetRewrite(): Plugin {
    return {
        name: 'pages-preview-asset-rewrite',
        configureServer(server) {
            if (process.env.VITE_PAGES_PREVIEW !== 'true') {
                return;
            }

            server.middlewares.use((request, _response, next) => {
                if (!request.url) {
                    next();
                    return;
                }

                if (request.url === '/test/style.css') {
                    request.url = '/style.css';
                } else if (request.url.startsWith('/test/customize/')) {
                    request.url = request.url.slice('/test'.length);
                }

                next();
            });
        },
    };
}

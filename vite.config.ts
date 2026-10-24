import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { localCustomizeWriter } from './dev/localCustomizeWriter';
import { externalSorterSources } from './src/sorterIndex/externalSorterSources';
import type { Plugin } from 'vite';
import { config } from './customize/config';
import { songList } from './customize/songList';
import { resolveSongEntry } from './src/songs';
import type { AppConfig } from './src/app/types';

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
    plugins: [react(), localCustomizeWriter(), externalSorterSourceFrameSrc(), pagesPreviewAssetRewrite(), libraryPage(), songLibraryCatalog()],
});

function songLibraryCatalog(): Plugin {
    return {
        name: 'song-library-catalog',
        apply: 'build',
        generateBundle() {
            const sorterConfig: AppConfig = config;
            this.emitFile({
                type: 'asset',
                fileName: 'song-library.json',
                source: JSON.stringify({
                    localStoragePrefix: sorterConfig.localStoragePrefix,
                    songs: songList.map((entry) => resolveSongEntry(entry, sorterConfig.fallbackAnimeName?.trim() || sorterConfig.title.replace(/\s+Sorter$/i, '').trim() || sorterConfig.title)),
                }),
            });
        },
    };
}

function libraryPage(): Plugin {
    return {
        name: 'library-page',
        apply: 'build',
        enforce: 'post',
        generateBundle(_options, bundle) {
            if (process.env.VITE_SORTER_INDEX !== 'true') return;
            const entry = bundle['index.html'];
            if (!entry || entry.type !== 'asset' || typeof entry.source !== 'string') {
                this.error('The main index HTML is required to build the library page.');
            }
            for (const fileName of ['library/index.html', 'library/liked/index.html', 'library/rated/index.html']) {
                const assetPrefix = '../'.repeat(fileName.split('/').length - 1);
                this.emitFile({
                    type: 'asset',
                    fileName,
                    source: entry.source.replace(/((?:src|href)=")\.\//g, `$1${assetPrefix}`),
                });
            }
        },
    };
}

function externalSorterSourceFrameSrc(): Plugin {
    return {
        name: 'external-sorter-source-frame-src',
        transformIndexHtml(html) {
            const externalOrigins = externalSorterSourceOrigins();
            if (externalOrigins.length === 0) {
                return html;
            }

            return html.replace(
                /(frame-src\s+)([^;"]*)(;)/,
                (_match, prefix: string, sources: string, suffix: string) => {
                    const mergedSources = [...new Set([...sources.trim().split(/\s+/).filter(Boolean), ...externalOrigins])];
                    return `${prefix}${mergedSources.join(' ')}${suffix}`;
                },
            );
        },
    };
}

function externalSorterSourceOrigins(): string[] {
    return externalSorterSources
        .map((source) => {
            try {
                return new URL(source.indexUrl).origin;
            } catch {
                return null;
            }
        })
        .filter((origin): origin is string => origin !== null);
}

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

                if (request.url.startsWith('/test/customize/')) {
                    request.url = request.url.slice('/test'.length);
                }
                request.url = request.url.replace(/^\/library(?:\/(?:liked|rated))?\/customize\//, '/customize/');

                next();
            });
        },
    };
}

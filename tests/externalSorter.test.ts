import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { config as hostConfig } from '../customize/config';
import type { AppConfig } from '../src/app/types';
import { loadExternalSorter } from '../src/externalSorter/externalSorter';
import { writeScoresToFirstSheet } from '../src/google/sheetsClient';

const request = { sourceRouteSlug: 'tutti', sorterSlug: 'nana-mizuki' };
const sourceBase = 'https://raw.githubusercontent.com/amq-tutti/pr-sorter/refs/heads/pr-sorter/nana-mizuki/customize/';
const pageUrl = 'https://amq-tutti.github.io/pr-sorter/nana-mizuki/';
const bundleUrl = `${pageUrl}assets/sorter.js`;
const songs = [{ id: 1, name: 'Song', full: 'https://example.com/song' }];
const sheetConfig = { clientId: 'foreign-client', appId: 'foreign-app', rankColumnHeader: 'Rank', scoreColumnHeader: 'Score' };

function configSource(settings: Record<string, unknown> = { googleSheets: sheetConfig }): string {
    return `import type { AppConfig } from '../src/app/types';
        export const config = {
            localStoragePrefix: 'nana-mizuki', title: 'Nana Mizuki',
            deadline: new Date('2026-10-17T04:00:00Z'),
            ...PLACEHOLDER
        } satisfies AppConfig;`.replace('...PLACEHOLDER', JSON.stringify(settings).slice(1, -1));
}

function mockExternal(t: TestContext, config = configSource(), options: { bundle?: string; noSources?: boolean } = {}) {
    const calls: string[] = [];
    t.mock.method(globalThis, 'fetch', async (input: string | URL) => {
        const url = String(input);
        calls.push(url);
        if (url === 'https://amq-tutti.github.io/pr-sorter/sorter-index.json') {
            return Response.json({ sorters: [{ slug: 'nana-mizuki', title: 'Nana Mizuki', description: 'Songs', songCount: 1 }] });
        }
        if (url === `${sourceBase}songList.ts`) {
            return options.noSources ? new Response('', { status: 404 })
                : new Response(`export const songList = ${JSON.stringify(songs)};`);
        }
        if (url === `${sourceBase}config.ts`) {
            return options.noSources ? new Response('', { status: 404 }) : new Response(config);
        }
        if (url === pageUrl && options.bundle !== undefined) {
            return new Response('<script type="module" src="assets/sorter.js"></script>');
        }
        if (url === bundleUrl && options.bundle !== undefined) {
            return new Response(options.bundle);
        }
        return new Response('', { status: 404 });
    });
    return calls;
}

function mockBundleDocument(t: TestContext): void {
    const original = globalThis.DOMParser;
    // The browser supplies HTML parsing; only the asset URL matters to these tests.
    globalThis.DOMParser = class {
        parseFromString() {
            return { querySelectorAll: () => [{ type: 'module', getAttribute: () => 'assets/sorter.js' }] };
        }
    } as unknown as typeof DOMParser;
    t.after(() => {
        if (original) globalThis.DOMParser = original;
        else Reflect.deleteProperty(globalThis, 'DOMParser');
    });
}

test('loads Nana Mizuki column mappings from its config and keeps host credentials', async (t) => {
    const calls = mockExternal(t);
    const loaded = await loadExternalSorter(request);
    assert.deepEqual(loaded.config.googleSheets, {
        clientId: hostConfig.googleSheets.clientId,
        appId: hostConfig.googleSheets.appId,
        rankColumnHeader: 'Rank',
        scoreColumnHeader: 'Score',
    });
    assert.equal(loaded.config.localStoragePrefix, 'external:tutti:nana-mizuki');
    assert.deepEqual(loaded.songs, songs);
    assert.ok(calls.includes(`${sourceBase}config.ts`));
    assert.ok(!calls.includes(pageUrl), 'readable source files should not require the bundle');
});

test('uses custom external ID, rank, and score headers through an actual write request', async (t) => {
    mockExternal(t, configSource({ googleSheets: { ...sheetConfig, idColumnHeader: 'Song ID', rankColumnHeader: 'Position', scoreColumnHeader: 'My rating' } }));
    const loaded = await loadExternalSorter(request);
    const settings = loaded.config.googleSheets!;
    assert.equal(settings.idColumnHeader, 'Song ID');
    assert.equal(settings.rankColumnHeader, 'Position');
    const writes: unknown[] = [];
    t.mock.method(globalThis, 'fetch', async (url: string, init?: RequestInit) => {
        if (init?.method === 'POST') {
            writes.push(JSON.parse(String(init.body)));
            return Response.json({});
        }
        return Response.json(url.includes('/values/')
            ? { values: [['My rating', 'Song ID', 'Position'], ['', 1]] }
            : { sheets: [{ properties: { title: 'Sheet4', index: 0, sheetType: 'GRID' } }] });
    });
    assert.equal(await writeScoresToFirstSheet({ ...settings, scoreColumnHeader: settings.scoreColumnHeader!, spreadsheetId: 'test', token: 'test-token', scoresBySongId: new Map([[1, 9.5]]) }), 1);
    assert.deepEqual(writes, [{ valueInputOption: 'RAW', data: [{ range: "'Sheet4'!A2", values: [[9.5]] }] }]);
});

test('does not inherit host headers when the external config omits them', async (t) => {
    mockExternal(t, configSource({ googleSheets: { clientId: 'foreign', appId: 'foreign', rankColumnHeader: 'Placement' } }));
    const { config } = await loadExternalSorter(request);
    assert.deepEqual(config.googleSheets, { clientId: hostConfig.googleSheets.clientId, appId: hostConfig.googleSheets.appId, rankColumnHeader: 'Placement' });
});

test('preserves external playlist-only configuration without adding a rank column', async (t) => {
    mockExternal(t, configSource({ rankSupported: false, googleSheets: { scoreColumnHeader: 'Rating' } }));
    const { config } = await loadExternalSorter(request);
    assert.equal(config.rankSupported, false);
    assert.equal(config.googleSheets?.scoreColumnHeader, 'Rating');
    assert.equal(config.googleSheets?.rankColumnHeader, undefined);
});

test('keeps scores local when the external sorter has no Google integration', async (t) => {
    mockExternal(t, configSource({}));
    assert.equal((await loadExternalSorter(request)).config.googleSheets, undefined);
});

test('never enables foreign credentials if host Google integration is disabled', async (t) => {
    mockExternal(t);
    const mutableHost: AppConfig = hostConfig;
    const original = mutableHost.googleSheets;
    mutableHost.googleSheets = undefined;
    t.after(() => { mutableHost.googleSheets = original; });
    assert.equal((await loadExternalSorter(request)).config.googleSheets, undefined);
});

test('parses settings without executing expressions in external credentials or metadata', async (t) => {
    const source = configSource().replace('new Date(\'2026-10-17T04:00:00Z\')', '(() => { throw new Error("executed metadata"); })()')
        .replace('"foreign-client"', '(() => { throw new Error("executed credentials"); })()');
    mockExternal(t, source);
    assert.equal((await loadExternalSorter(request)).config.googleSheets?.scoreColumnHeader, 'Score');
});

test('falls back to bundled config when source headers cannot be parsed', async (t) => {
    mockBundleDocument(t);
    mockExternal(t, configSource().replace('"Score"', 'unknownHeader()'), {
        bundle: 'const c={localStoragePrefix:`nana-mizuki`,title:`Nana Mizuki`,rankSupported:!1,googleSheets:{scoreColumnHeader:`Bundled score`}};',
    });
    const { config } = await loadExternalSorter(request);
    assert.equal(config.googleSheets?.scoreColumnHeader, 'Bundled score');
    assert.equal(config.rankSupported, false);
});

test('shares one deployed bundle request when both source files are unavailable', async (t) => {
    mockBundleDocument(t);
    const calls = mockExternal(t, '', {
        noSources: true,
        bundle: `const c={localStoragePrefix:'nana-mizuki',title:'Nana Mizuki',googleSheets:{scoreColumnHeader:'Score'}}; const s=${JSON.stringify(songs)};`,
    });
    const loaded = await loadExternalSorter(request);
    assert.equal(loaded.config.googleSheets?.scoreColumnHeader, 'Score');
    assert.deepEqual(loaded.songs, songs);
    assert.equal(calls.filter((url) => url === pageUrl).length, 1);
    assert.equal(calls.filter((url) => url === bundleUrl).length, 1);
});

test('reports unreadable external config instead of substituting host headers', async (t) => {
    mockExternal(t, 'export const config = buildConfig();');
    await assert.rejects(loadExternalSorter(request), /Could not read the external spreadsheet configuration/);
});

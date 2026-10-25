import assert from 'node:assert/strict';
import { test } from 'node:test';
import { librarySongSources } from '../src/app/librarySongSources';
import { parseSongLibrary } from '../src/app/songLibrary';
import { sorters } from '../src/sorterIndex/sorters.generated';

test('original PR links use the source prefix and published path, independently of song IDs', (t) => {
    const fixture = { slug: 'example-pr', localStoragePrefix: 'custom-pr-prefix', title: 'Example PR', description: '', url: 'published-pr/' };
    sorters.push(fixture);
    t.after(() => { sorters.splice(sorters.indexOf(fixture), 1); });
    const library = parseSongLibrary(null);
    library.songs.recording = { id: 900, anime: 'Anime', name: 'Song' };
    library.sources['custom-pr-prefix'] = { 17: ['recording'] };
    assert.deepEqual(librarySongSources(library, 'https://host.example/collection/'), {
        recording: [{ title: 'Example PR', href: 'https://host.example/collection/published-pr/' }],
    });
});

test('external PRs link to their local external route without loading remote metadata', (t) => {
    t.mock.method(globalThis, 'fetch', () => { throw new Error('Source links must work offline.'); });
    const library = parseSongLibrary(null);
    library.songs.recording = { id: 1, anime: 'Anime', name: 'Song' };
    library.sources['external:tutti:nana-mizuki'] = { 11: ['recording'] };
    assert.deepEqual(librarySongSources(library, 'https://host.example/collection/'), {
        recording: [{ title: 'Tutti / nana-mizuki', href: 'https://host.example/collection/external/tutti/nana-mizuki/' }],
    });
});

test('shared and grouped recordings list each original PR once, without mixing local IDs', () => {
    const library = parseSongLibrary(null);
    library.songs.first = { id: 1, anime: 'Anime', name: 'First' };
    library.songs.second = { id: 1, anime: 'Anime', name: 'Second' };
    library.sources['external:tutti:pr-one'] = { 1: ['first', 'second'], 2: ['first'] };
    library.sources['external:minigamer42:pr-two'] = { 1: ['first'] };
    const links = librarySongSources(library, 'https://host.example/');
    assert.deepEqual(links.first.map((link) => link.href), [
        'https://host.example/external/minigamer42/pr-two/',
        'https://host.example/external/tutti/pr-one/',
    ]);
    assert.deepEqual(links.second.map((link) => link.href), ['https://host.example/external/tutti/pr-one/']);
});

test('unknown sources and invalid external routes do not produce guessed links', () => {
    const library = parseSongLibrary(null);
    library.songs.recording = { id: 1, anime: 'Anime', name: 'Song' };
    library.sources.unknown = { 1: ['recording'] };
    library.sources['external:tutti:../../bad'] = { 1: ['recording'] };
    library.sources['external:tutti:valid'] = { 1: ['missing-recording'] };
    assert.deepEqual(librarySongSources(library, 'https://host.example/'), {});
});

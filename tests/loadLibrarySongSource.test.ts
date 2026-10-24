import assert from 'node:assert/strict';
import { test } from 'node:test';
import { config } from '../customize/config';
import { songList } from '../customize/songList';
import { createLibrarySongSourceLoader } from '../src/app/loadLibrarySongSource';
import { discoverSavedLibrarySongs } from '../src/app/songLibraryDiscovery';
import { libraryScores, parseSongLibrary, songLibraryKey, songPassesThreshold } from '../src/app/songLibrary';
import { songEntryId } from '../src/songs';
import { sorters } from '../src/sorterIndex/sorters.generated';

function memoryStorage() {
    const entries = new Map<string, string>();
    return {
        get length() { return entries.size; },
        key: (index: number) => [...entries.keys()][index] ?? null,
        getItem: (key: string) => entries.get(key) ?? null,
        setItem: (key: string, value: string) => { entries.set(key, value); },
    };
}

test('the current local sorter recovers saved ratings without visiting its page or making network requests', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => { throw new Error('A local song list is already available.'); });
    const storage = memoryStorage();
    const id = songEntryId(songList[0]);
    storage.setItem(`${config.localStoragePrefix}:scores`, JSON.stringify({ [id]: '8.125' }));
    const result = await discoverSavedLibrarySongs(createLibrarySongSourceLoader('https://host.example/'), storage);
    assert.deepEqual(result.unresolvedPrefixes, []);
    const scores = libraryScores(parseSongLibrary(storage.getItem(songLibraryKey)), storage);
    assert.ok(Object.values(scores).includes(8.125));
});

test('external sorter recovery reads local grades under their original prefixes without requesting Sheets or config', async (t) => {
    const calls: string[] = [];
    t.mock.method(globalThis, 'fetch', async (input: string | URL) => {
        const url = String(input);
        calls.push(url);
        if (url === 'https://amq-tutti.github.io/pr-sorter/sorter-index.json') {
            return Response.json({ sorters: [
                { slug: 'old-one', title: 'First external sorter', description: '', songCount: 1 },
                { slug: 'old-two', title: 'Second external sorter', description: '', songCount: 1 },
            ] });
        }
        const match = /pr-sorter\/(old-one|old-two)\/customize\/songList\.ts$/.exec(url);
        if (match) return new Response(`export const songList = [{id:1,name:'${match[1]}',video:'https://youtu.be/${match[1]}'}];`);
        return new Response('', { status: 404 });
    });
    const storage = memoryStorage();
    const firstPrefix = 'external:tutti:old-one';
    const secondPrefix = 'external:tutti:old-two';
    storage.setItem(`${firstPrefix}:scores`, '{"1":"8.25"}');
    storage.setItem(`${secondPrefix}:scores`, '{"1":8}');
    const result = await discoverSavedLibrarySongs(createLibrarySongSourceLoader('https://host.example/'), storage);
    assert.deepEqual(result.unresolvedPrefixes, []);
    const library = parseSongLibrary(storage.getItem(songLibraryKey));
    assert.deepEqual(Object.keys(library.sources).sort(), [firstPrefix, secondPrefix]);
    const scores = libraryScores(library, storage);
    assert.deepEqual(Object.values(scores).sort(), [8, 8.25]);
    assert.equal(Object.values(scores).filter((score) => songPassesThreshold(score, 8)).length, 2);
    assert.equal(storage.getItem(`${firstPrefix}:scores`), '{"1":"8.25"}');
    assert.equal(storage.getItem(`${secondPrefix}:scores`), '{"1":8}');
    assert.ok(calls.some((url) => url.endsWith('/old-one/customize/songList.ts')));
    assert.ok(!calls.some((url) => url.endsWith('/config.ts') || url.includes('googleapis.com')));
});

test('another local prefix loads its matching published song catalog', async (t) => {
    const fixture = { slug: 'saved-local', title: 'Local Sorter', description: '', localStoragePrefix: 'custom-local-prefix' };
    sorters.push(fixture);
    t.after(() => { sorters.splice(sorters.indexOf(fixture), 1); });
    t.mock.method(globalThis, 'fetch', async (input: string | URL) => {
        assert.equal(String(input), 'https://host.example/collection/saved-local/song-library.json');
        return Response.json({ localStoragePrefix: fixture.localStoragePrefix, songs: [{ id: 1, anime: 'Anime', name: 'Local song', video: 'https://youtu.be/local' }] });
    });
    const storage = memoryStorage();
    storage.setItem('custom-local-prefix:scores', '{"1":"9.5"}');
    assert.deepEqual(await discoverSavedLibrarySongs(createLibrarySongSourceLoader('https://host.example/collection/'), storage), { unresolvedPrefixes: [] });
    assert.deepEqual(libraryScores(parseSongLibrary(storage.getItem(songLibraryKey)), storage), { 'youtube:local': 9.5 });
});

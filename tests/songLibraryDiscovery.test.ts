import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ResolvedSong, ResolvedSongEntry } from '../src/songs';
import { discoverSavedLibrarySongs, savedScorePrefixes } from '../src/app/songLibraryDiscovery';
import { libraryScores, parseSongLibrary, registerLibrarySongs, saveLibraryScoreThreshold, songLibraryId, songLibraryKey, songPassesThreshold, toggleSongLike } from '../src/app/songLibrary';

function memoryStorage() {
    const entries = new Map<string, string>();
    return {
        get length() { return entries.size; },
        key: (index: number) => [...entries.keys()][index] ?? null,
        getItem: (key: string) => entries.get(key) ?? null,
        setItem: (key: string, value: string) => { entries.set(key, value); },
    };
}

const first: ResolvedSong = { id: 1, anime: 'Anime', name: 'First', video: 'https://youtu.be/first' };
const second: ResolvedSong = { id: 1, anime: 'Anime', name: 'Second', video: 'https://youtu.be/second' };

test('discovers pre-existing ratings across prefixes without an existing library catalog', async () => {
    const storage = memoryStorage();
    storage.setItem('old-first:scores', JSON.stringify({ 1: '8.25' }));
    storage.setItem('external:collection:second:scores', JSON.stringify({ 1: 8 }));
    storage.setItem('empty:scores', JSON.stringify({ 1: '' }));
    storage.setItem('broken:scores', '{');
    storage.setItem('unrelated:settings', '{}');
    const before = [storage.getItem('old-first:scores'), storage.getItem('external:collection:second:scores')];
    const loaded: string[] = [];
    const result = await discoverSavedLibrarySongs(async (prefix) => {
        loaded.push(prefix);
        return [prefix === 'old-first' ? first : second];
    }, storage);
    assert.deepEqual(result.unresolvedPrefixes, []);
    assert.deepEqual(loaded.sort(), ['external:collection:second', 'old-first']);
    const library = parseSongLibrary(storage.getItem(songLibraryKey));
    const scores = libraryScores(library, storage);
    assert.deepEqual(Object.keys(scores).filter((key) => songPassesThreshold(scores[key], 8)).sort(), [songLibraryId(first), songLibraryId(second)].sort());
    assert.deepEqual([storage.getItem('old-first:scores'), storage.getItem('external:collection:second:scores')], before);
});

test('valid zero scores are discovered and invalid records are skipped', () => {
    const storage = memoryStorage();
    storage.setItem('zero:scores', '{"1":0}');
    for (const [prefix, data] of Object.entries({ blank: '{"1":" "}', invalid: '{"1":"bad"}', bool: '{"1":true}', array: '[]', range: '{"1":11}' })) {
        storage.setItem(`${prefix}:scores`, data);
    }
    assert.deepEqual(savedScorePrefixes(storage), ['zero']);
});

test('registered sources are reused, while missing song metadata is recovered', async () => {
    const storage = memoryStorage();
    registerLibrarySongs('known', [first], storage);
    storage.setItem('known:scores', '{"1":"9"}');
    const load = async (): Promise<ResolvedSongEntry[]> => { throw new Error('An existing catalog should not be fetched.'); };
    assert.deepEqual(await discoverSavedLibrarySongs(load, storage), { unresolvedPrefixes: [] });
    const library = parseSongLibrary(storage.getItem(songLibraryKey));
    delete library.songs[songLibraryId(first)];
    storage.setItem(songLibraryKey, JSON.stringify(library));
    assert.deepEqual(await discoverSavedLibrarySongs(async () => [first], storage), { unresolvedPrefixes: [] });
    assert.equal(Object.keys(libraryScores(parseSongLibrary(storage.getItem(songLibraryKey)), storage)).length, 1);
});

test('a failed source does not hide working saves, and retry recovers it', async () => {
    const storage = memoryStorage();
    storage.setItem('first:scores', '{"1":"9"}');
    storage.setItem('second:scores', '{"1":"8.5"}');
    const result = await discoverSavedLibrarySongs(async (prefix) => {
        if (prefix === 'second') throw new Error('Offline');
        return [first];
    }, storage);
    assert.deepEqual(result.unresolvedPrefixes, ['second']);
    assert.deepEqual(libraryScores(parseSongLibrary(storage.getItem(songLibraryKey)), storage), { [songLibraryId(first)]: 9 });
    assert.deepEqual(await discoverSavedLibrarySongs(async () => [second], storage), { unresolvedPrefixes: [] });
    assert.equal(Object.keys(libraryScores(parseSongLibrary(storage.getItem(songLibraryKey)), storage)).length, 2);
});

test('recovering catalogs preserves global likes, threshold, and fractional ratings', async () => {
    const storage = memoryStorage();
    toggleSongLike(first, storage);
    saveLibraryScoreThreshold(8.125, storage);
    storage.setItem('saved:scores', '{"1":"8.1250"}');
    await discoverSavedLibrarySongs(async () => [first], storage);
    const library = parseSongLibrary(storage.getItem(songLibraryKey));
    assert.deepEqual(library.liked, [songLibraryId(first)]);
    assert.equal(library.scoreThreshold, 8.125);
    assert.equal(songPassesThreshold(libraryScores(library, storage)[songLibraryId(first)], library.scoreThreshold), true);
});

test('saved IDs missing from a fetched catalog are reported instead of silently discarded', async () => {
    const storage = memoryStorage();
    storage.setItem('saved:scores', '{"99":"8"}');
    assert.deepEqual(await discoverSavedLibrarySongs(async () => [first], storage), { unresolvedPrefixes: ['saved'] });
    assert.equal(storage.getItem('saved:scores'), '{"99":"8"}');
});

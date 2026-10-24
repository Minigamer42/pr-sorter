import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ResolvedSong } from '../src/songs';
import { libraryScores, parseSongLibrary, registerLibrarySongs, saveLibraryScoreThreshold, songLibraryId, songLibraryKey, songPassesThreshold, toggleSongLike } from '../src/app/songLibrary';

function memoryStorage() {
    const entries = new Map<string, string>();
    return {
        getItem: (key: string) => entries.get(key) ?? null,
        setItem: (key: string, value: string) => { entries.set(key, value); },
    };
}

const song: ResolvedSong = { id: 1, anime: 'Anime', name: 'Song by Artist', video: 'https://youtu.be/abc123' };

test('likes follow a recording across sorter IDs and YouTube URL forms, without ID collisions', () => {
    const storage = memoryStorage();
    toggleSongLike(song, storage);
    const duplicate = { ...song, id: 25, video: 'https://www.youtube.com/watch?v=abc123&t=20' };
    assert.equal(songLibraryId(duplicate), songLibraryId(song));
    assert.notEqual(songLibraryId({ ...song, video: 'https://youtu.be/another' }), songLibraryId(song));
    registerLibrarySongs('second-sorter', [duplicate], storage);
    const reloaded = parseSongLibrary(storage.getItem(songLibraryKey));
    assert.deepEqual(reloaded.liked, [songLibraryId(song)]);
    assert.equal(Object.keys(reloaded.songs).length, 1);
    toggleSongLike(duplicate, storage);
    assert.deepEqual(parseSongLibrary(storage.getItem(songLibraryKey)).liked, []);
});

test('AMQ regions share likes and songs without media use their names instead of local IDs', () => {
    assert.equal(
        songLibraryId({ ...song, video: 'https://eudist.animemusicquiz.com/file.webm' }),
        songLibraryId({ ...song, video: 'https://naedist.animemusicquiz.com/file.webm' }),
    );
    assert.notEqual(songLibraryId({ ...song, video: null }), songLibraryId({ ...song, name: 'Different song', video: null }));
});

test('global scores use current saved ratings across sorters and the highest score for duplicates', () => {
    const storage = memoryStorage();
    const second = { ...song, id: 1, video: 'https://youtu.be/different' };
    registerLibrarySongs('first', [song], storage);
    registerLibrarySongs('second', [second, { ...song, id: 20 }], storage);
    storage.setItem('first:scores', JSON.stringify({ 1: '8.1' }));
    storage.setItem('second:scores', JSON.stringify({ 1: '9', 20: '9.5' }));
    const library = parseSongLibrary(storage.getItem(songLibraryKey));
    assert.deepEqual(libraryScores(library, storage), { [songLibraryId(song)]: 9.5, [songLibraryId(second)]: 9 });
    storage.setItem('second:scores', '{}');
    assert.deepEqual(libraryScores(library, storage), { [songLibraryId(song)]: 8.1 });
    storage.setItem('first:scores', '{}');
    assert.deepEqual(libraryScores(library, storage), {});
});

test('grouped entry scores apply to each constituent song and stale source entries are replaced', () => {
    const storage = memoryStorage();
    const second = { ...song, id: 2, video: 'https://youtu.be/different' };
    registerLibrarySongs('grouped', [[song, second]], storage);
    storage.setItem('grouped:scores', JSON.stringify({ 1: '9.2' }));
    assert.deepEqual(libraryScores(parseSongLibrary(storage.getItem(songLibraryKey)), storage), {
        [songLibraryId(song)]: 9.2, [songLibraryId(second)]: 9.2,
    });
    toggleSongLike(second, storage);
    registerLibrarySongs('grouped', [song], storage);
    const library = parseSongLibrary(storage.getItem(songLibraryKey));
    assert.deepEqual(libraryScores(library, storage), { [songLibraryId(song)]: 9.2 });
    assert.deepEqual(library.liked, [songLibraryId(second)], 'removing a song from a sorter preserves its global like');
});

test('threshold filtering includes equality and excludes missing or invalid scores', () => {
    assert.equal(songPassesThreshold('8.01', 8), true);
    assert.equal(songPassesThreshold('8', 8), true);
    assert.equal(songPassesThreshold('0', 0), true);
    assert.equal(songPassesThreshold('0.01', 0), true);
    assert.equal(songPassesThreshold('10', 10), true);
    for (const value of [undefined, '', ' ', 'not-a-number', '8junk', 'Infinity', '11', '-1']) {
        assert.equal(songPassesThreshold(value, 0), false, String(value));
    }
});

test('decimal thresholds compare numerically without rounding away fractional precision', () => {
    assert.equal(songPassesThreshold('8.25', 8.25), true);
    assert.equal(songPassesThreshold(8.25, 8.25), true);
    assert.equal(songPassesThreshold('8.2500', 8.25), true);
    assert.equal(songPassesThreshold('8.2499', 8.25), false);
    assert.equal(songPassesThreshold('8.2501', 8.25), true);
    assert.equal(songPassesThreshold('8.9', 8.10), true);
    assert.equal(songPassesThreshold('9.125', 9.125), true);
    assert.equal(songPassesThreshold('9.1249', 9.125), false);
    assert.equal(songPassesThreshold('0.001', 0.001), true);
    assert.equal(songPassesThreshold('0.0009', 0.001), false);
    assert.equal(songPassesThreshold(undefined, 0), false);
    assert.equal(songPassesThreshold(NaN, 0), false);
});

test('global saved ratings retain decimal equality when filtered for playback', () => {
    const storage = memoryStorage();
    const second = { ...song, id: 2, video: 'https://youtu.be/different' };
    registerLibrarySongs('sorter', [song, second], storage);
    storage.setItem('sorter:scores', JSON.stringify({ 1: '8.2500', 2: '8.2499' }));
    const library = parseSongLibrary(storage.getItem(songLibraryKey));
    const scores = libraryScores(library, storage);
    assert.deepEqual(Object.keys(library.songs).filter((key) => songPassesThreshold(scores[key], 8.25)), [songLibraryId(song)]);
});

test('threshold persists across library changes and rejects invalid settings', () => {
    const storage = memoryStorage();
    saveLibraryScoreThreshold(7.25, storage);
    toggleSongLike(song, storage);
    registerLibrarySongs('sorter', [song], storage);
    for (const value of [NaN, Infinity, -1, 11]) saveLibraryScoreThreshold(value, storage);
    assert.equal(parseSongLibrary(storage.getItem(songLibraryKey)).scoreThreshold, 7.25);
});

test('malformed storage does not break the library or hide other valid ratings', () => {
    assert.deepEqual(parseSongLibrary('broken'), parseSongLibrary(null));
    assert.deepEqual(parseSongLibrary('{"version":99}'), parseSongLibrary(null));
    const storage = memoryStorage();
    registerLibrarySongs('valid', [song], storage);
    registerLibrarySongs('broken', [song], storage);
    storage.setItem('broken:scores', '{');
    storage.setItem('valid:scores', JSON.stringify({ 1: '0' }));
    const library = parseSongLibrary(storage.getItem(songLibraryKey));
    assert.deepEqual(libraryScores(library, storage), { [songLibraryId(song)]: 0 });
    for (const value of ['[]', 'null', '{"1":"bad"}', '{"1":false}', '{"1":"11"}']) {
        storage.setItem('broken:scores', value);
        assert.deepEqual(libraryScores(library, storage), { [songLibraryId(song)]: 0 });
    }
});

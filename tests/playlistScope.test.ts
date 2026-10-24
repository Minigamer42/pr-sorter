import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement, type ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Playlist } from '../src/app/components/Playlist';

const noop = () => undefined;
const props: ComponentProps<typeof Playlist> = {
    config: { localStoragePrefix: 'test-playlist', title: 'Songs', description: '' },
    songs: [{ id: 1, anime: 'Anime', name: 'Song' }],
    currentSong: null,
    currentPosition: 0,
    orderLength: 0,
    scoredSongCount: 0,
    totalSongCount: 0,
    mode: 'in-order',
    scoreFilter: 'all',
    settings: { mediaFormat: 'video', region: 'eu', sorterAutoPlayMode: 'off', autoSkipScoreDifference: 10 },
    scoreEnabled: true,
    scoresBySongId: {},
    canWriteSheetScores: false,
    sheetScoresSetupReason: null,
    isWritingSheetScores: false,
    onModeChange: noop,
    onScoreFilterChange: noop,
    onPrevious: noop,
    onNext: noop,
    onAutoNext: noop,
    onScoreChange: noop,
    onWriteSheetScores: noop,
    onSetupGoogleSheet: noop,
};

test('a sorter playlist keeps its original controls without global library filters', () => {
    const html = renderToStaticMarkup(createElement(Playlist, props));
    for (const label of ['All songs', 'No score', 'In order', 'Random', 'Write scores']) assert.ok(html.includes(label), label);
    assert.doesNotMatch(html, /Liked songs|Score ≥|Minimum score|playlist-threshold/);
});

test('liked and rated playlist controls are available only in the global library', () => {
    const html = renderToStaticMarkup(createElement(Playlist, { ...props, library: true, scoreFilter: 'liked', scoreThreshold: 8.25 }));
    assert.ok(html.includes('Liked songs'));
    assert.ok(html.includes('Score ≥ 8.25'));
    assert.doesNotMatch(html, /All songs|No score|Write scores|playlist-threshold/);
});

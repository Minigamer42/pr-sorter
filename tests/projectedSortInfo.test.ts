import assert from 'node:assert/strict';
import { test } from 'node:test';
import { choose, createSort, isComplete, type SortState } from '../src/sorter';
import { automaticChoiceForCurrentBattle } from '../src/app/internal/automaticChoice';
import { projectedSongSortInfo, projectedSongSortInfos } from '../src/app/internal/projectedSortInfo';
import { scoreConstrainedSortInfos } from '../src/app/internal/scoreConstrainedSortInfo';

function optionsFor(scores: Array<number | string | null>, gap = 0.4, scoreEnabled = true) {
    return {
        songs: scores.map((_, index) => ({ id: 100 + index, name: `Song ${index}`, anime: '' })),
        scoresBySongId: Object.fromEntries(scores.map((score, index) => [100 + index, score === null ? '' : String(score)])),
        settings: { mediaFormat: 'video' as const, region: 'eu' as const, sorterAutoPlayMode: 'off' as const, autoSkipScoreDifference: gap },
        scoreEnabled,
    };
}

test('a unique 10 is pinned to first across many unresolved equal-score battles', () => {
    const scores = Array.from({ length: 80 }, (_, i) => i === 52 ? 10 : 9.5);
    const sort = createSort(scores.length);
    const options = optionsFor(scores);
    const before = JSON.stringify(sort);
    const infos = projectedSongSortInfos(sort, scores.length, options);
    assert.deepEqual(infos.get(52), { minRank: 1, maxRank: 1, songCount: 80 });
    for (let i = 0; i < scores.length; i += 1) {
        if (i !== 52) assert.deepEqual(infos.get(i), { minRank: 2, maxRank: 80, songCount: 80 });
    }
    assert.deepEqual(projectedSongSortInfo(sort, 52, options), infos.get(52));
    assert.equal(JSON.stringify(sort), before, 'projection must not change progress or history');
});

test('separated score bands retain uncertainty only within each band', () => {
    const scores = [9, 9.5, 8, 10, 9.5, 9, 8];
    const infos = projectedSongSortInfos(createSort(scores.length), scores.length, optionsFor(scores));
    const expected = [[4, 5], [2, 3], [6, 7], [1, 1], [2, 3], [4, 5], [6, 7]];
    expected.forEach(([minRank, maxRank], index) => assert.deepEqual(infos.get(index), { minRank, maxRank, songCount: 7 }));
});

test('disabled scoring, invalid/missing scores, close scores, and zero-gap ties stay uncertain', () => {
    for (const options of [
        optionsFor([10, 9.5], 0.4, false),
        optionsFor([10, null]),
        optionsFor([10, 'invalid']),
        optionsFor([10, 11]),
        optionsFor([10, 9.75]),
        optionsFor([10, 10], 0),
    ]) {
        const infos = projectedSongSortInfos(createSort(2), 2, options);
        assert.deepEqual([...infos.values()], Array.from({ length: 2 }, () => ({ minRank: 1, maxRank: 2, songCount: 2 })));
    }
    assert.deepEqual(projectedSongSortInfo(createSort(2), 0, optionsFor([10, 9.5], 0.5)), { minRank: 1, maxRank: 1, songCount: 2 });
});

test('new score rules preserve an earlier ordering that contradicts the scores', () => {
    const sort = choose(createSort(4), 'left'); // Song 0 was already placed ahead of the new 10.
    const options = optionsFor([5, 10, 9, 8]);
    const infos = projectedSongSortInfos(sort, 4, options);
    assert.deepEqual(infos.get(1), { minRank: 4, maxRank: 4, songCount: 4 });
    checkEveryCompletion(sort, options);
});

type Options = ReturnType<typeof optionsFor>;
type ExactRange = { minRank: number; maxRank: number };

// Enumerate actual sorter outcomes, independently of the interval algorithm.
// Check every intermediate state too, including partially emitted merges.
function checkEveryCompletion(sort: SortState, options: Options): ExactRange[] {
    let exact: ExactRange[];
    if (isComplete(sort)) {
        exact = options.songs.map((_, index) => {
            const rank = sort.groups[0].indexOf(index) + 1;
            return { minRank: rank, maxRank: rank };
        });
    } else {
        const automatic = automaticChoiceForCurrentBattle(sort, options.songs, options.scoresBySongId, options.settings, options.scoreEnabled);
        const branches = (automatic ? [automatic] : ['left', 'right'] as const)
            .map((choice) => checkEveryCompletion(choose(sort, choice), options));
        exact = options.songs.map((_, index) => ({
            minRank: Math.min(...branches.map((branch) => branch[index].minRank)),
            maxRank: Math.max(...branches.map((branch) => branch[index].maxRank)),
        }));
    }
    const projected = projectedSongSortInfos(sort, options.songs.length, options);
    const rawScores = options.songs.map((song) => {
        const raw = options.scoresBySongId[song.id];
        return raw === '' ? null : Number(raw);
    });
    const scoreBounds = scoreConstrainedSortInfos(sort, rawScores, options.settings.autoSkipScoreDifference);
    for (const bounds of [projected, scoreBounds]) {
        exact.forEach((range, index) => {
            const info = bounds.get(index)!;
            assert.ok(info.minRank <= range.minRank && info.maxRank >= range.maxRank,
                JSON.stringify({ index, info, exact: range, scores: options.scoresBySongId, sort }));
            assert.ok(info.minRank >= 1 && info.maxRank <= options.songs.length);
            if (isComplete(sort)) assert.deepEqual(info, { ...range, songCount: options.songs.length });
        });
    }
    return exact;
}

test('bounds contain every reachable result for all four-song score combinations', () => {
    const values = [null, 9, 9.5, 10];
    for (let code = 0; code < 256; code += 1) {
        const scores = Array.from({ length: 4 }, (_, index) => values[(code >> (index * 2)) & 3]);
        for (const gap of [0, 0.4, 1]) checkEveryCompletion(createSort(4), optionsFor(scores, gap));
    }
});

test('bounds remain sound through larger uneven merges and changed scores', () => {
    let seed = 123456;
    const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0);
    const values = [null, 8, 9, 9.25, 9.5, 10];
    for (let sample = 0; sample < 36; sample += 1) {
        const count = 5 + sample % 3;
        const scores = Array.from({ length: count }, () => values[random() % values.length]);
        let sort = createSort(count);
        // Unrestricted earlier picks model score/threshold edits during a sort.
        for (let pick = 0; pick < sample % 5 && !isComplete(sort); pick += 1) {
            sort = choose(sort, random() % 2 ? 'left' : 'right');
        }
        checkEveryCompletion(sort, optionsFor(scores, [0, 0.4, 1][sample % 3]));
    }
});

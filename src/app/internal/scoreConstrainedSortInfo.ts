import type { CurrentSongSortInfo, SortState } from '../../sorter';

type SongRange = { songIndex: number; minRank: number; maxRank: number };
type ScoreRange = { min: number; max: number };

/**
 * Propagate conservative rank intervals through the remaining merge tree.
 * Candidate orders are deliberately over-approximated: this can leave a range
 * wider than necessary, but cannot exclude a reachable final rank.
 */
export function scoreConstrainedSortInfos(
    sort: SortState,
    scores: Array<number | null>,
    scoreGap: number,
): Map<number, CurrentSongSortInfo> {
    const queue = sort.groups.map(fixedOrder);
    if (sort.current) {
        const { left, right, leftPos, rightPos, merged } = sort.current;
        const remaining = mergeRanges(fixedOrder(left.slice(leftPos)), fixedOrder(right.slice(rightPos)), scores, scoreGap);
        queue.push([
            ...fixedOrder(merged),
            ...remaining.map((range) => ({
                ...range,
                minRank: range.minRank + merged.length,
                maxRank: range.maxRank + merged.length,
            })),
        ]);
    }

    // Match the sorter's FIFO merge schedule, including its active merge.
    for (let head = 0; head + 1 < queue.length; head += 2) {
        queue.push(mergeRanges(queue[head], queue[head + 1], scores, scoreGap));
    }
    const finalRanges = queue[queue.length - 1] ?? [];
    return new Map(finalRanges.map(({ songIndex, ...range }) => [songIndex, { ...range, songCount: finalRanges.length }]));
}

function fixedOrder(songs: number[]): SongRange[] {
    return songs.map((songIndex, index) => ({ songIndex, minRank: index + 1, maxRank: index + 1 }));
}

function possibleScores(group: SongRange[], scores: Array<number | null>): ScoreRange[] {
    const positions = Array.from({ length: group.length }, () => ({ min: Infinity, max: -Infinity }));
    for (const song of group) {
        const score = scores[song.songIndex] ?? null;
        for (let position = song.minRank - 1; position < song.maxRank; position += 1) {
            // A missing score always permits a manual choice in either direction.
            positions[position].min = Math.min(positions[position].min, score ?? -Infinity);
            positions[position].max = Math.max(positions[position].max, score ?? Infinity);
        }
    }
    return positions;
}

function mergeRanges(left: SongRange[], right: SongRange[], scores: Array<number | null>, scoreGap: number): SongRange[] {
    if (left.length === 0 || right.length === 0) {
        return [...left, ...right];
    }
    const leftScores = possibleScores(left, scores);
    const rightScores = possibleScores(right, scores);
    const leftOutput = Array.from({ length: left.length }, () => ({ min: Infinity, max: -Infinity }));
    const rightOutput = Array.from({ length: right.length }, () => ({ min: Infinity, max: -Infinity }));

    // (i, j) means i left songs and j right songs have been emitted. Only the
    // current row is needed. Every reachable state has a path to completion.
    const reachable = new Uint8Array(right.length + 1);
    reachable[0] = 1;
    for (let i = 0; i <= left.length; i += 1) {
        for (let j = 0; j <= right.length; j += 1) {
            if (!reachable[j]) continue;
            const leftScore = leftScores[i];
            const rightScore = rightScores[j];
            const leftForced = leftScore && rightScore
                && leftScore.min > rightScore.max && leftScore.min - rightScore.max >= scoreGap;
            const rightForced = leftScore && rightScore
                && rightScore.min > leftScore.max && rightScore.min - leftScore.max >= scoreGap;
            const canPickLeft = i < left.length && !rightForced;
            const canPickRight = j < right.length && !leftForced;
            const rank = i + j + 1;

            reachable[j] = canPickLeft ? 1 : 0;
            if (canPickLeft) {
                leftOutput[i].min = Math.min(leftOutput[i].min, rank);
                leftOutput[i].max = Math.max(leftOutput[i].max, rank);
            }
            if (canPickRight) {
                reachable[j + 1] = 1;
                rightOutput[j].min = Math.min(rightOutput[j].min, rank);
                rightOutput[j].max = Math.max(rightOutput[j].max, rank);
            }
        }
    }

    function project(group: SongRange[], output: ScoreRange[]): SongRange[] {
        return group.map((song) => {
            let minRank = Infinity;
            let maxRank = -Infinity;
            for (let position = song.minRank - 1; position < song.maxRank; position += 1) {
                minRank = Math.min(minRank, output[position].min);
                maxRank = Math.max(maxRank, output[position].max);
            }
            return { songIndex: song.songIndex, minRank, maxRank };
        });
    }
    return [...project(left, leftOutput), ...project(right, rightOutput)];
}

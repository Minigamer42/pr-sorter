import { currentBattle, type SortChoice, type SortState } from '../../sorter';
import type { ResolvedSong } from '../../songs';
import type { Settings, SongScoresById } from '../types';
import { projectedSongSortInfo } from '../internal/projectedSortInfo';
import { SongCard } from './SongCard';

type DuelProps = {
    songs: ResolvedSong[];
    sort: SortState;
    settings: Settings;
    scoreEnabled: boolean;
    scoresBySongId: SongScoresById;
    autoPlaySide: SortChoice | null;
    autoPlayKey: number;
    onAutoPlayEnded(side: SortChoice): void;
    onPick(choice: SortChoice): void;
    onScoreChange(songId: number, score: string): void;
};

export function Duel({
    songs,
    sort,
    settings,
    scoreEnabled,
    scoresBySongId,
    autoPlaySide,
    autoPlayKey,
    onAutoPlayEnded,
    onPick,
    onScoreChange,
}: DuelProps) {
    const battle = currentBattle(sort);
    if (battle === null) {
        return null;
    }

    const [leftIndex, rightIndex] = battle;
    const leftSong = songs[leftIndex];
    const rightSong = songs[rightIndex];
    if (leftSong === undefined || rightSong === undefined) {
        throw new Error('Sorter state references a song index outside the configured song list.');
    }

    return (
        <>
            <SongCard
                song={leftSong}
                side="left"
                settings={settings}
                scoreEnabled={scoreEnabled}
                score={scoresBySongId[leftSong.id] ?? ''}
                sortInfo={projectedSongSortInfo(sort, leftIndex, {songs, scoresBySongId, settings, scoreEnabled})}
                autoPlay={autoPlaySide === 'left'}
                autoPlayKey={autoPlayKey}
                onAutoPlayEnded={onAutoPlayEnded}
                onPick={onPick}
                onScoreChange={(score) => onScoreChange(leftSong.id, score)}
            />
            <SongCard
                song={rightSong}
                side="right"
                settings={settings}
                scoreEnabled={scoreEnabled}
                score={scoresBySongId[rightSong.id] ?? ''}
                sortInfo={projectedSongSortInfo(sort, rightIndex, {songs, scoresBySongId, settings, scoreEnabled})}
                autoPlay={autoPlaySide === 'right'}
                autoPlayKey={autoPlayKey}
                onAutoPlayEnded={onAutoPlayEnded}
                onPick={onPick}
                onScoreChange={(score) => onScoreChange(rightSong.id, score)}
            />
        </>
    );
}

import { useEffect, useMemo, useState } from 'react';
import { visibleUrl } from '../../media/internal/urls';
import { type SortState } from '../../sorter';
import {
    songEntryAnime,
    songEntryId,
    songEntryName,
    songEntrySongs,
    type ResolvedSong,
    type ResolvedSongEntry,
} from '../../songs';
import { projectedSongSortInfos } from '../internal/projectedSortInfo';
import type { GoogleSpreadsheetSelection, Settings, SongScoresById } from '../types';
import { LikeButton } from './LikeButton';

type SheetScoreStatus =
    | { state: 'unavailable'; message: string }
    | { state: 'loading'; message: string }
    | { state: 'ready'; message: string }
    | { state: 'error'; message: string };

type SongListModalProps = {
    open: boolean;
    songs: ResolvedSongEntry[];
    scoresBySongId: SongScoresById;
    onClose(): void;
} & ({
    library: true;
} | {
    library?: false;
    sort: SortState | null;
    settings: Settings;
    scoreEnabled: boolean;
    sheetScoresBySongId: SongScoresById;
    sheetScoreStatus: SheetScoreStatus;
    googleSpreadsheetSelection: GoogleSpreadsheetSelection | null;
    canWriteSheetScores: boolean;
    isWritingSheetScores: boolean;
    onScoreChange(songId: number, score: string): void;
    onWriteSheetScores(): void;
});

type SortColumn = 'id' | 'anime' | 'song' | 'score' | 'sheetScore';
type SortDirection = 'asc' | 'desc';

export function SongListModal(props: SongListModalProps) {
    const { open, songs, scoresBySongId, onClose } = props;
    const sorter = props.library ? undefined : props;
    const sheetScoresBySongId = sorter?.sheetScoresBySongId ?? {};
    const googleSpreadsheetSelection = sorter?.googleSpreadsheetSelection;
    const [sortColumn, setSortColumn] = useState<SortColumn>('id');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

    useEffect(() => {
        if (open) {
            setSortColumn('id');
            setSortDirection('asc');
        }
    }, [open]);

    const projectedRanges = useMemo(
        () => open && sorter?.sort ? projectedSongSortInfos(sorter.sort, songs.length, {
            songs, scoresBySongId, settings: sorter.settings, scoreEnabled: sorter.scoreEnabled,
        }) : new Map(),
        [open, sorter?.scoreEnabled, scoresBySongId, sorter?.settings, songs, sorter?.sort],
    );

    if (!open) {
        return null;
    }

    const rows = songs
        .map((song, index) => ({song, index}))
        .sort((left, right) =>
            compareRows(left, right, sortColumn, sortDirection, scoresBySongId, sheetScoresBySongId),
        );

    function changeSort(column: SortColumn): void {
        if (column === sortColumn) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
            return;
        }

        setSortColumn(column);
        setSortDirection('asc');
    }

    return (
        <>
            <div className="modal-overlay" onClick={onClose}/>
            <div className={`modal song-list-modal${props.library ? ' song-list-modal--library' : ''}`} role="dialog" aria-modal="true" aria-label="Song List">
                <h2>
                    Song List
                    {googleSpreadsheetSelection ? (
                        <>
                            {' for '}
                            <a
                                className="song-list-title-link"
                                href={`https://docs.google.com/spreadsheets/d/${encodeURIComponent(googleSpreadsheetSelection.id)}/edit`}
                                target="_blank"
                                rel="noreferrer"
                            >
                                {googleSpreadsheetSelection.name}
                            </a>
                        </>
                    ) : null}
                </h2>
                {sorter ? (
                    <div className={`song-list-status song-list-status--${sorter.sheetScoreStatus.state}`}>
                        {sorter.sheetScoreStatus.message}
                    </div>
                ) : null}
                <div className="song-list-table-wrap">
                    <table className="song-list-table">
                        <thead>
                        <tr>
                            <SortableHeader column="id" activeColumn={sortColumn} direction={sortDirection} onSort={changeSort}>
                                ID
                            </SortableHeader>
                            <SortableHeader column="anime" activeColumn={sortColumn} direction={sortDirection} onSort={changeSort}>
                                Anime
                            </SortableHeader>
                            <SortableHeader column="song" activeColumn={sortColumn} direction={sortDirection} onSort={changeSort}>
                                Song
                            </SortableHeader>
                            <th>Links</th>
                            <SortableHeader column="score" activeColumn={sortColumn} direction={sortDirection} onSort={changeSort}>
                                Score
                            </SortableHeader>
                            {sorter ? <SortableHeader column="sheetScore" activeColumn={sortColumn} direction={sortDirection} onSort={changeSort}>
                                Sheet score
                            </SortableHeader> : null}
                            {sorter ? <th>
                  <span className="song-list-header-with-help">
                    Current range
                    <span
                        className="help-icon"
                        data-tooltip="Bounds on this song's final rank using current choices, scores, and the auto-skip gap. Assumes scores and settings stay unchanged. Bounds may be wider than the ranks actually reachable."
                        aria-label="Current range help"
                        tabIndex={0}
                    >
                      ?
                    </span>
                  </span>
                            </th> : null}
                            <th>Like</th>
                        </tr>
                        </thead>
                        <tbody>
                        {props.library && rows.length === 0 ? (
                            <tr><td colSpan={6}>No songs match the selected filter.</td></tr>
                        ) : null}
                        {rows.map(({song, index}) => {
                            const id = songEntryId(song);
                            const anime = songEntryAnime(song);
                            const name = songEntryName(song);
                            const range = sorter?.sort ? projectedRanges.get(index) ?? null : null;

                            return (
                                <tr key={id}>
                                    <td>{id}</td>
                                    <td title={anime}>{anime}</td>
                                    <td title={name}>{name}</td>
                                    <td>
                                        <SongLinks song={song}/>
                                    </td>
                                    <td>
                                        {sorter ? <input
                                            className="song-list-score-input"
                                            type="number"
                                            min="0"
                                            max="10"
                                            step="0.01"
                                            value={scoresBySongId[id] ?? ''}
                                            disabled={!sorter.scoreEnabled}
                                            onChange={(event) => sorter.onScoreChange(id, event.currentTarget.value)}
                                        /> : scoresBySongId[id] ?? ''}
                                    </td>
                                    {sorter ? <td>{sheetScoresBySongId[id] ?? ''}</td> : null}
                                    {sorter ? <td>{range ? formatRankRange(range.minRank, range.maxRank) : ''}</td> : null}
                                    <td>
                                        {songEntrySongs(song).map((item, index) => <LikeButton key={index} song={item}/>)}
                                    </td>
                                </tr>
                            );
                        })}
                        </tbody>
                    </table>
                </div>
                <div className="song-list-actions">
                    {sorter ? <button
                        className="song-list-write-button"
                        type="button"
                        onClick={sorter.onWriteSheetScores}
                        disabled={!sorter.canWriteSheetScores || sorter.isWritingSheetScores}
                    >
                        {sorter.isWritingSheetScores ? 'Writing to spreadsheet...' : 'Write to spreadsheet'}
                    </button> : null}
                    <button className="close-button" type="button" onClick={onClose}>
                        Close
                    </button>
                </div>
            </div>
        </>
    );
}

function SortableHeader({
    column,
    activeColumn,
    direction,
    children,
    onSort,
}: {
    column: SortColumn;
    activeColumn: SortColumn;
    direction: SortDirection;
    children: string;
    onSort(column: SortColumn): void;
}) {
    const active = column === activeColumn;

    return (
        <th aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : undefined}>
            <button
                className={`song-list-sort-header${active ? ' song-list-sort-header--active' : ''}`}
                type="button"
                onClick={() => onSort(column)}
            >
                <span>{children}</span>
                <span className="song-list-sort-header__indicator">{active ? (direction === 'asc' ? '^' : 'v') : ''}</span>
            </button>
        </th>
    );
}

function compareRows(
    left: { song: ResolvedSongEntry; index: number },
    right: { song: ResolvedSongEntry; index: number },
    column: SortColumn,
    direction: SortDirection,
    scoresBySongId: SongScoresById,
    sheetScoresBySongId: SongScoresById,
): number {
    const multiplier = direction === 'asc' ? 1 : -1;
    const compared = compareByColumn(left, right, column, scoresBySongId, sheetScoresBySongId);
    return (compared || songEntryId(left.song) - songEntryId(right.song)) * multiplier;
}

function compareByColumn(
    left: { song: ResolvedSongEntry; index: number },
    right: { song: ResolvedSongEntry; index: number },
    column: SortColumn,
    scoresBySongId: SongScoresById,
    sheetScoresBySongId: SongScoresById,
): number {
    const leftId = songEntryId(left.song);
    const rightId = songEntryId(right.song);

    if (column === 'id') {
        return leftId - rightId;
    }

    if (column === 'anime') {
        return compareText(songEntryAnime(left.song), songEntryAnime(right.song));
    }

    if (column === 'song') {
        return compareText(songEntryName(left.song), songEntryName(right.song));
    }

    if (column === 'score') {
        return compareScores(scoresBySongId[leftId], scoresBySongId[rightId]);
    }

    return compareScores(sheetScoresBySongId[leftId], sheetScoresBySongId[rightId]);
}

function compareText(left: string, right: string): number {
    return left.localeCompare(right, undefined, {numeric: true, sensitivity: 'base'});
}

function compareScores(left: string | undefined, right: string | undefined): number {
    const leftScore = parseScore(left);
    const rightScore = parseScore(right);

    if (leftScore === null && rightScore === null) {
        return compareText(left ?? '', right ?? '');
    }

    if (leftScore === null) {
        return 1;
    }

    if (rightScore === null) {
        return -1;
    }

    return leftScore - rightScore;
}

function parseScore(score: string | undefined): number | null {
    if (!score?.trim()) {
        return null;
    }

    const parsed = Number.parseFloat(score);
    return Number.isFinite(parsed) ? parsed : null;
}

function formatRankRange(minRank: number, maxRank: number): string {
    return minRank === maxRank ? String(minRank) : `${minRank}-${maxRank}`;
}

function SongLinks({song}: { song: ResolvedSongEntry }) {
    const links = songEntrySongs(song).flatMap((entrySong: ResolvedSong, index) =>
        [
            {label: linkLabel('video', index, song), href: entrySong.video},
            {label: linkLabel('mp3', index, song), href: entrySong.mp3},
            {label: linkLabel('full', index, song), href: entrySong.full},
        ].filter((link): link is { label: string; href: string } => Boolean(link.href)),
    );

    if (links.length === 0) {
        return <span className="song-list-links__empty">No link</span>;
    }

    return (
        <div className="song-list-links">
            {links.map((link) => (
                <a key={`${link.label}-${link.href}`} href={visibleUrl(link.href)} target="_blank" rel="noreferrer">
                    {link.label}
                </a>
            ))}
        </div>
    );
}

function linkLabel(label: string, index: number, song: ResolvedSongEntry): string {
    return Array.isArray(song) ? `${label} ${index + 1}` : label;
}

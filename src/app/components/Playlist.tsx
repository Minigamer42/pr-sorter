import { useState } from 'react';
import { Media } from '../../media';
import { songEntryId, songEntrySongs, songWithTypeLabel, type ResolvedSongEntry } from '../../songs';
import type { AppConfig, Settings, SongScoresById } from '../types';
import { LikeButton } from './LikeButton';
import { FullscreenButton } from './FullscreenButton';
import { PlaylistStage } from './PlaylistStage';

export type PlaylistMode = 'in-order' | 'random';
export type SorterPlaylistScoreFilter = 'all' | 'unscored';
export type PlaylistScoreFilter = SorterPlaylistScoreFilter | 'liked' | 'above-threshold';

type PlaylistProps = {
    config: AppConfig;
    songs: ResolvedSongEntry[];
    currentSong: ResolvedSongEntry | null;
    currentPosition: number;
    orderLength: number;
    scoredSongCount: number;
    totalSongCount: number;
    mode: PlaylistMode;
    scoreFilter: PlaylistScoreFilter;
    scoreThreshold?: number;
    library?: boolean;
    emptyMessage?: string;
    emptyPositionLabel?: string;
    settings: Settings;
    scoreEnabled: boolean;
    scoresBySongId: SongScoresById;
    canWriteSheetScores: boolean;
    sheetScoresSetupReason: string | null;
    isWritingSheetScores: boolean;
    onModeChange(mode: PlaylistMode): void;
    onScoreFilterChange(filter: PlaylistScoreFilter): void;
    onPrevious(): void;
    onNext(): void;
    onAutoNext(): void;
    onScoreChange(songId: number, score: string): void;
    onWriteSheetScores(): void;
    onSetupGoogleSheet(): void;
};

export function Playlist({
    config,
    songs,
    currentSong,
    currentPosition,
    orderLength,
    scoredSongCount,
    totalSongCount,
    mode,
    scoreFilter,
    scoreThreshold = 8,
    library = false,
    emptyMessage,
    emptyPositionLabel,
    settings,
    scoreEnabled,
    scoresBySongId,
    canWriteSheetScores,
    sheetScoresSetupReason,
    isWritingSheetScores,
    onModeChange,
    onScoreFilterChange,
    onPrevious,
    onNext,
    onAutoNext,
    onScoreChange,
    onWriteSheetScores,
    onSetupGoogleSheet,
}: PlaylistProps) {
    const [activeSongIndex, setActiveSongIndex] = useState(0);
    const [playingSongIndex, setPlayingSongIndex] = useState<number | null>(null);
    const currentSongId = currentSong ? songEntryId(currentSong) : null;

    const entryKey = `${currentPosition}:${currentSongId}:${settings.mediaFormat}:${settings.region}`;
    const [previousEntryKey, setPreviousEntryKey] = useState(entryKey);
    if (previousEntryKey !== entryKey) {
        // Reset before committing children so retained players receive only the
        // incoming entry's playback intent, including after grouped entries.
        setPreviousEntryKey(entryKey);
        setActiveSongIndex(0);
        setPlayingSongIndex(null);
    }

    const writeScoresButton = scoreEnabled && !library ? (
        <button
            className="playlist-mode__button"
            type="button"
            onClick={sheetScoresSetupReason ? onSetupGoogleSheet : onWriteSheetScores}
            disabled={scoredSongCount === 0 || isWritingSheetScores || (!canWriteSheetScores && !sheetScoresSetupReason)}
            title={sheetScoresSetupReason ?? undefined}
        >
            {isWritingSheetScores ? 'Writing...' : sheetScoresSetupReason ? 'Choose sheet' : 'Write scores'}
        </button>
    ) : null;

    if (!library && songs.length === 0) {
        return <div className="playlist"><div className="playlist-empty">No songs are configured.</div></div>;
    }

    if (!currentSong) {
        return (
            <div className="playlist">
                <div className="playlist-toolbar">
                    <div className="playlist-position">
                        {emptyPositionLabel ?? `${scoredSongCount} / ${totalSongCount} scored`}
                    </div>
                    <PlaylistToolbarControls
                        mode={mode}
                        scoreFilter={scoreFilter}
                        scoreThreshold={scoreThreshold}
                        library={library}
                        scoreEnabled={scoreEnabled}
                        writeScoresButton={writeScoresButton}
                        onModeChange={onModeChange}
                        onScoreFilterChange={onScoreFilterChange}
                    />
                </div>
                <div className="playlist-empty">{emptyMessage ?? (songs.length === 0 ? 'No songs are configured.' : scoreFilter === 'liked' ? 'No liked songs yet. Use the heart button to like a song.' : scoreFilter === 'above-threshold' ? `No songs have a score ≥ ${scoreThreshold}.` : 'All songs have scores.')}</div>
            </div>
        );
    }

    if (currentSongId === null) {
        return null;
    }

    const currentSongs = songEntrySongs(currentSong);
    const clampedActiveSongIndex = Math.min(activeSongIndex, currentSongs.length - 1);

    function mediaStarted(index: number): void {
        setPlayingSongIndex(index);
        setActiveSongIndex(index);
    }

    function mediaPaused(index: number): void {
        setPlayingSongIndex((current) => (current === index ? null : current));
    }

    function mediaEnded(index: number): void {
        setPlayingSongIndex((current) => (current === index ? null : current));
        if (index < currentSongs.length - 1) {
            setActiveSongIndex(index + 1);
            return;
        }

        setActiveSongIndex(0);
        onAutoNext();
    }

    function previousEntry(): void {
        setActiveSongIndex(0);
        setPlayingSongIndex(null);
        onPrevious();
    }

    function nextEntry(): void {
        setActiveSongIndex(0);
        setPlayingSongIndex(null);
        onNext();
    }

    return (
        <div className="playlist">
            <div className="playlist-toolbar">
                <div className="playlist-position">
                    {scoreFilter === 'unscored'
                        ? `${scoredSongCount} / ${totalSongCount} scored · ID ${currentSongId}`
                        : `${currentPosition + 1} / ${orderLength}`}
                </div>
                <PlaylistToolbarControls
                    mode={mode}
                    scoreFilter={scoreFilter}
                    scoreThreshold={scoreThreshold}
                    library={library}
                    scoreEnabled={scoreEnabled}
                    writeScoresButton={writeScoresButton}
                    onModeChange={onModeChange}
                    onScoreFilterChange={onScoreFilterChange}
                />
            </div>

            <PlaylistStage
                className={`playlist-card${scoreEnabled ? ' playlist-card--scored' : ''}${currentSongs.length > 1 ? ' playlist-card--group' : ''}`}
                playingIndex={playingSongIndex}
                activeIndex={clampedActiveSongIndex}
                entryId={currentSongId}
            >
                <div className={currentSongs.length > 1 ? 'playlist-media-grid' : 'playlist-media'}>
                    {currentSongs.map((song, index) => {
                        const labelledSong = songWithTypeLabel(song, config.songTypes?.[index]);
                        const shouldAutoPlay = index === clampedActiveSongIndex;
                        const isPlaying = currentSongs.length > 1 && index === playingSongIndex;

                        return (
                            <div className={`playlist-media-entry${isPlaying ? ' playlist-media-entry--active' : ''}`} data-playlist-active={index === clampedActiveSongIndex ? 'true' : undefined} key={index}>
                                <div className="playlist-media">
                                    <div className="playlist-media-viewport">
                                        <Media
                                            playbackKey={`${currentPosition}:${currentSongId}:${index}:${settings.mediaFormat}:${settings.region}`}
                                            song={song}
                                            settings={settings}
                                            autoPlay={shouldAutoPlay}
                                            paused={playingSongIndex !== null && playingSongIndex !== index}
                                            onPlay={() => mediaStarted(index)}
                                            onPause={() => mediaPaused(index)}
                                            onEnded={() => mediaEnded(index)}
                                        />
                                    </div>
                                    <div className="media-control-buttons">
                                        <LikeButton song={song}/>
                                        {index === 0 ? (
                                            <FullscreenButton targetSelector=".playlist-card" label="Open playlist card fullscreen" className="playlist-fullscreen-button"/>
                                        ) : null}
                                    </div>
                                </div>
                                <div className="playlist-song-meta">
                                    <div className="playlist-anime" title={labelledSong.anime}>{labelledSong.anime}</div>
                                    <div className="playlist-song" title={labelledSong.name}>{labelledSong.name}</div>
                                </div>
                            </div>
                        );
                    })}
                </div>
                {scoreEnabled ? (
                    <label className="score-field playlist-score-field">
                        <span>{library ? 'Saved score' : 'Score'}</span>
                        <input
                            type="number"
                            min="0"
                            max="10"
                            step="0.01"
                            value={scoresBySongId[currentSongId] ?? ''}
                            readOnly={library}
                            onChange={(event) => onScoreChange(currentSongId, event.currentTarget.value)}
                        />
                    </label>
                ) : null}
                <div className="playlist-actions">
                    <button type="button" onClick={previousEntry}>
                        Previous
                    </button>
                    <button type="button" onClick={nextEntry}>
                        Next
                    </button>
                </div>
            </PlaylistStage>
        </div>
    );
}

type PlaylistToolbarControlsProps = {
    mode: PlaylistMode;
    scoreFilter: PlaylistScoreFilter;
    scoreThreshold: number;
    library: boolean;
    scoreEnabled: boolean;
    writeScoresButton: React.ReactNode;
    onModeChange(mode: PlaylistMode): void;
    onScoreFilterChange(filter: PlaylistScoreFilter): void;
};

function PlaylistToolbarControls({
    mode,
    scoreFilter,
    scoreThreshold,
    library,
    scoreEnabled,
    writeScoresButton,
    onModeChange,
    onScoreFilterChange,
}: PlaylistToolbarControlsProps) {
    return (
        <div className="playlist-toolbar-controls">
            {writeScoresButton ? (
                <div className="playlist-mode" aria-label="Playlist score writeback">
                    {writeScoresButton}
                </div>
            ) : null}
            <div className="playlist-mode" aria-label="Playlist order">
                <button
                    className={`playlist-mode__button${mode === 'in-order' ? ' playlist-mode__button--active' : ''}`}
                    type="button"
                    onClick={() => onModeChange('in-order')}
                >
                    In order
                </button>
                <button
                    className={`playlist-mode__button${mode === 'random' ? ' playlist-mode__button--active' : ''}`}
                    type="button"
                    onClick={() => onModeChange('random')}
                >
                    Random
                </button>
            </div>
            {scoreEnabled ? (
                <>
                    <div className="playlist-mode" aria-label="Playlist score filter">
                        {(library ? ['liked', 'above-threshold'] as const : ['all', 'unscored'] as const).map((filter) => (
                            <button
                                key={filter}
                                className={`playlist-mode__button${scoreFilter === filter ? ' playlist-mode__button--active' : ''}`}
                                type="button"
                                aria-pressed={scoreFilter === filter}
                                onClick={() => onScoreFilterChange(filter)}
                            >
                                {{ all: 'All songs', unscored: 'No score', liked: 'Liked songs', 'above-threshold': `Score ≥ ${scoreThreshold}` }[filter]}
                            </button>
                        ))}
                    </div>
                </>
            ) : null}
        </div>
    );
}

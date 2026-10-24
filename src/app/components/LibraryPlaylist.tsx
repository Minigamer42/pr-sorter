import { useEffect, useMemo, useState } from 'react';
import { MediaStoragePrefixContext } from '../../media';
import type { ResolvedSong } from '../../songs';
import { saveLibraryScoreThreshold, songPassesThreshold } from '../songLibrary';
import { libraryFilterFromUrl, libraryHref, libraryOverviewHref } from '../libraryRouting';
import { createStorage } from '../storage';
import type { AppConfig, Settings, SongScoresById } from '../types';
import { useLibraryScores, useSongLibrary } from '../useSongLibrary';
import { Playlist, type PlaylistMode, type PlaylistScoreFilter } from './Playlist';
import { LibrarySettingsModal } from './LibrarySettingsModal';
import { discoverSavedLibrarySongs } from '../songLibraryDiscovery';
import { createLibrarySongSourceLoader } from '../loadLibrarySongSource';

const config: AppConfig = {
    localStoragePrefix: 'pr-sorter-global-playlist',
    title: 'Your song library',
    description: 'Liked and rated songs across all your sorters.',
};

function shuffledKeys(keys: string[]): string[] {
    const shuffled = [...keys];
    for (let index = shuffled.length - 1; index > 0; index--) {
        const other = Math.floor(Math.random() * (index + 1));
        [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
    }
    return shuffled;
}

export function LibraryPlaylist({ initialFilter }: { initialFilter: 'liked' | 'above-threshold' }) {
    const library = useSongLibrary();
    const scores = useLibraryScores(library);
    const [filter, setFilter] = useState<PlaylistScoreFilter>(initialFilter);
    const [mode, setMode] = useState<PlaylistMode>('in-order');
    const [currentKey, setCurrentKey] = useState<string | null>(null);
    const [settings, setSettings] = useState(() => createStorage(config, []).loadSettings());
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [discoveryAttempt, setDiscoveryAttempt] = useState(0);
    const [discovery, setDiscovery] = useState({ loading: true, unresolvedPrefixes: [] as string[] });
    const loadSongSource = useMemo(() => createLibrarySongSourceLoader(libraryOverviewHref(window.location.href)), []);
    const keys = Object.keys(library.songs);
    const eligible = keys.filter((key) => filter === 'liked' ? library.liked.includes(key) : songPassesThreshold(scores[key], library.scoreThreshold));
    const randomOrder = useMemo(() => shuffledKeys(eligible), [eligible.join('\n'), mode]);
    const order = mode === 'in-order' ? eligible : randomOrder;
    const position = Math.max(0, currentKey === null ? 0 : order.indexOf(currentKey));
    const activeKey = order[position];
    // The shared player uses numeric IDs; these IDs belong only to this view.
    const songs = useMemo<ResolvedSong[]>(() => Object.values(library.songs).map((song, id) => ({ ...song, id })), [library.songs]);
    const scoresBySongId: SongScoresById = Object.fromEntries(keys.flatMap((key, id) => scores[key] === undefined ? [] : [[id, String(scores[key])]]));
    const currentSong = activeKey === undefined ? null : songs[keys.indexOf(activeKey)];

    useEffect(() => {
        let cancelled = false;
        setDiscovery((current) => ({ ...current, loading: true }));
        void discoverSavedLibrarySongs(loadSongSource)
            .then((result) => {
                if (!cancelled) setDiscovery({ loading: false, ...result });
            });
        return () => { cancelled = true; };
    }, [discoveryAttempt, loadSongSource]);

    useEffect(() => {
        const savedScoresChanged = (event: StorageEvent) => {
            if (event.key === null || event.key.endsWith(':scores')) setDiscoveryAttempt((attempt) => attempt + 1);
        };
        window.addEventListener('storage', savedScoresChanged);
        return () => window.removeEventListener('storage', savedScoresChanged);
    }, []);

    useEffect(() => {
        document.title = config.title;
        const followRoute = () => {
            setFilter(libraryFilterFromUrl(window.location.href) ?? initialFilter);
            setCurrentKey(null);
        };
        window.addEventListener('popstate', followRoute);
        return () => window.removeEventListener('popstate', followRoute);
    }, [initialFilter]);

    // Remember the fallback when a playing song is unliked or a score changes.
    useEffect(() => {
        setCurrentKey(activeKey ?? null);
    }, [activeKey]);

    function changeMode(nextMode: PlaylistMode): void {
        setCurrentKey(null);
        setMode(nextMode);
    }

    function changeFilter(nextFilter: PlaylistScoreFilter): void {
        if (nextFilter === filter || (nextFilter !== 'liked' && nextFilter !== 'above-threshold')) return;
        setFilter(nextFilter);
        setCurrentKey(null);
        window.history.pushState(null, '', libraryHref(libraryOverviewHref(window.location.href), window.location.href, nextFilter));
    }

    function move(direction: 1 | -1): void {
        setCurrentKey(order.length ? order[(position + direction + order.length) % order.length] : null);
    }

    function changeSettings(nextSettings: Settings): void {
        setSettings(nextSettings);
        createStorage(config, []).saveSettings(nextSettings);
    }

    function changeThreshold(threshold: number): void {
        saveLibraryScoreThreshold(threshold);
        setCurrentKey(null);
    }

    return (
        <MediaStoragePrefixContext.Provider value={config.localStoragePrefix}>
            <LibrarySettingsModal
                open={settingsOpen}
                settings={settings}
                scoreThreshold={library.scoreThreshold}
                onClose={() => setSettingsOpen(false)}
                onSettingsChange={changeSettings}
                onThresholdChange={changeThreshold}
            />
            <div className="main-page library-page">
                <div className="title">Your song library</div>
                <div className="button-container">
                    <a className="basic-button" href={libraryOverviewHref(window.location.href)}>Overview</a>
                    <button className="basic-button" type="button" aria-haspopup="dialog" onClick={() => setSettingsOpen(true)}>Settings</button>
                </div>
                {discovery.unresolvedPrefixes.length > 0 && !discovery.loading ? (
                    <div className="library-load-status" role="status">
                        Could not load songs for {discovery.unresolvedPrefixes.length} saved {discovery.unresolvedPrefixes.length === 1 ? 'sorter' : 'sorters'}.
                        <button className="basic-button" type="button" onClick={() => setDiscoveryAttempt((attempt) => attempt + 1)}>Retry</button>
                    </div>
                ) : null}
                <Playlist
                    config={config}
                    songs={songs}
                    currentSong={currentSong}
                    currentPosition={position}
                    orderLength={order.length}
                    scoredSongCount={Object.keys(scores).length}
                    totalSongCount={songs.length}
                    mode={mode}
                    scoreFilter={filter}
                    scoreThreshold={library.scoreThreshold}
                    library
                    emptyMessage={discovery.loading ? 'Loading saved songs…' : discovery.unresolvedPrefixes.length ? 'Some saved songs could not be loaded. Use Retry to try again.' : filter === 'liked' ? 'No liked songs yet. Use the heart button on any song to add it here.' : `No songs have a saved score ≥ ${library.scoreThreshold}.`}
                    emptyPositionLabel={discovery.loading ? 'Loading saved songs…' : discovery.unresolvedPrefixes.length ? 'Some saved songs are unavailable' : undefined}
                    settings={settings}
                    scoreEnabled
                    scoresBySongId={scoresBySongId}
                    canWriteSheetScores={false}
                    sheetScoresSetupReason={null}
                    isWritingSheetScores={false}
                    onModeChange={changeMode}
                    onScoreFilterChange={changeFilter}
                    onPrevious={() => move(-1)}
                    onNext={() => move(1)}
                    onAutoNext={() => move(1)}
                    onScoreChange={() => undefined}
                    onWriteSheetScores={() => undefined}
                    onSetupGoogleSheet={() => undefined}
                />
            </div>
        </MediaStoragePrefixContext.Provider>
    );
}

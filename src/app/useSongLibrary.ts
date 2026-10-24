import { useMemo, useSyncExternalStore } from 'react';
import { libraryScores, parseSongLibrary, songLibraryChanged, songLibraryKey, type SongLibrary } from './songLibrary';

let cachedRaw: string | null | undefined;
let cachedLibrary: SongLibrary;

function librarySnapshot(): SongLibrary {
    const raw = localStorage.getItem(songLibraryKey);
    if (raw !== cachedRaw) {
        cachedRaw = raw;
        cachedLibrary = parseSongLibrary(raw);
    }
    return cachedLibrary;
}

function subscribe(listener: () => void): () => void {
    window.addEventListener('storage', listener);
    window.addEventListener(songLibraryChanged, listener);
    return () => {
        window.removeEventListener('storage', listener);
        window.removeEventListener(songLibraryChanged, listener);
    };
}

export function useSongLibrary() {
    return useSyncExternalStore(subscribe, librarySnapshot);
}

export function useLibraryScores(library: SongLibrary) {
    const raw = useSyncExternalStore(subscribe, () => JSON.stringify(
        Object.keys(library.sources).map((prefix) => localStorage.getItem(`${prefix}:scores`)),
    ));
    return useMemo(() => libraryScores(library), [library, raw]);
}

import type { ResolvedSongEntry } from '../songs';
import { parseSongLibrary, registerLibrarySongs, savedScoresForPrefix, songLibraryKey } from './songLibrary';

type DiscoveryStorage = Pick<Storage, 'getItem' | 'setItem' | 'key' | 'length'>;

export function savedScorePrefixes(storage: DiscoveryStorage = localStorage): string[] {
    const prefixes: string[] = [];
    for (let index = 0; index < storage.length; index++) {
        const key = storage.key(index);
        if (!key?.endsWith(':scores')) continue;
        const prefix = key.slice(0, -':scores'.length);
        if (Object.keys(savedScoresForPrefix(prefix, storage)).length) prefixes.push(prefix);
    }
    return prefixes.sort();
}

export async function discoverSavedLibrarySongs(
    loadSongs: (prefix: string) => Promise<ResolvedSongEntry[]>,
    storage: DiscoveryStorage = localStorage,
): Promise<{ unresolvedPrefixes: string[] }> {
    const library = parseSongLibrary(storage.getItem(songLibraryKey));
    const missing = savedScorePrefixes(storage).filter((prefix) =>
        Object.keys(savedScoresForPrefix(prefix, storage)).some((id) => {
            const keys = library.sources[prefix]?.[id];
            return !keys?.length || keys.some((key) => !library.songs[key]);
        }),
    );
    const unresolvedPrefixes: string[] = [];
    let nextIndex = 0;
    // Only load catalogs for saved ratings; avoid fetching every published sorter.
    await Promise.all(Array.from({ length: Math.min(3, missing.length) }, async () => {
        while (nextIndex < missing.length) {
            const prefix = missing[nextIndex++];
            try {
                const songs = await loadSongs(prefix);
                registerLibrarySongs(prefix, songs, storage);
                const updated = parseSongLibrary(storage.getItem(songLibraryKey));
                if (Object.keys(savedScoresForPrefix(prefix, storage)).some((id) => !updated.sources[prefix]?.[id]?.length)) {
                    unresolvedPrefixes.push(prefix);
                }
            } catch {
                unresolvedPrefixes.push(prefix);
            }
        }
    }));
    return { unresolvedPrefixes: unresolvedPrefixes.sort() };
}

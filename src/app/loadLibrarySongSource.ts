import { z } from 'zod';
import { config } from '../../customize/config';
import { songList } from '../../customize/songList';
import { loadExternalSorterSongs, loadSorterSongs } from '../externalSorter/externalSorter';
import { resolveSongEntry, type ResolvedSongEntry } from '../songs';
import { sorters } from '../sorterIndex/sorters.generated';
import type { AppConfig } from './types';

const hostConfig: AppConfig = config;

const song = z.object({
    id: z.number(), anime: z.string(), name: z.string(),
    video: z.string().nullable().optional(), mp3: z.string().nullable().optional(), full: z.string().nullable().optional(),
});
const catalogSchema = z.object({
    localStoragePrefix: z.string(),
    songs: z.array(z.union([song, z.array(song).min(1)])),
});

export function createLibrarySongSourceLoader(overviewUrl: string) {
    const pending = new Map<string, Promise<ResolvedSongEntry[]>>();
    return (prefix: string): Promise<ResolvedSongEntry[]> => {
        const existing = pending.get(prefix);
        if (existing) return existing;
        const request = load(prefix).finally(() => { pending.delete(prefix); });
        pending.set(prefix, request);
        return request;
    };

    async function load(prefix: string): Promise<ResolvedSongEntry[]> {
        if (prefix === hostConfig.localStoragePrefix) {
            return songList.map((entry) => resolveSongEntry(entry, fallbackName(hostConfig)));
        }
        const external = /^external:([^:]+):(.+)$/.exec(prefix);
        if (external) {
            const loaded = await loadExternalSorterSongs({ sourceRouteSlug: external[1], sorterSlug: external[2] });
            return loaded.songs.map((entry) => resolveSongEntry(entry, fallbackName(loaded)));
        }
        const sorter = sorters.find((entry) => (entry.localStoragePrefix ?? entry.slug) === prefix);
        if (!sorter) throw new Error(`No song catalog was found for saved sorter "${prefix}".`);
        const sorterUrl = new URL(sorter.url ?? `${sorter.slug}/`, overviewUrl);
        try {
            const response = await fetch(new URL('song-library.json', sorterUrl), { signal: AbortSignal.timeout(10000) });
            if (!response.ok) throw new Error('Song catalog unavailable.');
            const catalog = catalogSchema.parse(await response.json());
            if (catalog.localStoragePrefix !== prefix) throw new Error('Song catalog belongs to a different sorter.');
            return catalog.songs;
        } catch {
            // Older published sorters have their song list in their existing bundle.
            const songs = await loadSorterSongs(new URL(overviewUrl), sorterUrl, sorter.slug, sorter.songCount);
            return songs.map((entry) => resolveSongEntry(entry, fallbackName(sorter)));
        }
    }
}

function fallbackName(config: Pick<AppConfig, 'title' | 'fallbackAnimeName'>): string {
    return config.fallbackAnimeName?.trim() || config.title.replace(/\s+Sorter$/i, '').trim() || config.title;
}

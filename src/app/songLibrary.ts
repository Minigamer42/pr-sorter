import { z } from 'zod';
import { youtubeVideoId } from '../media/internal/urls';
import { songEntryId, songEntrySongs, type ResolvedSong, type ResolvedSongEntry } from '../songs';
import { normalizeScore } from './internal/songScores';

export const songLibraryKey = 'pr-sorter:global-song-library:v1';
export const songLibraryChanged = 'pr-sorter:song-library-changed';

const songSchema = z.object({
    id: z.number(),
    anime: z.string(),
    name: z.string(),
    video: z.string().nullable().optional(),
    mp3: z.string().nullable().optional(),
    full: z.string().nullable().optional(),
});

const librarySchema = z.object({
    version: z.literal(1),
    songs: z.record(z.string(), songSchema),
    liked: z.array(z.string()),
    sources: z.record(z.string(), z.record(z.string(), z.array(z.string()))),
    scoreThreshold: z.number().min(0).max(10),
});

export type SongLibrary = z.infer<typeof librarySchema>;
type LibraryStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function parseSongLibrary(raw: string | null): SongLibrary {
    try {
        const result = librarySchema.safeParse(JSON.parse(raw ?? 'null'));
        if (result.success) return result.data;
    } catch {
        // A malformed library must not prevent opening a sorter.
    }
    return { version: 1, songs: {}, liked: [], sources: {}, scoreThreshold: 8 };
}

// Sorter IDs are local to each list. Use the recording instead so likes survive
// different IDs, YouTube URL forms, and AMQ delivery regions across sorters.
export function songLibraryId(song: ResolvedSong): string {
    const media = song.video || song.mp3 || song.full;
    if (media) {
        const youtubeId = youtubeVideoId(media);
        if (youtubeId) return `youtube:${youtubeId}`;
        try {
            const url = new URL(media);
            if (url.hostname.endsWith('.animemusicquiz.com')) return `amq:${url.pathname}`;
            url.hash = '';
            return `media:${url.href}`;
        } catch {
            return `media:${media}`;
        }
    }
    return `song:${JSON.stringify([song.anime.trim().toLowerCase(), song.name.trim().toLowerCase()])}`;
}

function saveSongLibrary(library: SongLibrary, storage: LibraryStorage): void {
    const raw = JSON.stringify(library);
    if (storage.getItem(songLibraryKey) === raw) return;
    storage.setItem(songLibraryKey, raw);
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(songLibraryChanged));
}

export function registerLibrarySongs(prefix: string, songs: ResolvedSongEntry[], storage: LibraryStorage = localStorage): void {
    const library = parseSongLibrary(storage.getItem(songLibraryKey));
    const source: Record<string, string[]> = {};
    for (const entry of songs) {
        source[songEntryId(entry)] = songEntrySongs(entry).map((song) => {
            const key = songLibraryId(song);
            library.songs[key] = { ...library.songs[key], ...song };
            return key;
        });
    }
    library.sources[prefix] = source;
    saveSongLibrary(library, storage);
}

export function toggleSongLike(song: ResolvedSong, storage: LibraryStorage = localStorage): void {
    const library = parseSongLibrary(storage.getItem(songLibraryKey));
    const key = songLibraryId(song);
    library.songs[key] = song;
    library.liked = library.liked.includes(key) ? library.liked.filter((id) => id !== key) : [...library.liked, key];
    saveSongLibrary(library, storage);
}

export function saveLibraryScoreThreshold(threshold: number, storage: LibraryStorage = localStorage): void {
    if (!Number.isFinite(threshold) || threshold < 0 || threshold > 10) return;
    const library = parseSongLibrary(storage.getItem(songLibraryKey));
    library.scoreThreshold = threshold;
    saveSongLibrary(library, storage);
}

export function libraryScores(library: SongLibrary, storage: Pick<Storage, 'getItem'> = localStorage): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [prefix, entries] of Object.entries(library.sources)) {
        const scores = savedScoresForPrefix(prefix, storage);
        for (const [id, keys] of Object.entries(entries)) {
            const score = scores[id];
            if (score === undefined) continue;
            for (const key of keys) result[key] = Math.max(result[key] ?? score, score);
        }
    }
    return result;
}

export function savedScoresForPrefix(prefix: string, storage: Pick<Storage, 'getItem'> = localStorage): Record<string, number> {
    const result: Record<string, number> = {};
    try {
        const scores: unknown = JSON.parse(storage.getItem(`${prefix}:scores`) ?? '{}');
        if (!scores || typeof scores !== 'object' || Array.isArray(scores)) return result;
        for (const [id, raw] of Object.entries(scores)) {
            if (!/^\d+$/.test(id) || (typeof raw !== 'string' && typeof raw !== 'number')) continue;
            try {
                const score = normalizeScore(String(raw));
                if (score !== null) result[id] = score;
            } catch {
                // One unfinished or invalid score must not hide other ratings.
            }
        }
    } catch {
        // Ignore malformed storage without deleting the user's save.
    }
    return result;
}

export function songPassesThreshold(raw: string | number | undefined, threshold: number): boolean {
    try {
        const score = normalizeScore(raw === undefined ? '' : String(raw));
        return score !== null && score >= threshold;
    } catch {
        return false;
    }
}

import type { ResolvedSong } from '../../songs';
import { songLibraryId, toggleSongLike } from '../songLibrary';
import { useSongLibrary } from '../useSongLibrary';

export function LikeButton({ song }: { song: ResolvedSong }) {
    const library = useSongLibrary();
    const liked = library.liked.includes(songLibraryId(song));
    return (
        <button
            type="button"
            className={`song-like-button${liked ? ' song-like-button--liked' : ''}`}
            aria-label={`${liked ? 'Unlike' : 'Like'} ${song.name}`}
            aria-pressed={liked}
            title={liked ? 'Remove global like' : 'Like across all sorters'}
            onClick={() => toggleSongLike(song)}
        >
            <svg width="18" height="18" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>
            </svg>
        </button>
    );
}

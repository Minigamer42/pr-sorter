import { type ReactElement, type Ref, createContext, useContext, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { MediaFormat, Settings } from '../app/types';
import type { SongData } from '../songs';
import { mediaType, normalizeAmqUrl, urlExtension, youtubeVideoId } from './internal/urls';
import { loadMediaVolume, saveMediaVolume } from './internal/volume';
import { YouTubePlayback, type YouTubePlayerInstance } from './internal/youtubePlayback';

type MediaField = 'video' | 'mp3' | 'full';

export const MediaStoragePrefixContext = createContext('pr-sorter');

const mediaPriorities: Record<MediaFormat, MediaField[]> = {
    video: ['video', 'mp3', 'full'],
    audio: ['mp3', 'video', 'full'],
    full: ['full', 'video', 'mp3'],
};

type MediaProps = {
    song: SongData;
    settings: Settings;
    autoPlay?: boolean;
    paused?: boolean;
    playbackKey?: string | number;
    onPlay?: () => void;
    onPause?: () => void;
    onEnded?: () => void;
};

type MediaSource =
    | { kind: 'youtube'; videoId: string }
    | { kind: 'video' | 'audio'; src: string; volumeStorageKey: string };

export function Media({song, settings, autoPlay = false, paused = false, playbackKey, onPlay, onPause, onEnded}: MediaProps): ReactElement {
    const storagePrefix = useContext(MediaStoragePrefixContext);
    const source = resolveMediaSource(song, settings, storagePrefix);
    const playback = {autoPlay, paused, playbackKey, onPlay, onPause, onEnded};

    return (
        <>
            <YouTubePlayer
                {...playback}
                videoId={source?.kind === 'youtube' ? source.videoId : null}
                title={`${song.name} video`}
            />
            <NativeMedia {...playback} kind="video" source={source?.kind === 'video' ? source : null}/>
            <NativeMedia {...playback} kind="audio" source={source?.kind === 'audio' ? source : null} title={`${song.name} audio`}/>
            {!source ? <div>Media not available</div> : null}
        </>
    );
}

function resolveMediaSource(song: SongData, settings: Settings, storagePrefix: string): MediaSource | null {
    for (const field of mediaPriorities[settings.mediaFormat]) {
        const url = song[field];
        if (!url) continue;

        const videoId = youtubeVideoId(url);
        if (videoId) return {kind: 'youtube', videoId};

        const extension = urlExtension(url);
        const kind = extension === '.mp3' ? 'audio' : extension === '.webm' || extension === '.mp4' ? 'video' : null;
        if (kind) {
            return {
                kind,
                src: normalizeAmqUrl(url, settings),
                volumeStorageKey: `${storagePrefix}:media-volume:${song.id}:${field}`,
            };
        }
    }
    return null;
}

type YouTubePlayerProps = Pick<MediaProps, 'autoPlay' | 'paused' | 'playbackKey' | 'onPlay' | 'onPause' | 'onEnded'> & {
    videoId: string | null;
    title: string;
};

type YouTubePlayerEvent = {
    data: number;
};

type YouTubeConstructor = new (
    element: HTMLElement,
    options: {
        playerVars: {
            autoplay: 0 | 1;
            modestbranding: 1;
            rel: 0;
        };
        events: {
            onReady(event: { target: YouTubePlayerInstance }): void;
            onStateChange(event: YouTubePlayerEvent): void;
        };
    },
) => YouTubePlayerInstance;

type YouTubeApi = {
    Player: YouTubeConstructor;
    PlayerState: {
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
    };
};

declare global {
    interface Window {
        YT?: YouTubeApi;
        onYouTubeIframeAPIReady?: () => void;
    }
}

let youtubeApiPromise: Promise<YouTubeApi> | null = null;

type NativeMediaProps = Pick<MediaProps, 'autoPlay' | 'paused' | 'playbackKey' | 'onPlay' | 'onPause' | 'onEnded'> & {
    kind: 'video' | 'audio';
    source: Extract<MediaSource, {src: string}> | null;
    title?: string;
};

function NativeMedia({kind, source, autoPlay = false, paused = false, playbackKey, title, onPlay, onPause, onEnded}: NativeMediaProps): ReactElement {
    const mediaRef = useRef<HTMLMediaElement | null>(null);
    const lastVolumeRef = useRef<number | null>(null);
    const previousSourceRef = useRef<string | null>(null);
    const previousAutoPlayRef = useRef(autoPlay);
    const src = source?.src;
    const volumeStorageKey = source?.volumeStorageKey;
    const sourceKey = JSON.stringify([src, volumeStorageKey, playbackKey]);

    useLayoutEffect(() => {
        const media = mediaRef.current;
        if (!media) return;

        const sourceChanged = previousSourceRef.current !== sourceKey;
        const wasAutoPlay = previousAutoPlayRef.current;
        previousSourceRef.current = sourceKey;
        previousAutoPlayRef.current = autoPlay;
        if (sourceChanged) {
            media.pause();
            if (volumeStorageKey) {
                const volume = loadMediaVolume(volumeStorageKey);
                lastVolumeRef.current = volume;
                media.volume = volume;
            }
            // Keep the element itself alive, including while its slot shows YouTube.
            media.load();
        }
        if (!src || paused || (wasAutoPlay && !autoPlay)) {
            media.pause();
        } else if (autoPlay) {
            if (media.ended) media.currentTime = 0;
            void media.play().catch(() => {
                // Browser autoplay policy can reject playback; controls remain usable.
            });
        }
    }, [src, volumeStorageKey, sourceKey, autoPlay, paused]);

    const handleVolumeChange = () => {
        const volume = mediaRef.current?.volume;
        if (volumeStorageKey && volume !== undefined && volume !== lastVolumeRef.current) {
            lastVolumeRef.current = volume;
            saveMediaVolume(volumeStorageKey, volume);
        }
    };
    const handlePlay = () => {
        const media = mediaRef.current;
        if (!src) {
            media?.pause();
        } else if (media && !media.paused) {
            onPlay?.();
        }
    };
    const handlePause = () => {
        // Ignore events queued by load() for the outgoing source.
        if (src && mediaRef.current?.paused) onPause?.();
    };
    const handleEnded = () => {
        if (src && mediaRef.current?.ended) {
            onPause?.();
            onEnded?.();
        }
    };
    const Element = kind;
    return (
        <Element
            ref={mediaRef as Ref<HTMLVideoElement & HTMLAudioElement>}
            controls
            hidden={!source}
            style={source ? undefined : {display: 'none'}}
            onPlay={handlePlay}
            onPause={handlePause}
            onEnded={handleEnded}
            onVolumeChange={handleVolumeChange}
            title={title}
        >
            {src ? <source src={src} type={mediaType(src, kind === 'video' ? 'video/webm' : 'audio/mp3')}/> : null}
        </Element>
    );
}

function YouTubePlayer({videoId, title, autoPlay = false, paused = false, playbackKey, onPlay, onPause, onEnded}: YouTubePlayerProps): ReactElement {
    const reactId = useId();
    const domId = `youtube-player-${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
    const mountRef = useRef<HTMLDivElement | null>(null);
    const [playback] = useState(() => new YouTubePlayback());
    const [started, setStarted] = useState(videoId !== null);
    const [failed, setFailed] = useState(false);
    // Start lazily, then retain the iframe even while native media is selected.
    if (videoId !== null && !started) setStarted(true);

    useLayoutEffect(() => {
        playback.update({videoId, autoPlay, paused, playbackKey}, {onPlay, onPause, onEnded});
    }, [playback, videoId, autoPlay, paused, playbackKey, onPlay, onPause, onEnded]);

    useEffect(() => {
        if (!started) return;
        let canceled = false;
        let player: YouTubePlayerInstance | null = null;
        const mount = mountRef.current!;
        const playerElement = document.createElement('div');
        safelyReplaceChildren(mount, playerElement);
        setFailed(false);

        void loadYouTubeApi().then((api) => {
            if (canceled) return;
            player = new api.Player(playerElement, {
                playerVars: {autoplay: 0, modestbranding: 1, rel: 0},
                events: {
                    onReady(event) {
                        if (!canceled) playback.attach(event.target);
                    },
                    onStateChange(event) {
                        if (!canceled) playback.handleState(event.data);
                    },
                },
            });
        }).catch((error: unknown) => {
            console.error('YouTube player failed to initialize:', error);
            if (!canceled) setFailed(true);
        });

        return () => {
            canceled = true;
            playback.detach();
            safelyControlYouTubePlayer(player, (instance) => instance.destroy());
            safelyReplaceChildren(mount);
        };
    }, [started, playback]);

    return (
        <div hidden={videoId === null} style={videoId === null ? {display: 'none'} : undefined} className="youtube-player" aria-label={title}>
            <div id={domId} ref={mountRef} style={failed ? {display: 'none'} : {width: '100%', height: '100%'}}/>
            {failed ? <div>Media not available</div> : null}
        </div>
    );
}

function safelyControlYouTubePlayer(player: YouTubePlayerInstance | null, action: (player: YouTubePlayerInstance) => void): void {
    if (!player) {
        return;
    }

    try {
        action(player);
    } catch (error) {
        console.error('YouTube player operation failed:', error);
    }
}

function safelyReplaceChildren(element: Element, ...nodes: Node[]): void {
    try {
        element.replaceChildren(...nodes);
    } catch (error) {
        console.error('YouTube player DOM cleanup failed:', error);
    }
}

function loadYouTubeApi(): Promise<YouTubeApi> {
    if (window.YT?.Player) {
        return Promise.resolve(window.YT);
    }

    if (youtubeApiPromise) {
        return youtubeApiPromise;
    }

    youtubeApiPromise = new Promise((resolve) => {
        const previousReady = window.onYouTubeIframeAPIReady;

        window.onYouTubeIframeAPIReady = () => {
            previousReady?.();
            if (window.YT?.Player) {
                resolve(window.YT);
            }
        };

        if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
            const script = document.createElement('script');
            script.src = 'https://www.youtube.com/iframe_api';
            script.async = true;
            document.head.appendChild(script);
        }
    });

    return youtubeApiPromise;
}

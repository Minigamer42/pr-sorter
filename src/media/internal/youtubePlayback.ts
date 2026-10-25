import { youtubeVideoId } from './urls';

export type YouTubePlayerInstance = {
    destroy(): void;
    getPlayerState(): number;
    getVideoUrl(): string;
    loadVideoById(videoId: string): void;
    cueVideoById(videoId: string): void;
    seekTo(seconds: number, allowSeekAhead: boolean): void;
    playVideo(): void;
    pauseVideo(): void;
};

type PlaybackRequest = {
    videoId: string | null;
    playbackKey?: string | number;
    autoPlay: boolean;
    paused: boolean;
};

type PlaybackCallbacks = {
    onPlay?: () => void;
    onPause?: () => void;
    onEnded?: () => void;
};

// A slot owns one player. Changing recordings loads/cues it; only unmounting
// the slot (or explicitly resetting it) destroys the iframe.
export class YouTubePlayback {
    private player: YouTubePlayerInstance | null = null;
    private request: PlaybackRequest = { videoId: null, autoPlay: false, paused: true };
    private callbacks: PlaybackCallbacks = {};
    private loaded: PlaybackRequest | null = null;
    private playing = false;

    update(request: PlaybackRequest, callbacks: PlaybackCallbacks): void {
        const previous = this.request;
        this.request = request;
        this.callbacks = callbacks;
        this.sync(previous);
    }

    attach(player: YouTubePlayerInstance): void {
        this.player = player;
        this.loaded = null;
        this.sync(null);
    }

    detach(): void {
        this.player = null;
        this.loaded = null;
        this.playing = false;
    }

    handleState(state: number): void {
        const { player, request } = this;
        if (!player) return;
        if (!request.videoId) {
            if (state === 1) player.pauseVideo();
            return;
        }

        // postMessage events from the outgoing video can arrive after a source
        // switch. They must not start or advance the incoming song.
        if (player.getPlayerState() !== state || youtubeVideoId(player.getVideoUrl()) !== request.videoId) return;

        if (state === 1) {
            this.playing = true;
            this.callbacks.onPlay?.();
        } else if (this.playing && (state === 2 || state === 0)) {
            this.playing = false;
            this.callbacks.onPause?.();
            if (state === 0) this.callbacks.onEnded?.();
        }
    }

    private sync(previous: PlaybackRequest | null): void {
        const { player, request } = this;
        if (!player) return;

        try {
            if (!request.videoId) {
                this.playing = false;
                this.loaded = null;
                if (previous?.videoId || previous === null) player.pauseVideo();
                return;
            }

            if (this.loaded?.videoId !== request.videoId || this.loaded.playbackKey !== request.playbackKey) {
                this.playing = false;
                this.loaded = request;
                if (request.autoPlay && !request.paused) {
                    player.loadVideoById(request.videoId);
                } else {
                    player.cueVideoById(request.videoId);
                }
                return;
            }

            if (request.paused) {
                if (!previous?.paused) player.pauseVideo();
            } else if (previous?.autoPlay && !request.autoPlay) {
                player.pauseVideo();
            } else if (request.autoPlay && (!previous?.autoPlay || previous.paused)) {
                if (player.getPlayerState() === 0) player.seekTo(0, true);
                player.playVideo();
            }
        } catch (error) {
            console.error('YouTube player operation failed:', error);
        }
    }
}

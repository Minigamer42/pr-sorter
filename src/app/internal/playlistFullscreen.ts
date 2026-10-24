export type PlaylistPlayback = { playingIndex: number | null; activeIndex: number; entryId: number };

const CONTROLS = '.media-control-buttons, .playlist-song-meta, .playlist-score-field, .playlist-actions';
const IMMERSIVE = 'playlist-stage--immersive';
const SETTLED = 'playlist-stage--immersive-settled';
const READY = 'playlist-stage--fullscreen-ready';

export function attachPlaylistFullscreen(stage: HTMLElement, playback: () => PlaylistPlayback) {
    const doc = stage.ownerDocument;
    const view = doc.defaultView!;
    let hideTimer: number | undefined;
    let handoffTimer: number | undefined;
    let settleTimer: number | undefined;
    let layoutFrame: number | undefined;
    let readyFrame: number | undefined;
    let controlsHovered = false;
    let previousPlayback = { ...playback() };
    const isFullscreen = () => doc.fullscreenElement === stage;
    const isControl = (target: EventTarget | null) => Boolean((target as Element | null)?.closest?.(CONTROLS));
    const clearHide = () => view.clearTimeout(hideTimer);
    const cancelFrames = () => {
        if (layoutFrame !== undefined) view.cancelAnimationFrame(layoutFrame);
        if (readyFrame !== undefined) view.cancelAnimationFrame(readyFrame);
    };
    const controlsActive = () => controlsHovered || [...stage.querySelectorAll<HTMLElement>(CONTROLS)].some(
        (element) => element.matches(':focus-visible') || Boolean(element.querySelector(':focus-visible')),
    );
    const scheduleHide = () => {
        clearHide();
        if (!isFullscreen() || playback().playingIndex === null) return;
        hideTimer = view.setTimeout(() => {
            if (!isFullscreen() || playback().playingIndex === null || controlsActive()) return;
            stage.classList.add(IMMERSIVE);
            view.clearTimeout(settleTimer);
            settleTimer = view.setTimeout(() => {
                if (stage.classList.contains(IMMERSIVE)) stage.classList.add(SETTLED);
            }, 500);
        }, 2500);
    };
    const reveal = () => {
        view.clearTimeout(handoffTimer);
        view.clearTimeout(settleTimer);
        stage.classList.remove(IMMERSIVE, SETTLED);
        scheduleHide();
    };
    const updateMediaBounds = () => {
        if (!isFullscreen()) return;
        for (const media of stage.querySelectorAll<HTMLElement>('.playlist-media-entry > .playlist-media')) {
            const viewport = media.querySelector<HTMLElement>('.playlist-media-viewport');
            if (!viewport) continue;
            const bounds = media.getBoundingClientRect();
            viewport.style.setProperty('--media-left', `${bounds.left}px`);
            viewport.style.setProperty('--media-top', `${bounds.top}px`);
            viewport.style.setProperty('--media-width', `${bounds.width}px`);
            viewport.style.setProperty('--media-height', `${bounds.height}px`);
        }
    };
    const Resize = (view as Window & typeof globalThis).ResizeObserver;
    const resized = typeof Resize === 'function' ? new Resize(updateMediaBounds) : null;
    const observeMedia = () => {
        resized?.disconnect();
        stage.querySelectorAll('.playlist-media-entry > .playlist-media').forEach((media) => resized?.observe(media));
        updateMediaBounds();
    };
    const fullscreenChanged = () => {
        cancelFrames();
        stage.classList.remove(READY);
        controlsHovered = [...stage.querySelectorAll(CONTROLS)].some((element) => element.matches(':hover'));
        observeMedia();
        reveal();
        if (isFullscreen()) {
            layoutFrame = view.requestAnimationFrame(() => {
                readyFrame = view.requestAnimationFrame(() => {
                    if (isFullscreen()) stage.classList.add(READY);
                });
            });
        }
    };
    const pointerOver = (event: PointerEvent) => { controlsHovered = isControl(event.target); };
    const pointerOut = (event: PointerEvent) => {
        controlsHovered = isControl(event.relatedTarget);
        if (!controlsHovered) scheduleHide();
    };
    const focusChanged = (event: FocusEvent) => { if (isControl(event.target)) reveal(); };

    doc.addEventListener('fullscreenchange', fullscreenChanged);
    view.addEventListener('resize', updateMediaBounds);
    stage.addEventListener('pointermove', reveal);
    stage.addEventListener('pointerover', pointerOver);
    stage.addEventListener('pointerout', pointerOut);
    stage.addEventListener('pointerdown', reveal);
    stage.addEventListener('pointerleave', scheduleHide);
    stage.addEventListener('focusin', focusChanged);
    stage.addEventListener('focusout', focusChanged);
    stage.addEventListener('keydown', reveal);
    fullscreenChanged();

    return {
        playbackChanged() {
            const previous = previousPlayback;
            const current = playback();
            previousPlayback = { ...current };
            view.clearTimeout(handoffTimer);
            observeMedia();
            if (current.playingIndex !== null) {
                if (!stage.classList.contains(IMMERSIVE)) scheduleHide();
            } else if (isFullscreen() && stage.classList.contains(IMMERSIVE) &&
                (current.entryId !== previous.entryId || current.activeIndex !== previous.activeIndex)) {
                // Preserve the expanded player between autoplay entries, but reveal
                // the controls if the next player is blocked or cannot start.
                clearHide();
                handoffTimer = view.setTimeout(reveal, 5000);
            } else {
                reveal();
            }
        },
        dispose() {
            clearHide();
            view.clearTimeout(handoffTimer);
            view.clearTimeout(settleTimer);
            cancelFrames();
            resized?.disconnect();
            doc.removeEventListener('fullscreenchange', fullscreenChanged);
            view.removeEventListener('resize', updateMediaBounds);
            stage.removeEventListener('pointermove', reveal);
            stage.removeEventListener('pointerover', pointerOver);
            stage.removeEventListener('pointerout', pointerOut);
            stage.removeEventListener('pointerdown', reveal);
            stage.removeEventListener('pointerleave', scheduleHide);
            stage.removeEventListener('focusin', focusChanged);
            stage.removeEventListener('focusout', focusChanged);
            stage.removeEventListener('keydown', reveal);
            stage.classList.remove(IMMERSIVE, SETTLED, READY);
        },
    };
}

import { createContext, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import type { SortChoice } from '../../sorter';

const HIDE_DELAY_MS = 2500;
const CONTROLS = '.media-control-buttons, .music-card > :not([data-slot="media"]), .music-card-wrapper__controls, .progress';

export const SorterFullscreenContext = createContext({
    onPlay: (_side: SortChoice): void => undefined,
    onStop: (_side: SortChoice): void => undefined,
});

export function SorterStage({children, autoPlaySide = null}: {children: ReactNode; autoPlaySide?: SortChoice | null}) {
    const stageRef = useRef<HTMLDivElement>(null);
    const [activeSide, setActiveSide] = useState<SortChoice | null>(null);
    const [focusedSide, setFocusedSide] = useState<SortChoice | null>(null);
    const playbackRef = useRef({activeSide, focusedSide, autoPlaySide});
    const playbackChangedRef = useRef<() => void>(() => undefined);
    const startSide = useCallback((side: SortChoice) => {
        setActiveSide(side);
        setFocusedSide(side);
    }, []);
    const stopSide = useCallback((side: SortChoice) => {
        setActiveSide(current => current === side ? null : current);
    }, []);

    useEffect(() => {
        const stage = stageRef.current;
        if (!stage) {
            return;
        }

        let timer: ReturnType<typeof setTimeout> | undefined;
        let handoffTimer: ReturnType<typeof setTimeout> | undefined;
        let controlsHovered = false;
        const isFullscreen = () => document.fullscreenElement === stage;
        const clearTimer = () => clearTimeout(timer);
        const controlsActive = () => controlsHovered || [...stage.querySelectorAll<HTMLElement>(CONTROLS)].some(
            (element) => element.matches(':focus-visible') || Boolean(element.querySelector(':focus-visible')),
        );
        const scheduleHide = () => {
            clearTimer();
            if (isFullscreen() && playbackRef.current.activeSide !== null) {
                timer = setTimeout(() => {
                    if (isFullscreen() && playbackRef.current.activeSide !== null && !controlsActive()) {
                        stage.classList.add('sorter-stage--immersive');
                    }
                }, HIDE_DELAY_MS);
            }
        };
        const reveal = () => {
            clearTimeout(handoffTimer);
            stage.classList.remove('sorter-stage--immersive');
            scheduleHide();
        };
        const updateMediaBounds = () => {
            if (!isFullscreen()) {
                return;
            }
            for (const media of stage.querySelectorAll<HTMLElement>('[data-slot="media"]')) {
                const bounds = media.getBoundingClientRect();
                media.style.setProperty('--media-left', `${bounds.left}px`);
                media.style.setProperty('--media-top', `${bounds.top}px`);
                media.style.setProperty('--media-width', `${bounds.width}px`);
                media.style.setProperty('--media-height', `${bounds.height}px`);
            }
        };
        const fullscreenChanged = () => {
            controlsHovered = [...stage.querySelectorAll(CONTROLS)].some(element => element.matches(':hover'));
            updateMediaBounds();
            reveal();
        };
        const pointerOver = (event: PointerEvent) => {
            controlsHovered = event.target instanceof Element && Boolean(event.target.closest(CONTROLS));
        };
        const pointerOut = (event: PointerEvent) => {
            controlsHovered = event.relatedTarget instanceof Element && Boolean(event.relatedTarget.closest(CONTROLS));
            if (!controlsHovered) {
                scheduleHide();
            }
        };
        const focusChanged = (event: FocusEvent) => {
            if (event.target instanceof Element && event.target.closest(CONTROLS)) {
                reveal();
            }
        };
        playbackChangedRef.current = () => {
            clearTimeout(handoffTimer);
            updateMediaBounds();
            const {activeSide, focusedSide, autoPlaySide} = playbackRef.current;
            if (activeSide !== null) {
                // A playing-side change preserves immersive mode and crossfades
                // the two existing viewports instead of expanding them again.
                if (!stage.classList.contains('sorter-stage--immersive')) {
                    scheduleHide();
                }
            } else if (isFullscreen() && stage.classList.contains('sorter-stage--immersive') &&
                autoPlaySide !== null && autoPlaySide !== focusedSide) {
                // Keep the outgoing frame while the next autoplay player starts.
                // Restore the comparison if playback is blocked or fails.
                clearTimer();
                handoffTimer = setTimeout(reveal, 5000);
            } else {
                reveal();
            }
        };
        const resized = new ResizeObserver(updateMediaBounds);
        stage.querySelectorAll('[data-slot="media"]').forEach((media) => resized.observe(media));
        document.addEventListener('fullscreenchange', fullscreenChanged);
        stage.addEventListener('pointermove', reveal);
        stage.addEventListener('pointerover', pointerOver);
        stage.addEventListener('pointerout', pointerOut);
        stage.addEventListener('pointerdown', reveal);
        stage.addEventListener('pointerleave', scheduleHide);
        stage.addEventListener('focusin', focusChanged);
        stage.addEventListener('focusout', focusChanged);
        stage.addEventListener('keydown', reveal);
        updateMediaBounds();
        reveal();

        return () => {
            clearTimer();
            clearTimeout(handoffTimer);
            playbackChangedRef.current = () => undefined;
            resized.disconnect();
            document.removeEventListener('fullscreenchange', fullscreenChanged);
            stage.removeEventListener('pointermove', reveal);
            stage.removeEventListener('pointerover', pointerOver);
            stage.removeEventListener('pointerout', pointerOut);
            stage.removeEventListener('pointerdown', reveal);
            stage.removeEventListener('pointerleave', scheduleHide);
            stage.removeEventListener('focusin', focusChanged);
            stage.removeEventListener('focusout', focusChanged);
            stage.removeEventListener('keydown', reveal);
        };
    }, []);

    useEffect(() => {
        playbackRef.current = {activeSide, focusedSide, autoPlaySide};
        playbackChangedRef.current();
    }, [activeSide, focusedSide, autoPlaySide]);

    return (
        <SorterFullscreenContext.Provider value={{
            onPlay: startSide,
            onStop: stopSide,
        }}>
            <div ref={stageRef} className="sorter-stage" data-fullscreen-side={focusedSide ?? undefined} data-playing-side={activeSide ?? undefined}>
                {children}
                {/* Catch movement over cross-origin video players while controls are hidden. */}
                <div className="sorter-stage__wake-area" aria-hidden="true" />
            </div>
        </SorterFullscreenContext.Provider>
    );
}

import { createContext, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import type { SortChoice } from '../../sorter';

const HIDE_DELAY_MS = 2500;
const CONTROLS = '.media-control-buttons, .music-card > :not([data-slot="media"]), .music-card-wrapper__controls, .progress';

export const SorterFullscreenContext = createContext({
    onPlay: (_side: SortChoice): void => undefined,
    onStop: (_side: SortChoice): void => undefined,
});

export function SorterStage({children}: {children: ReactNode}) {
    const stageRef = useRef<HTMLDivElement>(null);
    const [activeSide, setActiveSide] = useState<SortChoice | null>(null);
    const stopSide = useCallback((side: SortChoice) => {
        setActiveSide(current => current === side ? null : current);
    }, []);

    useEffect(() => {
        const stage = stageRef.current;
        if (!stage) {
            return;
        }

        let timer: ReturnType<typeof setTimeout> | undefined;
        let controlsHovered = false;
        const isFullscreen = () => document.fullscreenElement === stage;
        const clearTimer = () => clearTimeout(timer);
        const controlsActive = () => controlsHovered || [...stage.querySelectorAll<HTMLElement>(CONTROLS)].some(
            (element) => element.matches(':focus-visible') || Boolean(element.querySelector(':focus-visible')),
        );
        const scheduleHide = () => {
            clearTimer();
            if (isFullscreen() && activeSide !== null) {
                timer = setTimeout(() => {
                    if (isFullscreen() && activeSide !== null && !controlsActive()) {
                        stage.classList.add('sorter-stage--immersive');
                    }
                }, HIDE_DELAY_MS);
            }
        };
        const reveal = () => {
            stage.classList.remove('sorter-stage--immersive');
            scheduleHide();
        };
        const updateMediaBounds = () => {
            if (!isFullscreen() || activeSide === null) {
                return;
            }
            const media = stage.querySelector<HTMLElement>(`.music-card[data-side="${activeSide}"] [data-slot="media"]`);
            if (!media) {
                return;
            }
            const bounds = media.getBoundingClientRect();
            stage.style.setProperty('--focused-media-left', `${bounds.left}px`);
            stage.style.setProperty('--focused-media-top', `${bounds.top}px`);
            stage.style.setProperty('--focused-media-width', `${bounds.width}px`);
            stage.style.setProperty('--focused-media-height', `${bounds.height}px`);
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
        const resized = new ResizeObserver(updateMediaBounds);
        stage.querySelectorAll('[data-slot="media"]').forEach((media) => resized.observe(media));
        document.addEventListener('fullscreenchange', fullscreenChanged);
        stage.addEventListener('pointermove', reveal);
        stage.addEventListener('pointerover', pointerOver);
        stage.addEventListener('pointerout', pointerOut);
        stage.addEventListener('pointerdown', reveal);
        stage.addEventListener('pointerleave', scheduleHide);
        stage.addEventListener('focusin', reveal);
        stage.addEventListener('focusout', reveal);
        stage.addEventListener('keydown', reveal);
        updateMediaBounds();
        reveal();

        return () => {
            clearTimer();
            resized.disconnect();
            document.removeEventListener('fullscreenchange', fullscreenChanged);
            stage.removeEventListener('pointermove', reveal);
            stage.removeEventListener('pointerover', pointerOver);
            stage.removeEventListener('pointerout', pointerOut);
            stage.removeEventListener('pointerdown', reveal);
            stage.removeEventListener('pointerleave', scheduleHide);
            stage.removeEventListener('focusin', reveal);
            stage.removeEventListener('focusout', reveal);
            stage.removeEventListener('keydown', reveal);
        };
    }, [activeSide]);

    return (
        <SorterFullscreenContext.Provider value={{
            onPlay: setActiveSide,
            onStop: stopSide,
        }}>
            <div ref={stageRef} className="sorter-stage" data-fullscreen-side={activeSide ?? undefined}>
                {children}
                {/* Catch movement over cross-origin video players while controls are hidden. */}
                <div className="sorter-stage__wake-area" aria-hidden="true" />
            </div>
        </SorterFullscreenContext.Provider>
    );
}

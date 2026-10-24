import { useEffect, useRef, useState } from 'react';
import { FullscreenIcon } from './FullscreenIcon';

export function FullscreenButton({ targetSelector, label, className = '' }: { targetSelector: string; label: string; className?: string }) {
    const buttonRef = useRef<HTMLButtonElement>(null);
    const [active, setActive] = useState(false);

    useEffect(() => {
        const update = () => {
            const target = buttonRef.current?.closest(targetSelector);
            setActive(Boolean(target && document.fullscreenElement === target));
        };
        update();
        document.addEventListener('fullscreenchange', update);
        return () => document.removeEventListener('fullscreenchange', update);
    }, [targetSelector]);

    async function toggleFullscreen(): Promise<void> {
        const target = buttonRef.current?.closest(targetSelector);
        if (!target) return;
        try {
            if (document.fullscreenElement === target) await document.exitFullscreen();
            else await target.requestFullscreen();
        } catch {
            // Keep the regular player usable if fullscreen is refused.
        }
    }

    return (
        <button
            ref={buttonRef}
            type="button"
            className={`media-remount-button media-fullscreen-button ${className}`.trim()}
            aria-label={active ? 'Exit fullscreen' : label}
            aria-pressed={active}
            title={active ? 'Exit fullscreen' : 'Fullscreen'}
            onClick={() => void toggleFullscreen()}
        >
            <FullscreenIcon/>
        </button>
    );
}

import { useEffect, useRef, type ReactNode } from 'react';
import { attachPlaylistFullscreen, type PlaylistPlayback } from '../internal/playlistFullscreen';

export function PlaylistStage({ children, className, playingIndex, activeIndex, entryId }: PlaylistPlayback & { children: ReactNode; className: string }) {
    const stageRef = useRef<HTMLDivElement>(null);
    const playbackRef = useRef({ playingIndex, activeIndex, entryId });
    const controllerRef = useRef<ReturnType<typeof attachPlaylistFullscreen> | null>(null);

    useEffect(() => {
        const controller = attachPlaylistFullscreen(stageRef.current!, () => playbackRef.current);
        controllerRef.current = controller;
        return () => {
            controller.dispose();
            controllerRef.current = null;
        };
    }, []);

    useEffect(() => {
        playbackRef.current = { playingIndex, activeIndex, entryId };
        controllerRef.current?.playbackChanged();
    }, [playingIndex, activeIndex, entryId]);

    return (
        <div ref={stageRef} className={`${className} playlist-stage`}>
            {children}
            <div className="playlist-stage__wake-area" aria-hidden="true"/>
        </div>
    );
}

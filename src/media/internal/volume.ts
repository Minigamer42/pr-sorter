export function loadMediaVolume(storageKey: string): number {
    try {
        const saved = localStorage.getItem(storageKey);
        if (saved !== null && saved.trim() !== '') {
            const volume = Number(saved);
            if (Number.isFinite(volume) && volume >= 0 && volume <= 1) {
                return volume;
            }
        }
    } catch {
        // Playback should still work when browser storage is unavailable.
    }

    return 1;
}

export function saveMediaVolume(storageKey: string, volume: number): void {
    if (!Number.isFinite(volume) || volume < 0 || volume > 1) {
        return;
    }

    try {
        localStorage.setItem(storageKey, String(volume));
    } catch {
        // Storage restrictions or a full quota should not interrupt playback.
    }
}

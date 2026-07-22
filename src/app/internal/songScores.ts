import type { AppConfig } from '../types';

export function isScoreEnabled(config: AppConfig): boolean {
    // Scores are a local sorter feature. The optional column header only
    // controls whether scores can be read from or written to Google Sheets.
    void config;
    return true;
}

export function normalizeScore(raw: string): number | null {
    const trimmed = raw.trim();
    if (trimmed === '') return null;

    const value = Number(trimmed);
    if (!Number.isFinite(value) || value < 0 || value > 10) {
        throw new Error('Scores must be numbers from 0 to 10.');
    }

    return value;
}

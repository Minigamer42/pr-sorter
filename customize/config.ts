import type { AppConfig } from '../src/app/types';

export const config = {
    localStoragePrefix: 'japanese-non-anisongs-pr-2',
    title: 'Japanese Non-Anisongs PR #2',
    description: 'Party rank sorter for Japanese Non-Anisongs PR #2.',
    tags: ['Nominations'],
    deadline: new Date('2026-10-19T23:59:00+02:00'),
    googleSheets: {
        clientId: '575550662002-hivobiln683gua375ss3b7k58afnn36t.apps.googleusercontent.com',
        appId: '575550662002',
        rankColumnHeader: 'Rank',
        scoreColumnHeader: 'Score (optional)'
    }
} satisfies AppConfig;

import type { AppConfig } from '../src/app/types';

export const config = {
    localStoragePrefix: 'idol-anisongs-pr-1',
    title: 'Idol Anisongs PR #1',
    description: 'Party rank sorter for Idol Anisongs PR #1',
    tags: ['Nominations'],
    deadline: new Date('2026-07-13T23:59:00+02:00'),
    defaultMediaFormat: 'full',
    googleSheets: {
        clientId: '575550662002-hivobiln683gua375ss3b7k58afnn36t.apps.googleusercontent.com',
        appId: '575550662002',
        rankColumnHeader: 'Rank',
        scoreColumnHeader: 'Score (optional)'
    }
} satisfies AppConfig;

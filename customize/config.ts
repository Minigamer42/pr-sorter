import type { AppConfig } from '../src/app/types';

export const config = {
    localStoragePrefix: 'idol-pr-13',
    title: 'Idol PR #13 Sorter',
    description: 'Party rank sorter for Idol PR #13',
    tags: ['Nominations'],
    deadline: new Date('2026-06-11T23:59:00+02:00'),
    googleSheets: {
        clientId: '575550662002-hivobiln683gua375ss3b7k58afnn36t.apps.googleusercontent.com',
        appId: '575550662002',
        rankColumnHeader: 'Rank',
        scoreColumnHeader: 'Score (optional)'
    }
} satisfies AppConfig;

import type { AppConfig } from '../src/app/types';

export const config = {
    localStoragePrefix: 'healer-girl',
    title: 'Healer Girl',
    description: 'Party rank sorter for Healer Girl.',
    tags: ['Franchise'],
    deadline: new Date('2026-11-30T23:59:00+02:00'),
    googleSheets: {
        clientId: '575550662002-hivobiln683gua375ss3b7k58afnn36t.apps.googleusercontent.com',
        appId: '575550662002',
        rankColumnHeader: 'Rank',
        scoreColumnHeader: 'Score (optional)'
    },
    defaultMediaFormat: 'full',
} satisfies AppConfig;

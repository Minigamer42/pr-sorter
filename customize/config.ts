import type { AppConfig } from '../src/app/types';

export const config = {
    localStoragePrefix: 'co-shu-nie',
    title: 'Cö shu Nie Sorter',
    description: 'Party rank sorter for Cö shu Nie',
    deadline: new Date('2026-06-05T23:59:00+02:00'),
    tags: ['Artist'],
    googleSheets: {
        clientId: '575550662002-hivobiln683gua375ss3b7k58afnn36t.apps.googleusercontent.com',
        appId: '575550662002',
        rankColumnHeader: 'Rank',
        scoreColumnHeader: 'Score'
    }
} satisfies AppConfig;

import type { AppConfig } from '../src/app/types';

export const config = {
    localStoragePrefix: 'suara',
    title: 'Suara Sorter',
    description: 'Party rank sorter for Suara',
    tags: ['Artist'],
    deadline: new Date('2026-07-08T06:00:00+02:00'),
    googleSheets: {
        clientId: '575550662002-hivobiln683gua375ss3b7k58afnn36t.apps.googleusercontent.com',
        appId: '575550662002',
        rankColumnHeader: 'Rank',
        scoreColumnHeader: 'Score'
    }
} satisfies AppConfig;

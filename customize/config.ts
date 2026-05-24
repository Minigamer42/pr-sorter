import type { AppConfig } from '../src/app/types';

export const config = {
    localStoragePrefix: 'mili',
    title: 'Mili Sorter',
    description: 'Party rank sorter for Mili',
    fallbackAnimeName: 'Mili',
    tags: ['Artist'],
    hide: true,
    googleSheets: {
        clientId: '575550662002-hivobiln683gua375ss3b7k58afnn36t.apps.googleusercontent.com',
        appId: '575550662002',
        rankColumnHeader: 'Rank',
        scoreColumnHeader: 'Score (optional)'
    }
} satisfies AppConfig;

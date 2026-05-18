import type { AppConfig } from '../src/app/types';

export const config = {
    localStoragePrefix: 'hasunosora-105th-pr',
    title: 'Hasunosora 105th',
    description: 'Party rank sorter for Hasunosora 105th',
    googleSheets: {
        clientId: '575550662002-hivobiln683gua375ss3b7k58afnn36t.apps.googleusercontent.com',
        appId: '575550662002',
        rankColumnHeader: 'Rank',
        scoreColumnHeader: 'Score (optional)'
    }
} satisfies AppConfig;

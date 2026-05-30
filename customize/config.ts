import type { AppConfig } from '../src/app/types';

export const config = {
    localStoragePrefix: 'co-shu-nie',
    title: 'Cö shu Nie Sorter',
    description: 'Party rank sorter for Cö shu Nie',
    googleSheets: {
        clientId: '575550662002-hivobiln683gua375ss3b7k58afnn36t.apps.googleusercontent.com',
        appId: '575550662002',
        rankColumnHeader: 'Rank',
        scoreColumnHeader: 'Score'
    }
} satisfies AppConfig;

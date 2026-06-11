import type { AppConfig } from '../src/app/types';

export const config = {
    localStoragePrefix: 'zard-anime-songs',
    title: 'ZARD Anime Songs',
    description: 'Party rank sorter for ZARD Anime Songs',
    rankSupported: false,
    deadline: new Date('2026-06-18T03:00:00+02:00'),
    googleSheets: {
        clientId: '575550662002-hivobiln683gua375ss3b7k58afnn36t.apps.googleusercontent.com',
        appId: '575550662002',
        idColumnHeader: '#',
        scoreColumnHeader: 'Score'
    }
} satisfies AppConfig;

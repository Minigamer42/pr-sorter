import type { AppConfig } from '../src/app/types';

export const config = {
    localStoragePrefix: 'yuu-serizawa',
    title: 'Yuu Serizawa Solo/Duo/Trio',
    description: 'Party rank sorter for Yuu Serizawa Solo/Duo/Trio.',
    tags: ['Artist'],
    deadline: new Date('2026-08-17T23:59:00+02:00'),
    googleSheets: {
        clientId: '575550662002-hivobiln683gua375ss3b7k58afnn36t.apps.googleusercontent.com',
        appId: '575550662002',
        rankColumnHeader: 'Rank',
        scoreColumnHeader: 'Score (optional)'
    }
} satisfies AppConfig;

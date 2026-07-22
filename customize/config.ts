import type { AppConfig } from '../src/app/types';

export const config = {
    localStoragePrefix: 'yuuko-natsuyoshi',
    title: 'Yuuko Natsuyoshi',
    description: 'Party rank sorter for Yuuko Natsuyoshi.',
    tags: ['Artist'],
    deadline: new Date('2026-08-17T23:59:00+02:00'),
    googleSheets: {
        clientId: '575550662002-hivobiln683gua375ss3b7k58afnn36t.apps.googleusercontent.com',
        appId: '575550662002',
        rankColumnHeader: 'Rank',
        scoreColumnHeader: 'Score (optional)'
    }
} satisfies AppConfig;

import type { AppConfig } from '../src/app/types';

export const config = {
    localStoragePrefix: 'vtuber-vsinger-originals',
    title: 'Vtuber/VSinger Originals',
    description: 'Party rank sorter for Vtuber/VSinger Originals',
    tags: ['Nominations'],
    deadline: new Date('2026-07-22T18:00:00+02:00'),
    googleSheets: {
        clientId: '575550662002-hivobiln683gua375ss3b7k58afnn36t.apps.googleusercontent.com',
        appId: '575550662002',
        rankColumnHeader: 'Rank',
        scoreColumnHeader: 'Score (Optional)'
    }
} satisfies AppConfig;

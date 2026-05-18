import type { AppConfig } from '../src/app/types';

export const config = {
    localStoragePrefix: 'wuwa-ost',
    title: 'WuWa OST',
    description: 'Party rank sorter for WuWa OST',
    fallbackAnimeName: 'WuWa',
    deadline: new Date('2026-05-31T12:00:00+02:00'),
    tags: ['Franchise'],
    googleSheets: {
        clientId: '575550662002-hivobiln683gua375ss3b7k58afnn36t.apps.googleusercontent.com',
        appId: '575550662002',
        rankColumnHeader: 'Rank',
        scoreColumnHeader: 'Score'
    }
} satisfies AppConfig;

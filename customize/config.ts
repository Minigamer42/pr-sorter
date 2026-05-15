import type { AppConfig } from '../src/app/types';

export const config = {
    localStoragePrefix: 'symphogear-anisong',
    title: 'Symphogear Sorter',
    description: 'Party rank sorter for your custom list of songs.',
    deadline: new Date('2026-06-14T12:00:00+02:00'),
    tags: ['Franchise'],
    googleSheets: {
        clientId: '575550662002-hivobiln683gua375ss3b7k58afnn36t.apps.googleusercontent.com',
        appId: '575550662002',
        rankColumnHeader: 'Rank',
        scoreColumnHeader: 'Total rank must be egal to'
    }
} satisfies AppConfig;

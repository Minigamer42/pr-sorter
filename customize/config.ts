import type { AppConfig } from '../src/app/types';

export const config = {
    localStoragePrefix: 'prima-doll',
    title: 'Prima Doll',
    description: 'Party rank sorter for Prima Doll.',
    tags: ['Franchise'],
    deadline: new Date('2026-10-31T23:59:00+02:00'),
    googleSheets: {
        clientId: '575550662002-hivobiln683gua375ss3b7k58afnn36t.apps.googleusercontent.com',
        appId: '575550662002',
        rankColumnHeader: 'Rank',
        scoreColumnHeader: 'Score (optional)'
    },
    defaultMediaFormat: 'full'
} satisfies AppConfig;

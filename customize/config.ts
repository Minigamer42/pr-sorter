import type { AppConfig } from '../src/app/types';

export const config = {
    localStoragePrefix: 'princession-orchestra-pr',
    title: 'Princession Orchestra',
    description: 'Party rank sorter for Princession Orchestra songs.',
    deadline: new Date('2026-06-11T23:59:00+02:00'),
    tags: ['Franchise'],
    googleSheets: {
        clientId: '575550662002-hivobiln683gua375ss3b7k58afnn36t.apps.googleusercontent.com',
        appId: '575550662002',
        rankColumnHeader: 'Rank',
        scoreColumnHeader: 'Score (optional)'
    }
} satisfies AppConfig;

import type { AppConfig } from '../src/app/types';

export const config = {
    localStoragePrefix: 'trios-2',
    title: 'Anime Songs Trios Sorter',
    description: 'Party rank sorter for your custom list of songs.',
    tags: ['Nominations'],
    deadline: new Date('2026-06-21T05:00:00+02:00'),
    songTypes: ['Opening', 'Ending', 'Insert'],
    googleSheets: {
        clientId: '575550662002-hivobiln683gua375ss3b7k58afnn36t.apps.googleusercontent.com',
        appId: '575550662002',
        rankColumnHeader: 'Rank',
        scoreColumnHeader: 'Score'
    }
} satisfies AppConfig;

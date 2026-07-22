import type { AppConfig } from '../src/app/types';

export const config = {
    localStoragePrefix: 'utawarerumono',
    title: 'Utawarerumono',
    description: 'Party rank sorter for Utawarerumono',
    tags: ['Franchise'],
    deadline: new Date('2026-08-09T23:59:00.000Z'),
    googleSheets: {
        clientId: '575550662002-hivobiln683gua375ss3b7k58afnn36t.apps.googleusercontent.com',
        appId: '575550662002',
        rankColumnHeader: 'Rank'
    }
} satisfies AppConfig;

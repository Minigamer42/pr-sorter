import type { ExternalSorterSource } from './types';

export const externalSorterSources = [
    {
        title: 'Minigamer42',
        indexUrl: 'https://minigamer42.github.io/pr-sorter/',
        routeSlug: 'minigamer42',
    },
    {
        title: 'Tutti',
        indexUrl: 'https://amq-tutti.github.io/pr-sorter/',
        routeSlug: 'tutti',
        excludedSorterSlugs: ['yorushika', 'princession-orchestra'],
    },
] satisfies ExternalSorterSource[];

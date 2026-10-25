import { externalSorterHref, normalizedRouteSlug, normalizedSorterSlug } from '../externalSorter/routing';
import { externalSorterSources } from '../sorterIndex/externalSorterSources';
import { sorters } from '../sorterIndex/sorters.generated';
import type { SongLibrary } from './songLibrary';

export type OriginalPrLink = { title: string; href: string };

// A recording can appear in several PRs, each with its own local song ID.
export function librarySongSources(library: SongLibrary, overviewUrl: string): Record<string, OriginalPrLink[]> {
    const links: Record<string, OriginalPrLink[]> = {};
    for (const [prefix, entries] of Object.entries(library.sources)) {
        const source = sourceLink(prefix, overviewUrl);
        if (!source) continue;
        for (const key of new Set(Object.values(entries).flat())) {
            if (!library.songs[key]) continue;
            const sources = links[key] ??= [];
            if (!sources.some((link) => link.href === source.href)) sources.push(source);
        }
    }
    for (const sources of Object.values(links)) {
        sources.sort((left, right) => left.title.localeCompare(right.title, undefined, { numeric: true, sensitivity: 'base' }));
    }
    return links;
}

function sourceLink(prefix: string, overviewUrl: string): OriginalPrLink | null {
    const external = /^external:([^:]+):(.+)$/.exec(prefix);
    if (external) {
        try {
            const route = normalizedRouteSlug(external[1]);
            const slug = normalizedSorterSlug(external[2]);
            const collection = externalSorterSources.find((source) => source.routeSlug === route);
            return {
                title: `${collection?.title ?? route} / ${slug}`,
                href: externalSorterHref(overviewUrl, route, slug),
            };
        } catch {
            return null;
        }
    }
    const sorter = sorters.find((entry) => (entry.localStoragePrefix ?? entry.slug) === prefix);
    if (!sorter) return null;
    return { title: sorter.title, href: new URL(sorter.url ?? `${sorter.slug}/`, overviewUrl).toString() };
}

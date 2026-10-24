export type LibraryFilter = 'liked' | 'above-threshold';

export function libraryFilterFromUrl(url: string | URL): LibraryFilter | null {
    const parsed = new URL(url);
    const match = /\/library(?:\/(liked|rated))?\/?$/.exec(parsed.pathname);
    if (!match) return null;
    return match[1] === 'rated' ? 'above-threshold' : 'liked';
}

export function libraryHref(overviewHref: string, currentUrl: string | URL, filter: LibraryFilter = 'liked'): string {
    const url = new URL(`library/${filter === 'above-threshold' ? 'rated' : 'liked'}/`, new URL(overviewHref, currentUrl));
    return url.toString();
}

export function libraryOverviewHref(currentUrl: string | URL): string {
    const url = new URL(currentUrl);
    url.pathname = url.pathname.replace(/\/library(?:\/(?:liked|rated))?\/?$/, '/');
    url.search = '';
    url.hash = '';
    return url.toString();
}

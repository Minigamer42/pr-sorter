export type ExternalSorterRequest = {
    sourceRouteSlug: string;
    sorterSlug: string;
};

const externalRouteSegment = 'external';
const redirectedRouteParam = 'externalRoute';

export function externalSorterRequestFromUrl(url: string | URL): ExternalSorterRequest | null {
    const parsedUrl = typeof url === 'string' ? new URL(url) : url;
    const routeMatch = new RegExp(`/${externalRouteSegment}/([^/]+)/([^/]+)/?$`).exec(parsedUrl.pathname);
    if (!routeMatch) {
        return null;
    }

    return {
        sourceRouteSlug: decodeURIComponent(routeMatch[1]),
        sorterSlug: decodeURIComponent(routeMatch[2]),
    };
}

export function externalSorterHref(
    currentUrl: string | URL,
    sourceRouteSlug: string,
    sorterSlug: string,
): string {
    const collectionUrl = new URL('.', currentUrl);
    return new URL(
        `${externalRouteSegment}/${encodeURIComponent(sourceRouteSlug)}/${encodeURIComponent(sorterSlug)}/`,
        collectionUrl,
    ).toString();
}

export function externalSorterStoragePrefix(sourceRouteSlug: string, sorterSlug: string): string {
    return `external:${normalizedRouteSlug(sourceRouteSlug)}:${normalizedSorterSlug(sorterSlug)}`;
}

export function restoreRedirectedExternalSorterRoute(): void {
    const currentUrl = new URL(window.location.href);
    const redirectedRoute = currentUrl.searchParams.get(redirectedRouteParam);
    if (!redirectedRoute) {
        return;
    }

    const restoredUrl = new URL(redirectedRoute, currentUrl.origin);
    if (restoredUrl.origin !== currentUrl.origin || !restoredUrl.pathname.includes(`/${externalRouteSegment}/`)) {
        return;
    }

    window.history.replaceState(null, '', `${restoredUrl.pathname}${restoredUrl.search}${restoredUrl.hash}`);
}

export function normalizedSorterSlug(rawSlug: string): string {
    const slug = rawSlug.trim();
    if (!/^[a-z0-9._-]+$/i.test(slug)) {
        throw new Error('The external sorter slug is invalid.');
    }

    return slug;
}

export function normalizedRouteSlug(rawSlug: string): string {
    const slug = rawSlug.trim().toLowerCase();
    if (!/^[a-z0-9._-]+$/.test(slug)) {
        throw new Error('The external collection route is invalid.');
    }
    return slug;
}

import {parse, parseExpressionAt} from 'acorn';
import {config as collectionConfig} from '../../customize/config';
import type {AppConfig} from '../app/types';
import {songEntryId, type SongData, type SongEntry} from '../songs';
import {externalSorterSources} from '../sorterIndex/externalSorterSources';
import type {ExternalSorterSource} from '../sorterIndex/types';
import {
    externalSorterStoragePrefix,
    normalizedRouteSlug,
    normalizedSorterSlug,
    type ExternalSorterRequest,
} from './routing';

export type LoadedExternalSorter = {
    config: AppConfig;
    songs: SongEntry[];
    originalUrl: string;
};

type ExternalCatalogEntry = {
    slug: string;
    title: string;
    description: string;
    tags?: string[];
    rankSupported?: boolean;
    songCount?: number;
    deadline?: string;
    url?: string;
};

type ExternalCatalog = {
    sorters: ExternalCatalogEntry[];
    externalSources: ExternalSorterSource[];
};

type SyntaxNode = {
    type: string;
    [key: string]: unknown;
};

const invalidSyntaxValue = Symbol('invalid-syntax-value');

export async function loadExternalSorter(request: ExternalSorterRequest): Promise<LoadedExternalSorter> {
    const sourceRouteSlug = normalizedRouteSlug(request.sourceRouteSlug);
    const sorterSlug = normalizedSorterSlug(request.sorterSlug);
    const sourceUrl = await resolveExternalSourceUrl(sourceRouteSlug);
    const catalogUrl = new URL('sorter-index.json', sourceUrl);
    const catalogResponse = await fetch(catalogUrl);

    if (!catalogResponse.ok) {
        throw new Error(`The external sorter catalog returned ${catalogResponse.status}.`);
    }

    const catalog = parseCatalog(await catalogResponse.json());
    const entry = catalog.sorters.find((candidate) => candidate.slug === sorterSlug);
    if (!entry) {
        throw new Error(`Sorter "${sorterSlug}" is not listed by that collection.`);
    }

    const sorterUrl = new URL(entry.url ?? `${entry.slug}/`, sourceUrl);
    const songs = await fetchExternalSongs(sourceUrl, sorterUrl, sorterSlug, entry.songCount);
    const deadline = parsedDeadline(entry.deadline);

    return {
        config: {
            localStoragePrefix: externalSorterStoragePrefix(sourceRouteSlug, sorterSlug),
            title: entry.title,
            description: entry.description,
            ...(entry.tags ? {tags: entry.tags} : {}),
            ...(entry.rankSupported === false ? {rankSupported: false} : {}),
            ...(deadline ? {deadline} : {}),
            ...(collectionConfig.googleSheets ? {googleSheets: {...collectionConfig.googleSheets}} : {}),
        },
        songs,
        originalUrl: sorterUrl.toString(),
    };
}

async function resolveExternalSourceUrl(requestedRouteSlug: string): Promise<URL> {
    const pendingSources = [...externalSorterSources] as ExternalSorterSource[];
    const visitedUrls = new Set<string>();

    for (let index = 0; index < pendingSources.length; index += 1) {
        const source = pendingSources[index];
        const sourceUrl = normalizedSourceUrl(source.indexUrl);
        const sourceKey = sourceUrl.toString();
        if (visitedUrls.has(sourceKey)) {
            continue;
        }

        visitedUrls.add(sourceKey);
        if (externalSourceRouteSlug(source) === requestedRouteSlug) {
            return sourceUrl;
        }

        try {
            const response = await fetch(new URL('sorter-index.json', sourceUrl));
            if (response.ok) {
                pendingSources.push(...parseCatalog(await response.json()).externalSources);
            }
        } catch {
            // Other configured sources can still resolve the requested route.
        }
    }

    throw new Error(`External collection "${requestedRouteSlug}" is not configured.`);
}

function normalizedSourceUrl(rawUrl: string): URL {
    if (!rawUrl) {
        throw new Error('The external collection URL is missing.');
    }

    const sourceUrl = new URL(rawUrl);
    if (sourceUrl.protocol !== 'https:' && !(import.meta.env.DEV && sourceUrl.protocol === 'http:')) {
        throw new Error('External collection URLs must use HTTPS.');
    }

    sourceUrl.hash = '';
    sourceUrl.search = '';
    if (!sourceUrl.pathname.endsWith('/')) {
        sourceUrl.pathname += '/';
    }

    return sourceUrl;
}

function externalSourceRouteSlug(source: ExternalSorterSource): string {
    return normalizedRouteSlug(
        source.routeSlug ?? source.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    );
}

function parseCatalog(value: unknown): ExternalCatalog {
    if (typeof value !== 'object' || value === null) {
        throw new Error('The external sorter catalog is invalid.');
    }

    const entries = (value as {sorters?: unknown}).sorters;
    if (!Array.isArray(entries)) {
        throw new Error('The external sorter catalog has no sorter list.');
    }

    const sources = (value as {externalSources?: unknown}).externalSources;
    return {
        sorters: entries.filter(isExternalCatalogEntry),
        externalSources: Array.isArray(sources) ? sources.filter(isExternalSorterSource) : [],
    };
}

function isExternalSorterSource(value: unknown): value is ExternalSorterSource {
    if (typeof value !== 'object' || value === null) {
        return false;
    }

    const candidate = value as Partial<ExternalSorterSource>;
    return (
        typeof candidate.title === 'string' &&
        typeof candidate.indexUrl === 'string' &&
        (candidate.routeSlug === undefined || typeof candidate.routeSlug === 'string') &&
        (candidate.excludedSorterSlugs === undefined ||
            (Array.isArray(candidate.excludedSorterSlugs) && candidate.excludedSorterSlugs.every((slug) => typeof slug === 'string')))
    );
}

function isExternalCatalogEntry(value: unknown): value is ExternalCatalogEntry {
    if (typeof value !== 'object' || value === null) {
        return false;
    }

    const candidate = value as Partial<ExternalCatalogEntry>;
    return (
        typeof candidate.slug === 'string' &&
        typeof candidate.title === 'string' &&
        typeof candidate.description === 'string' &&
        (candidate.tags === undefined || (Array.isArray(candidate.tags) && candidate.tags.every((tag) => typeof tag === 'string'))) &&
        (candidate.rankSupported === undefined || typeof candidate.rankSupported === 'boolean') &&
        (candidate.songCount === undefined || typeof candidate.songCount === 'number') &&
        (candidate.deadline === undefined || typeof candidate.deadline === 'string') &&
        (candidate.url === undefined || typeof candidate.url === 'string')
    );
}

function parsedDeadline(rawDeadline: string | undefined): Date | null {
    if (!rawDeadline) {
        return null;
    }

    const deadline = new Date(rawDeadline);
    return Number.isNaN(deadline.getTime()) ? null : deadline;
}

async function fetchExternalSongs(
    sourceUrl: URL,
    sorterUrl: URL,
    sorterSlug: string,
    expectedSongCount: number | undefined,
): Promise<SongEntry[]> {
    const sourceError: unknown[] = [];
    const sourceFileUrl = githubSongListUrl(sourceUrl, sorterSlug);

    if (sourceFileUrl) {
        try {
            const response = await fetch(sourceFileUrl);
            if (!response.ok) {
                throw new Error(`source returned ${response.status}`);
            }

            return parseSongListSource(await response.text());
        } catch (error) {
            sourceError.push(error);
        }
    }

    try {
        return await fetchSongListFromBundle(sorterUrl, expectedSongCount);
    } catch (bundleError) {
        const sourceDetail = sourceError.length
            ? ` Source lookup failed: ${errorMessage(sourceError[0])}.`
            : '';
        throw new Error(`Could not read the external song list.${sourceDetail} Bundle lookup failed: ${errorMessage(bundleError)}.`);
    }
}

function githubSongListUrl(sourceUrl: URL, sorterSlug: string): URL | null {
    const githubPagesSuffix = '.github.io';
    if (!sourceUrl.hostname.endsWith(githubPagesSuffix)) {
        return null;
    }

    const owner = sourceUrl.hostname.slice(0, -githubPagesSuffix.length);
    const repository = sourceUrl.pathname.split('/').filter(Boolean)[0];
    if (!owner || !repository || !/^[a-z0-9._-]+$/i.test(owner) || !/^[a-z0-9._-]+$/i.test(repository)) {
        return null;
    }

    return new URL(
        `https://raw.githubusercontent.com/${owner}/${repository}/refs/heads/pr-sorter/${sorterSlug}/customize/songList.ts`,
    );
}

function parseSongListSource(source: string): SongEntry[] {
    const assignment = /\b(?:export\s+)?const\s+songList(?:\s*:[^=]+)?\s*=/.exec(source);
    if (!assignment) {
        throw new Error('songList export was not found');
    }

    const arrayStart = source.indexOf('[', assignment.index + assignment[0].length);
    if (arrayStart < 0) {
        throw new Error('songList array was not found');
    }

    const expression = parseExpressionAt(source, arrayStart, {ecmaVersion: 'latest'});
    const songs = songListFromSyntaxNode(expression as unknown);
    if (!songs) {
        throw new Error('songList is not a supported literal song array');
    }

    return songs;
}

async function fetchSongListFromBundle(sorterUrl: URL, expectedSongCount: number | undefined): Promise<SongEntry[]> {
    const pageResponse = await fetch(sorterUrl);
    if (!pageResponse.ok) {
        throw new Error(`sorter page returned ${pageResponse.status}`);
    }

    const document = new DOMParser().parseFromString(await pageResponse.text(), 'text/html');
    const moduleScript = [...document.querySelectorAll<HTMLScriptElement>('script[src]')]
        .find((script) => script.type === 'module') ?? document.querySelector<HTMLScriptElement>('script[src]');
    const scriptSource = moduleScript?.getAttribute('src');
    if (!scriptSource) {
        throw new Error('sorter JavaScript asset was not found');
    }

    const bundleUrl = new URL(scriptSource, sorterUrl);
    const bundleResponse = await fetch(bundleUrl);
    if (!bundleResponse.ok) {
        throw new Error(`sorter JavaScript returned ${bundleResponse.status}`);
    }

    const program = parse(await bundleResponse.text(), {ecmaVersion: 'latest', sourceType: 'module'});
    const candidates = findSongListCandidates(program as unknown);
    const expectedCandidate = expectedSongCount === undefined
        ? null
        : candidates.find((candidate) => candidate.length === expectedSongCount) ?? null;
    const songs = expectedCandidate ?? candidates.sort((left, right) => right.length - left.length)[0];
    if (!songs) {
        throw new Error('no literal song array was found in the sorter JavaScript');
    }

    return songs;
}

function findSongListCandidates(root: unknown): SongEntry[][] {
    const candidates: SongEntry[][] = [];
    const pending: unknown[] = [root];
    const visited = new Set<object>();

    while (pending.length > 0) {
        const value = pending.pop();
        if (typeof value !== 'object' || value === null || visited.has(value)) {
            continue;
        }

        visited.add(value);
        const songs = songListFromSyntaxNode(value);
        if (songs) {
            candidates.push(songs);
        }

        for (const child of Object.values(value)) {
            if (Array.isArray(child)) {
                pending.push(...child);
            } else if (typeof child === 'object' && child !== null) {
                pending.push(child);
            }
        }
    }

    return candidates;
}

function songListFromSyntaxNode(value: unknown): SongEntry[] | null {
    if (!isSyntaxNode(value) || value.type !== 'ArrayExpression' || !Array.isArray(value.elements) || value.elements.length === 0) {
        return null;
    }

    const songs: SongEntry[] = [];
    for (const element of value.elements) {
        const songEntry = songEntryFromSyntaxNode(element);
        if (!songEntry) {
            return null;
        }
        songs.push(songEntry);
    }

    const ids = new Set(songs.map(songEntryId));
    return ids.size === songs.length ? songs : null;
}

function songEntryFromSyntaxNode(value: unknown): SongEntry | null {
    const singleSong = songFromSyntaxNode(value);
    if (singleSong) {
        return singleSong;
    }
    if (!isSyntaxNode(value) || value.type !== 'ArrayExpression' || !Array.isArray(value.elements) || value.elements.length === 0) {
        return null;
    }

    const songGroup = value.elements.map(songFromSyntaxNode);
    return songGroup.every((song): song is SongData => song !== null) ? songGroup : null;
}

function songFromSyntaxNode(value: unknown): SongData | null {
    if (!isSyntaxNode(value) || value.type !== 'ObjectExpression' || !Array.isArray(value.properties)) {
        return null;
    }

    const record: Record<string, unknown> = {};
    for (const propertyValue of value.properties) {
        if (!isSyntaxNode(propertyValue) || propertyValue.type !== 'Property' || propertyValue.kind !== 'init' || propertyValue.computed === true) {
            return null;
        }

        const key = propertyKey(propertyValue.key);
        const property = syntaxValue(propertyValue.value);
        if (key === null || property === invalidSyntaxValue) {
            return null;
        }
        record[key] = property;
    }

    if (!Number.isInteger(record.id) || (record.id as number) <= 0 || typeof record.name !== 'string' || !record.name.trim()) {
        return null;
    }
    if (!isOptionalNullableString(record.anime) || !isOptionalNullableString(record.video) ||
        !isOptionalNullableString(record.mp3) || !isOptionalNullableString(record.full)) {
        return null;
    }
    if (![record.video, record.mp3, record.full].some((media) => typeof media === 'string' && media.trim())) {
        return null;
    }

    return {
        id: record.id as number,
        ...(record.anime !== undefined ? {anime: record.anime as string | null} : {}),
        name: record.name,
        ...(record.video !== undefined ? {video: record.video as string | null} : {}),
        ...(record.mp3 !== undefined ? {mp3: record.mp3 as string | null} : {}),
        ...(record.full !== undefined ? {full: record.full as string | null} : {}),
    };
}

function propertyKey(value: unknown): string | null {
    if (!isSyntaxNode(value)) {
        return null;
    }
    if (value.type === 'Identifier' && typeof value.name === 'string') {
        return value.name;
    }
    if (value.type === 'Literal' && typeof value.value === 'string') {
        return value.value;
    }
    return null;
}

function syntaxValue(value: unknown): unknown | typeof invalidSyntaxValue {
    if (!isSyntaxNode(value)) {
        return invalidSyntaxValue;
    }
    if (value.type === 'Literal' && (value.value === null || ['string', 'number', 'boolean'].includes(typeof value.value))) {
        return value.value;
    }
    if (value.type === 'TemplateLiteral' && Array.isArray(value.expressions) && value.expressions.length === 0 && Array.isArray(value.quasis)) {
        return value.quasis.map((quasi) => {
            if (!isSyntaxNode(quasi) || typeof quasi.value !== 'object' || quasi.value === null ||
                typeof (quasi.value as {cooked?: unknown}).cooked !== 'string') {
                return invalidSyntaxValue;
            }
            return (quasi.value as {cooked: string}).cooked;
        }).reduce<unknown | typeof invalidSyntaxValue>((result, part) => {
            return result === invalidSyntaxValue || part === invalidSyntaxValue ? invalidSyntaxValue : `${result}${part}`;
        }, '');
    }
    if (value.type === 'UnaryExpression' && (value.operator === '-' || value.operator === '+')) {
        const argument = syntaxValue(value.argument);
        if (typeof argument === 'number') {
            return value.operator === '-' ? -argument : argument;
        }
    }
    return invalidSyntaxValue;
}

function isOptionalNullableString(value: unknown): value is string | null | undefined {
    return value === undefined || value === null || typeof value === 'string';
}

function isSyntaxNode(value: unknown): value is SyntaxNode {
    return typeof value === 'object' && value !== null && typeof (value as {type?: unknown}).type === 'string';
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

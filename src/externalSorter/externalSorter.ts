import {parse, parseExpressionAt} from 'acorn';
import {config as collectionConfig} from '../../customize/config';
import type {AppConfig, GoogleSheetsConfig} from '../app/types';
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

type ExternalSheetSettings = {
    localStoragePrefix: string;
    rankSupported?: boolean;
    googleSheets?: Pick<GoogleSheetsConfig, 'idColumnHeader' | 'rankColumnHeader' | 'scoreColumnHeader'>;
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
    const { sourceRouteSlug, sorterSlug, sourceUrl, entry, sorterUrl } = await resolveExternalSorterEntry(request);
    let bundleSource: Promise<string> | undefined;
    const loadBundle = () => bundleSource ??= fetchSorterBundle(sorterUrl);
    const [songs, sheetSettings] = await Promise.all([
        fetchExternalSongs(sourceUrl, loadBundle, sorterSlug, entry.songCount),
        fetchExternalSheetSettings(sourceUrl, loadBundle, sorterSlug),
    ]);
    const deadline = parsedDeadline(entry.deadline);
    const rankSupported = sheetSettings.rankSupported ?? entry.rankSupported;
    const hostGoogleSheets = collectionConfig.googleSheets;

    return {
        config: {
            localStoragePrefix: externalSorterStoragePrefix(sourceRouteSlug, sorterSlug),
            title: entry.title,
            description: entry.description,
            ...(entry.tags ? {tags: entry.tags} : {}),
            ...(rankSupported === false ? {rankSupported: false} : {}),
            ...(deadline ? {deadline} : {}),
            ...(hostGoogleSheets && sheetSettings.googleSheets ? {
                googleSheets: {
                    clientId: hostGoogleSheets.clientId,
                    appId: hostGoogleSheets.appId,
                    ...sheetSettings.googleSheets,
                },
            } : {}),
        },
        songs,
        originalUrl: sorterUrl.toString(),
    };
}

export async function loadExternalSorterSongs(request: ExternalSorterRequest): Promise<{ title: string; songs: SongEntry[] }> {
    const { sorterSlug, sourceUrl, entry, sorterUrl } = await resolveExternalSorterEntry(request);
    const songs = await fetchExternalSongs(sourceUrl, () => fetchSorterBundle(sorterUrl), sorterSlug, entry.songCount);
    return { title: entry.title, songs };
}

async function resolveExternalSorterEntry(request: ExternalSorterRequest) {
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
    return { sourceRouteSlug, sorterSlug, sourceUrl, entry, sorterUrl };
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
    loadBundle: () => Promise<string>,
    sorterSlug: string,
    expectedSongCount: number | undefined,
): Promise<SongEntry[]> {
    const sourceError: unknown[] = [];
    const sourceFileUrl = githubCustomizeFileUrl(sourceUrl, sorterSlug, 'songList.ts');

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
        return songListFromBundle(await loadBundle(), expectedSongCount);
    } catch (bundleError) {
        const sourceDetail = sourceError.length
            ? ` Source lookup failed: ${errorMessage(sourceError[0])}.`
            : '';
        throw new Error(`Could not read the external song list.${sourceDetail} Bundle lookup failed: ${errorMessage(bundleError)}.`);
    }
}

export async function loadSorterSongs(collectionUrl: URL, sorterUrl: URL, sorterSlug: string, expectedSongCount?: number): Promise<SongEntry[]> {
    return fetchExternalSongs(collectionUrl, () => fetchSorterBundle(sorterUrl), sorterSlug, expectedSongCount);
}

function githubCustomizeFileUrl(sourceUrl: URL, sorterSlug: string, fileName: 'songList.ts' | 'config.ts'): URL | null {
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
        `https://raw.githubusercontent.com/${owner}/${repository}/refs/heads/pr-sorter/${sorterSlug}/customize/${fileName}`,
    );
}

async function fetchExternalSheetSettings(
    sourceUrl: URL,
    loadBundle: () => Promise<string>,
    sorterSlug: string,
): Promise<ExternalSheetSettings> {
    let sourceError: unknown;
    const sourceFileUrl = githubCustomizeFileUrl(sourceUrl, sorterSlug, 'config.ts');
    if (sourceFileUrl) {
        try {
            const response = await fetch(sourceFileUrl);
            if (!response.ok) {
                throw new Error(`source returned ${response.status}`);
            }
            return parseSheetSettingsSource(await response.text());
        } catch (error) {
            sourceError = error;
        }
    }

    try {
        const program = parse(await loadBundle(), {ecmaVersion: 'latest', sourceType: 'module'});
        const candidates = findSyntaxCandidates(program, sheetSettingsFromSyntaxNode);
        const settings = candidates.find((candidate) => candidate.localStoragePrefix === sorterSlug)
            ?? (candidates.length === 1 ? candidates[0] : null);
        if (!settings) {
            throw new Error('no unambiguous literal sorter config was found in the JavaScript');
        }
        return settings;
    } catch (bundleError) {
        const sourceDetail = sourceError ? ` Source lookup failed: ${errorMessage(sourceError)}.` : '';
        throw new Error(`Could not read the external spreadsheet configuration.${sourceDetail} Bundle lookup failed: ${errorMessage(bundleError)}.`);
    }
}

function parseSheetSettingsSource(source: string): ExternalSheetSettings {
    const assignment = /\b(?:export\s+)?const\s+config(?:\s*:[^=]+)?\s*=/.exec(source);
    if (!assignment) {
        throw new Error('config export was not found');
    }
    const expression = parseExpressionAt(source, assignment.index + assignment[0].length, {ecmaVersion: 'latest'});
    const settings = sheetSettingsFromSyntaxNode(expression);
    if (!settings) {
        throw new Error('config is not a supported literal sorter configuration');
    }
    return settings;
}

function sheetSettingsFromSyntaxNode(value: unknown): ExternalSheetSettings | null {
    const properties = literalObjectProperties(value);
    if (!properties) {
        return null;
    }
    const localStoragePrefix = syntaxValue(properties.get('localStoragePrefix'));
    if (typeof localStoragePrefix !== 'string' || typeof syntaxValue(properties.get('title')) !== 'string') {
        return null;
    }
    const settings: ExternalSheetSettings = {localStoragePrefix};
    if (properties.has('rankSupported')) {
        const rankSupported = syntaxValue(properties.get('rankSupported'));
        if (typeof rankSupported !== 'boolean') {
            return null;
        }
        settings.rankSupported = rankSupported;
    }
    if (properties.has('googleSheets')) {
        const sheetProperties = literalObjectProperties(properties.get('googleSheets'));
        if (!sheetProperties) {
            return null;
        }
        settings.googleSheets = {};
        for (const key of ['idColumnHeader', 'rankColumnHeader', 'scoreColumnHeader'] as const) {
            if (sheetProperties.has(key)) {
                const header = syntaxValue(sheetProperties.get(key));
                if (typeof header !== 'string') {
                    return null;
                }
                settings.googleSheets[key] = header;
            }
        }
    }
    return settings;
}

function literalObjectProperties(value: unknown): Map<string, unknown> | null {
    if (!isSyntaxNode(value) || value.type !== 'ObjectExpression' || !Array.isArray(value.properties)) {
        return null;
    }
    const properties = new Map<string, unknown>();
    for (const property of value.properties) {
        if (!isSyntaxNode(property) || property.type !== 'Property' || property.kind !== 'init' || property.computed === true) {
            return null;
        }
        const key = propertyKey(property.key);
        if (key === null) {
            return null;
        }
        properties.set(key, property.value);
    }
    return properties;
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

async function fetchSorterBundle(sorterUrl: URL): Promise<string> {
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

    return bundleResponse.text();
}

function songListFromBundle(source: string, expectedSongCount: number | undefined): SongEntry[] {
    const program = parse(source, {ecmaVersion: 'latest', sourceType: 'module'});
    const candidates = findSyntaxCandidates(program, songListFromSyntaxNode);
    const expectedCandidate = expectedSongCount === undefined
        ? null
        : candidates.find((candidate) => candidate.length === expectedSongCount) ?? null;
    const songs = expectedCandidate ?? candidates.sort((left, right) => right.length - left.length)[0];
    if (!songs) {
        throw new Error('no literal song array was found in the sorter JavaScript');
    }

    return songs;
}

function findSyntaxCandidates<T>(root: unknown, parseCandidate: (value: unknown) => T | null): T[] {
    const candidates: T[] = [];
    const pending: unknown[] = [root];
    const visited = new Set<object>();

    while (pending.length > 0) {
        const value = pending.pop();
        if (typeof value !== 'object' || value === null || visited.has(value)) {
            continue;
        }

        visited.add(value);
        const candidate = parseCandidate(value);
        if (candidate) {
            candidates.push(candidate);
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
    if (value.type === 'UnaryExpression' && value.operator === '!') {
        const argument = syntaxValue(value.argument);
        if (argument !== invalidSyntaxValue) {
            return !argument;
        }
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

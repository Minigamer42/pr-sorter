import { useEffect, useState } from 'react';
import { externalSorterSources } from './externalSorterSources';
import { sorters } from './sorters.generated';
import type { ExternalSorterSource, SorterIndexEntry } from './types';

type SorterIndexCatalog = {
    sorters: LegacyCatalogSorterIndexEntry[];
    externalSources: ExternalSorterSource[];
};

type LegacyCatalogSorterIndexEntry = SorterIndexEntry & {
    category?: string;
};

type SorterIndexGroup = {
    title: string;
    url?: string;
    subgroups: SorterIndexSubgroup[];
};

type SorterIndexSubgroup = {
    title: string;
    sorters: SorterIndexEntry[];
};

type SorterProgress = {
    percent: number;
    label: string;
    kind: 'in-progress' | 'complete';
};

type SorterIndexDisplayEntry = SorterIndexEntry & {
    progress?: SorterProgress;
};

type SorterIndexProgressRequest = {
    type: typeof sorterIndexProgressRequestType;
    requestId: string;
    sorters: { slug: string }[];
};

type SorterIndexProgressResponse = {
    type: typeof sorterIndexProgressResponseType;
    requestId: string;
    progress: SorterIndexProgressResponseEntry[];
};

type SorterIndexProgressResponseEntry = {
    slug?: string;
    localStoragePrefix: string;
    progress: SorterProgress | null;
};

type ExternalSorterProgressResult = {
    status: 'response' | 'timeout';
    progress: SorterIndexProgressResponseEntry[];
};

type StorageAccessDocument = Document & {
    hasStorageAccess?: () => Promise<boolean>;
    requestStorageAccess?: (types?: { localStorage?: boolean }) => Promise<void | { localStorage?: Storage }>;
};

const sorterIndexProgressRequestType = 'pr-sorter:index-progress-request';
const sorterIndexProgressResponseType = 'pr-sorter:index-progress-response';
const sorterIndexProgressReadyType = 'pr-sorter:index-progress-ready';
const externalProgressRequestTimeoutMs = 5000;

export function SorterIndex() {
    const [externalSorters, setExternalSorters] = useState<SorterIndexEntry[]>([]);
    const [externalProgress, setExternalProgress] = useState<Map<string, SorterProgress>>(new Map());
    const [selectedTags, setSelectedTags] = useState<string[]>([]);

    useEffect(() => {
        document.title = 'PR Sorters';
        document.body.classList.add('sorter-index-body');
        document.querySelector('meta[name="og:site_name"]')?.setAttribute('content', 'PR Sorters');
        document.querySelector('meta[name="og:description"]')?.setAttribute('content', 'Choose a sorter to start ranking.');

        return () => {
            document.body.classList.remove('sorter-index-body');
        };
    }, []);

    useEffect(() => {
        let cancelled = false;

        void discoverExternalSorters().then((nextExternalSorters) => {
            if (!cancelled) {
                setExternalSorters(nextExternalSorters);
            }
        });

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        return exposeSorterIndexProgressRequests();
    }, []);

    useEffect(() => {
        let cancelled = false;
        setExternalProgress(new Map());

        void loadExternalSorterProgress(externalSorters, (sourceProgress) => {
            if (!cancelled) {
                setExternalProgress((currentProgress) => new Map([...currentProgress, ...sourceProgress]));
            }
        }).then((nextExternalProgress) => {
            if (!cancelled) {
                setExternalProgress(nextExternalProgress);
            }
        });

        return () => {
            cancelled = true;
        };
    }, [externalSorters]);

    const externalSortersWithProgress = externalSorters.map((sorter): SorterIndexDisplayEntry => {
        const progress = externalProgress.get(externalSorterProgressKey(sorter));
        return progress ? {...sorter, progress} : sorter;
    });
    const allSorters = [...sorters, ...externalSortersWithProgress].filter((sorter) => sorter.hide !== true);
    const allTags = collectTags(allSorters);
    const visibleSorters = selectedTags.length
        ? allSorters.filter((sorter) => hasSelectedTags(sorter, selectedTags))
        : allSorters;
    const sorterGroups = groupSorters(visibleSorters);

    function toggleTag(tag: string): void {
        setSelectedTags((currentTags) =>
            currentTags.includes(tag) ? currentTags.filter((currentTag) => currentTag !== tag) : [...currentTags, tag],
        );
    }

    return (
        <div className="main-page main-page--landing sorter-index-page">
            <div className="title">
                Choose a sorter to start ranking.
            </div>
            {allSorters.length ? (
                <>
                    {allTags.length ? (
                        <div className="sorter-index-tags" aria-label="Filter sorters by tag">
                            {allTags.map((tag) => {
                                const selected = selectedTags.includes(tag);

                                return (
                                    <button
                                        className={`sorter-index-tag${selected ? ' sorter-index-tag--selected' : ''}`}
                                        type="button"
                                        aria-pressed={selected}
                                        onClick={() => toggleTag(tag)}
                                        key={tag}
                                    >
                                        {tag}
                                    </button>
                                );
                            })}
                        </div>
                    ) : null}
                    {visibleSorters.length ? (
                        <div className="sorter-index-sections">
                            {sorterGroups.map((group) => (
                                <section className="sorter-index-section" key={group.title}>
                                    <h2 className="sorter-index-section__title">
                                        {group.url ? (
                                            <a className="sorter-index-section__title-link" href={group.url}>
                                                {group.title}
                                            </a>
                                        ) : (
                                            group.title
                                        )}
                                    </h2>
                                    {group.subgroups.map((subgroup) => (
                                        <section className="sorter-index-subsection" key={`${group.title}:${subgroup.title}`}>
                                            <h3 className="sorter-index-subsection__title">{subgroup.title}</h3>
                                            <div className="sorter-index-grid">
                                                {subgroup.sorters.map((sorter) => (
                                                    <SorterCard
                                                        sorter={sorter}
                                                        showLocalProgress={!sorter.sourceTitle}
                                                        key={`${sorter.sourceTitle ?? 'local'}:${sorter.url ?? sorter.slug}`}
                                                    />
                                                ))}
                                            </div>
                                        </section>
                                    ))}
                                </section>
                            ))}
                        </div>
                    ) : (
                        <p className="sorter-index-empty">No sorters match the selected tags.</p>
                    )}
                </>
            ) : (
                <p className="sorter-index-empty">No sorters have been published yet.</p>
            )}
        </div>
    );
}

function SorterCard({sorter, showLocalProgress}: { sorter: SorterIndexDisplayEntry; showLocalProgress: boolean }) {
    const href = sorter.url ?? `${sorter.slug}/`;
    const iconUrl = sorter.iconUrl ?? `${sorter.slug}/customize/favicon.ico`;
    const progress = sorter.progress ?? (showLocalProgress ? loadSorterProgress(sorter) : null);
    const deadline = formatDeadline(sorter.deadline);

    return (
        <a className="sorter-index-card" href={href}>
            <img className="sorter-index-card__icon" src={iconUrl} alt=""/>
            <div className="sorter-index-card__body">
                <h3>{sorter.title}</h3>
                <p>{sorter.description}</p>
                {deadline ? (
                    <div className={`sorter-index-card__deadline sorter-index-card__deadline--${deadline.kind}`}>
                        <span className="sorter-index-card__deadline-label">Deadline</span>
                        <time dateTime={deadline.iso}>{deadline.absolute}</time>
                        <span>{deadline.relative}</span>
                    </div>
                ) : null}
                {progress ? (
                    <div className="sorter-index-card__progress" aria-label={`${progress.label}: ${progress.percent}%`}>
                        <div className="sorter-index-card__progress-header">
                            <span>{progress.label}</span>
                            <span>{progress.percent}%</span>
                        </div>
                        <div className="sorter-index-card__progress-track">
                            <div className="sorter-index-card__progress-fill" style={{width: `${progress.percent}%`}}/>
                        </div>
                    </div>
                ) : null}
            </div>
        </a>
    );
}

function formatDeadline(deadline: string | undefined): {
    iso: string;
    absolute: string;
    relative: string;
    kind: 'future' | 'soon' | 'past';
} | null {
    if (!deadline) {
        return null;
    }

    const date = new Date(deadline);
    if (Number.isNaN(date.getTime())) {
        return null;
    }

    const diffMs = date.getTime() - Date.now();

    return {
        iso: date.toISOString(),
        absolute: new Intl.DateTimeFormat(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        }).format(date),
        relative: formatRelativeDeadline(date),
        kind: diffMs < 0 ? 'past' : diffMs < 7 * 24 * 60 * 60 * 1000 ? 'soon' : 'future',
    };
}

function formatRelativeDeadline(date: Date): string {
    const diffMs = date.getTime() - Date.now();
    const absMinutes = Math.floor(Math.abs(diffMs) / (60 * 1000));
    const days = Math.floor(absMinutes / (24 * 60));
    const hours = Math.floor((absMinutes % (24 * 60)) / 60);
    const minutes = absMinutes % 60;
    const parts = [
        days > 0 ? `${days}d` : null,
        days > 0 || hours > 0 ? `${hours}h` : null,
        `${minutes}m`,
    ];
    const difference = parts.filter((part): part is string => part !== null).join(' ');

    if (diffMs < 0) {
        return `${difference} ago`;
    }

    return `${difference} left`;
}

function loadSorterProgress(sorter: SorterIndexEntry, storage: Storage = localStorage): SorterProgress | null {
    const localStoragePrefix = sorter.localStoragePrefix ?? sorter.slug;
    if (sorter.rankSupported === false) {
        return loadScoreProgress(localStoragePrefix, sorter, storage);
    }

    const raw = storage.getItem(`${localStoragePrefix}:sort`);
    if (!raw) {
        return null;
    }

    try {
        const value: unknown = JSON.parse(raw);
        if (!isStoredSortState(value)) {
            return null;
        }

        if (value.current === null && value.groups.length === 1) {
            return {percent: 100, label: 'Complete', kind: 'complete'};
        }

        if (value.pickedCount <= 0 && value.history.length === 0) {
            return null;
        }

        const percent = Math.max(1, Math.min(99, Math.floor((value.pickedCount * 100) / Math.max(1, value.estimatedBattles))));
        return {percent, label: 'In progress', kind: 'in-progress'};
    } catch {
        return null;
    }
}

function loadScoreProgress(localStoragePrefix: string, sorter: SorterIndexEntry, storage: Storage): SorterProgress | null {
    if (typeof sorter.songCount !== 'number' || sorter.songCount <= 0) {
        return null;
    }

    const raw = storage.getItem(`${localStoragePrefix}:scores`);
    const scoredCount = raw ? countStoredScores(raw) : 0;
    const cappedScoredCount = Math.min(scoredCount, sorter.songCount);
    const percent = Math.floor((cappedScoredCount * 100) / sorter.songCount);

    return {
        percent,
        label: `${cappedScoredCount} / ${sorter.songCount} scored`,
        kind: cappedScoredCount >= sorter.songCount ? 'complete' : 'in-progress',
    };
}

function countStoredScores(raw: string): number {
    try {
        const value: unknown = JSON.parse(raw);
        if (!isRecord(value)) {
            return 0;
        }

        return Object.values(value).filter((score) => typeof score === 'string' && isValidScore(score)).length;
    } catch {
        return 0;
    }
}

function isValidScore(raw: string): boolean {
    const trimmed = raw.trim();
    if (trimmed === '') {
        return false;
    }

    const value = Number(trimmed);
    return Number.isFinite(value) && value >= 0 && value <= 10;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStoredSortState(value: unknown): value is {
    groups: unknown[];
    current: unknown;
    pickedCount: number;
    estimatedBattles: number;
    history: unknown[];
} {
    return (
        typeof value === 'object' &&
        value !== null &&
        Array.isArray((value as { groups?: unknown }).groups) &&
        'current' in value &&
        typeof (value as { pickedCount?: unknown }).pickedCount === 'number' &&
        typeof (value as { estimatedBattles?: unknown }).estimatedBattles === 'number' &&
        Array.isArray((value as { history?: unknown }).history)
    );
}

function groupSorters(entries: SorterIndexDisplayEntry[]): SorterIndexGroup[] {
    const localSorters = entries.filter((sorter) => !sorter.sourceTitle);
    const groups: SorterIndexGroup[] = localSorters.length ? [{title: 'This Collection', subgroups: groupSorterEntries(localSorters, true)}] : [];
    const externalGroups = new Map<string, SorterIndexEntry[]>();

    for (const sorter of entries) {
        if (!sorter.sourceTitle) {
            continue;
        }

        const group = externalGroups.get(sorter.sourceTitle) ?? [];
        group.push(sorter);
        externalGroups.set(sorter.sourceTitle, group);
    }

    for (const [title, group] of externalGroups) {
        groups.push({title, url: group.find((sorter) => sorter.sourceIndexUrl)?.sourceIndexUrl, subgroups: groupSorterEntries(group, false)});
    }

    return groups;
}

function collectTags(sorters: SorterIndexEntry[]): string[] {
    const tags = new Set<string>();

    for (const sorter of sorters) {
        for (const tag of normalizedTags(sorter.tags)) {
            tags.add(tag);
        }
    }

    return [...tags].sort((left, right) => left.localeCompare(right, undefined, {sensitivity: 'base'}));
}

function hasSelectedTags(sorter: SorterIndexEntry, selectedTags: string[]): boolean {
    const sorterTags = new Set(normalizedTags(sorter.tags));
    return selectedTags.every((tag) => sorterTags.has(tag));
}

function normalizedTags(tags: string[] | undefined): string[] {
    if (!tags) {
        return [];
    }

    return Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)));
}

function groupSorterEntries(entries: SorterIndexDisplayEntry[], includeLocalProgress: boolean): SorterIndexSubgroup[] {
    const now = Date.now();
    const classified = entries.map((sorter, index) => {
        const deadlineTime = parsedDeadlineTime(sorter.deadline);
        const progress = sorter.progress ?? (includeLocalProgress ? loadSorterProgress(sorter) : null);
        const isComplete = progress?.kind === 'complete';
        const isInProgress = progress?.kind === 'in-progress';
        const hasPastDeadline = deadlineTime !== null && deadlineTime < now;
        const isActive = isInProgress || (deadlineTime !== null && !hasPastDeadline && !isComplete);
        const isPast = !isActive && (isComplete || hasPastDeadline);

        return {
            sorter,
            index,
            deadlineTime,
            bucket: isActive ? 'active' : isPast ? 'past' : 'no-deadline',
        };
    });

    return [
        {
            title: 'Active',
            sorters: classified
                .filter((entry) => entry.bucket === 'active')
                .sort(compareClassifiedSorters)
                .map((entry) => entry.sorter),
        },
        {
            title: 'Past',
            sorters: classified
                .filter((entry) => entry.bucket === 'past')
                .sort(compareClassifiedSorters)
                .map((entry) => entry.sorter),
        },
        {
            title: 'No Deadline',
            sorters: classified
                .filter((entry) => entry.bucket === 'no-deadline')
                .sort(compareClassifiedSorters)
                .map((entry) => entry.sorter),
        },
    ].filter((group) => group.sorters.length > 0);
}

function parsedDeadlineTime(deadline: string | undefined): number | null {
    if (!deadline) {
        return null;
    }

    const time = new Date(deadline).getTime();
    return Number.isNaN(time) ? null : time;
}

function compareClassifiedSorters(
    left: { deadlineTime: number | null; index: number },
    right: { deadlineTime: number | null; index: number },
): number {
    if (left.deadlineTime !== null && right.deadlineTime !== null) {
        return left.deadlineTime - right.deadlineTime || left.index - right.index;
    }

    if (left.deadlineTime !== null) {
        return -1;
    }

    if (right.deadlineTime !== null) {
        return 1;
    }

    return left.index - right.index;
}

async function discoverExternalSorters(): Promise<SorterIndexEntry[]> {
    const currentCollectionUrl = new URL('.', window.location.href);
    const pendingSources = [...parseExternalSources(externalSorterSources)];
    const visitedSourceUrls = new Set<string>();
    const visitedCatalogUrls = new Set<string>();
    const seenSorterUrls = new Set(sorters.map((sorter) => new URL(`${sorter.slug}/`, currentCollectionUrl).toString()));
    const discoveredSorters: SorterIndexEntry[] = [];

    for (let index = 0; index < pendingSources.length; index += 1) {
        const source = pendingSources[index];
        const sourceUrl = normalizeCollectionUrl(new URL(source.indexUrl, currentCollectionUrl));
        const sourceKey = sourceUrl.toString();
        if (visitedSourceUrls.has(sourceKey) || sameCollectionUrl(sourceUrl, currentCollectionUrl)) {
            continue;
        }

        visitedSourceUrls.add(sourceKey);

        const sourceCatalog = await readExternalSourceCatalog(source, sourceUrl, visitedCatalogUrls);
        const excludedSorterSlugs = new Set(source.excludedSorterSlugs ?? []);
        const sourceSorters = sourceCatalog.sorters
            .filter((entry) => !excludedSorterSlugs.has(entry.slug))
            .map((entry) => externalizeEntry(entry, sourceUrl, source.title))
            .filter((entry) => {
                const key = entry.url ?? entry.slug;
                if (seenSorterUrls.has(key)) {
                    return false;
                }

                seenSorterUrls.add(key);
                return true;
            });
        discoveredSorters.push(...sourceSorters);

        pendingSources.push(...sourceCatalog.externalSources);
    }

    return discoveredSorters;
}

async function readExternalSourceCatalog(
    source: ExternalSorterSource,
    sourceUrl: URL,
    visitedCatalogUrls: Set<string>,
): Promise<SorterIndexCatalog> {
    try {
        const sorterIndexUrl = new URL('sorter-index.json', sourceUrl);
        const catalogKey = sorterIndexUrl.toString();
        if (visitedCatalogUrls.has(catalogKey)) {
            return {sorters: [], externalSources: []};
        }

        visitedCatalogUrls.add(catalogKey);

        const response = await fetch(sorterIndexUrl);
        if (!response.ok) {
            throw new Error(`${sorterIndexUrl.toString()} returned ${response.status}.`);
        }

        return parseSorterIndexCatalog(await response.json());
    } catch (error) {
        console.warn(`Skipping external sorter source "${source.title}": ${error instanceof Error ? error.message : error}`);
        return {sorters: [], externalSources: []};
    }
}

function parseCatalog(value: unknown): LegacyCatalogSorterIndexEntry[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.filter((entry): entry is LegacyCatalogSorterIndexEntry => {
        const candidate = entry as Partial<LegacyCatalogSorterIndexEntry>;
        const tags = candidate.tags;

        return (
            typeof entry === 'object' &&
            entry !== null &&
            typeof candidate.slug === 'string' &&
            typeof candidate.title === 'string' &&
            typeof candidate.description === 'string' &&
            (tags === undefined || (Array.isArray(tags) && tags.every((tag) => typeof tag === 'string'))) &&
            (candidate.category === undefined || typeof candidate.category === 'string') &&
            (candidate.rankSupported === undefined || typeof candidate.rankSupported === 'boolean') &&
            (candidate.songCount === undefined || typeof candidate.songCount === 'number') &&
            (candidate.deadline === undefined || typeof candidate.deadline === 'string') &&
            (candidate.hide === undefined || typeof candidate.hide === 'boolean')
        );
    });
}

function parseSorterIndexCatalog(value: unknown): SorterIndexCatalog {
    if (typeof value !== 'object' || value === null) {
        return {sorters: [], externalSources: []};
    }

    return {
        sorters: parseCatalog((value as { sorters?: unknown }).sorters),
        externalSources: parseExternalSources((value as { externalSources?: unknown }).externalSources),
    };
}

function parseExternalSources(value: unknown): ExternalSorterSource[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.filter((source): source is ExternalSorterSource => {
        if (typeof source !== 'object' || source === null) {
            return false;
        }

        const candidate = source as ExternalSorterSource;
        const excludedSorterSlugs = candidate.excludedSorterSlugs;

        return (
            typeof candidate.title === 'string' &&
            typeof candidate.indexUrl === 'string' &&
            (excludedSorterSlugs === undefined ||
                (Array.isArray(excludedSorterSlugs) && excludedSorterSlugs.every((slug) => typeof slug === 'string')))
        );
    });
}

function externalizeEntry(entry: LegacyCatalogSorterIndexEntry, indexUrl: URL, sourceTitle: string): SorterIndexEntry {
    const {category, tags, ...entryWithoutCategory} = entry;
    const url = entry.url ? new URL(entry.url, indexUrl) : new URL(`${entry.slug}/`, indexUrl);
    const iconUrl = entry.iconUrl ? new URL(entry.iconUrl, indexUrl) : new URL(`${entry.slug}/customize/favicon.ico`, indexUrl);
    const nextTags = normalizedTags([...(tags ?? []), ...categoryTag(category)]);

    return {
        ...entryWithoutCategory,
        ...(nextTags.length ? {tags: nextTags} : {}),
        slug: `${sourceTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${entry.slug}`,
        url: url.toString(),
        iconUrl: iconUrl.toString(),
        sourceTitle: entry.sourceTitle ?? sourceTitle,
        sourceIndexUrl: indexUrl.toString(),
        sourceSlug: entry.sourceSlug ?? entry.slug,
    };
}

function categoryTag(category: string | undefined): string[] {
    const tag = category?.trim();
    return tag ? [tag] : [];
}

function normalizeCollectionUrl(url: URL): URL {
    return new URL('.', url.pathname.endsWith('/') ? url : new URL(`${url.href}/`));
}

function sameCollectionUrl(left: URL, right: URL): boolean {
    return normalizeCollectionUrl(left).toString() === normalizeCollectionUrl(right).toString();
}

function exposeSorterIndexProgressRequests(): () => void {
    function handleMessage(event: MessageEvent<unknown>): void {
        const request = parseSorterIndexProgressRequest(event.data);
        if (!request || !event.source) {
            return;
        }

        void respondToSorterIndexProgressRequest(event, request);
    }

    window.addEventListener('message', handleMessage);

    if (window.parent !== window) {
        const targetOrigin = parentMessageTargetOrigin();
        window.parent.postMessage(
            {
                type: sorterIndexProgressReadyType,
                origin: window.location.origin,
            },
            targetOrigin,
        );
    }

    return () => {
        window.removeEventListener('message', handleMessage);
    };
}

async function respondToSorterIndexProgressRequest(event: MessageEvent<unknown>, request: SorterIndexProgressRequest): Promise<void> {
    const requestedSorters = requestedSorterStorageTargets(request);
    const storage = await progressStorageForResponder();
    const progress = requestedSorters.map((sorter) => ({
        slug: sorter.slug,
        localStoragePrefix: sorter.localStoragePrefix ?? sorter.slug,
        progress: storage ? loadSorterProgress(sorter, storage) : null,
    }));
    const response: SorterIndexProgressResponse = {
        type: sorterIndexProgressResponseType,
        requestId: request.requestId,
        progress,
    };

    (event.source as Window).postMessage(response, event.origin === 'null' ? '*' : event.origin);
}

function requestedSorterStorageTargets(request: SorterIndexProgressRequest): SorterIndexEntry[] {
    const visibleLocalSorters = sorters.filter((sorter) => sorter.hide !== true);
    const localSortersBySlug = new Map(visibleLocalSorters.map((sorter) => [sorter.slug, sorter]));
    const requestedTargets: SorterIndexEntry[] = [];
    const seenPrefixes = new Set<string>();

    for (const item of request.sorters) {
        const matchedSorter = localSortersBySlug.get(item.slug);
        if (!matchedSorter) {
            continue;
        }

        const localStoragePrefix = matchedSorter.localStoragePrefix ?? matchedSorter.slug;

        if (localStoragePrefix && !seenPrefixes.has(localStoragePrefix)) {
            seenPrefixes.add(localStoragePrefix);
            requestedTargets.push(matchedSorter);
        }
    }

    return requestedTargets;
}

function parseSorterIndexProgressRequest(value: unknown): SorterIndexProgressRequest | null {
    if (typeof value !== 'object' || value === null) {
        return null;
    }

    const candidate = value as Partial<SorterIndexProgressRequest>;
    if (candidate.type !== sorterIndexProgressRequestType || typeof candidate.requestId !== 'string') {
        return null;
    }

    if (!Array.isArray(candidate.sorters)) {
        return null;
    }

    if (!candidate.sorters.every(isSorterIndexProgressRequestSorter)) {
        return null;
    }

    return {
        type: sorterIndexProgressRequestType,
        requestId: candidate.requestId,
        sorters: candidate.sorters,
    };
}

function isSorterIndexProgressRequestSorter(value: unknown): value is { slug: string } {
    return (
        typeof value === 'object' &&
        value !== null &&
        typeof (value as { slug?: unknown }).slug === 'string'
    );
}

async function progressStorageForResponder(): Promise<Storage | null> {
    if (window.parent === window) {
        return localStorage;
    }

    const storageAccessDocument = document as StorageAccessDocument;
    if (!storageAccessDocument.requestStorageAccess) {
        return null;
    }

    try {
        const handle = await storageAccessDocument.requestStorageAccess({localStorage: true});
        return handle && typeof handle === 'object' && handle.localStorage ? handle.localStorage : null;
    } catch {
        return null;
    }
}

async function loadExternalSorterProgress(
    externalEntries: SorterIndexEntry[],
    onSourceProgress?: (sourceProgress: Map<string, SorterProgress>) => void,
): Promise<Map<string, SorterProgress>> {
    const progressByKey = new Map<string, SorterProgress>();
    const sourceGroups = new Map<string, SorterIndexEntry[]>();

    for (const sorter of externalEntries) {
        if (!sorter.sourceIndexUrl) {
            continue;
        }

        const sourceSorters = sourceGroups.get(sorter.sourceIndexUrl) ?? [];
        sourceSorters.push(sorter);
        sourceGroups.set(sorter.sourceIndexUrl, sourceSorters);
    }

    await Promise.all(
        [...sourceGroups].map(async ([sourceIndexUrl, sourceSorters]) => {
            const result = await requestExternalSorterProgress(sourceIndexUrl, sourceSorters);
            const progressBySlug = new Map(result.progress.map((entry) => [entry.slug, entry.progress]));
            const sourceProgressByKey = new Map<string, SorterProgress>();

            for (const sorter of sourceSorters) {
                const sourceSlug = sorter.sourceSlug ?? sorter.slug;
                const progress = progressBySlug.get(sourceSlug);
                if (progress) {
                    progressByKey.set(externalSorterProgressKey(sorter), progress);
                    sourceProgressByKey.set(externalSorterProgressKey(sorter), progress);
                }
            }

            onSourceProgress?.(sourceProgressByKey);
        }),
    );

    return progressByKey;
}

function requestExternalSorterProgress(sourceIndexUrl: string, sourceSorters: SorterIndexEntry[]): Promise<ExternalSorterProgressResult> {
    return new Promise((resolve) => {
        let settled = false;
        const sourceOrigin = new URL(sourceIndexUrl).origin;
        const requestId = crypto.randomUUID();
        const iframe = document.createElement('iframe');
        const requestedSlugs = sourceSorters.map((sorter) => sorter.sourceSlug ?? sorter.slug);
        const timeout = window.setTimeout(() => {
            finish('timeout', []);
        }, externalProgressRequestTimeoutMs);

        iframe.hidden = true;
        iframe.tabIndex = -1;
        iframe.src = sourceIndexUrl;

        function finish(status: ExternalSorterProgressResult['status'], progress: SorterIndexProgressResponseEntry[]): void {
            if (settled) {
                return;
            }

            settled = true;
            window.clearTimeout(timeout);
            window.removeEventListener('message', handleMessage);
            iframe.remove();
            resolve({status, progress});
        }

        function handleMessage(event: MessageEvent<unknown>): void {
            if (!isSorterIndexProgressMessage(event.data)) {
                return;
            }

            if (event.origin !== sourceOrigin) {
                return;
            }

            const iframeWindow = iframe.contentWindow;
            if (!iframeWindow) {
                return;
            }

            if (event.source !== iframeWindow) {
                return;
            }

            if (isSorterIndexProgressReadyMessage(event.data)) {
                iframeWindow.postMessage(
                    {
                        type: sorterIndexProgressRequestType,
                        requestId,
                        sorters: requestedSlugs.map((slug) => ({slug})),
                    },
                    sourceOrigin,
                );
                return;
            }

            if (!isSorterIndexProgressResponse(event.data, requestId)) {
                return;
            }

            finish('response', event.data.progress);
        }

        window.addEventListener('message', handleMessage);
        document.body.append(iframe);
    });
}

function isSorterIndexProgressMessage(value: unknown): boolean {
    return (
        typeof value === 'object' &&
        value !== null &&
        ((value as { type?: unknown }).type === sorterIndexProgressRequestType ||
            (value as { type?: unknown }).type === sorterIndexProgressResponseType ||
            (value as { type?: unknown }).type === sorterIndexProgressReadyType)
    );
}

function isSorterIndexProgressReadyMessage(value: unknown): value is { type: typeof sorterIndexProgressReadyType } {
    return (
        typeof value === 'object' &&
        value !== null &&
        (value as { type?: unknown }).type === sorterIndexProgressReadyType
    );
}

function parentMessageTargetOrigin(): string {
    try {
        return document.referrer ? new URL(document.referrer).origin : '*';
    } catch {
        return '*';
    }
}

function isSorterIndexProgressResponse(value: unknown, requestId: string): value is SorterIndexProgressResponse {
    if (typeof value !== 'object' || value === null) {
        return false;
    }

    const candidate = value as Partial<SorterIndexProgressResponse>;
    return (
        candidate.type === sorterIndexProgressResponseType &&
        candidate.requestId === requestId &&
        Array.isArray(candidate.progress) &&
        candidate.progress.every(isSorterIndexProgressResponseEntry)
    );
}

function isSorterIndexProgressResponseEntry(value: unknown): value is SorterIndexProgressResponseEntry {
    if (typeof value !== 'object' || value === null) {
        return false;
    }

    const candidate = value as Partial<SorterIndexProgressResponseEntry>;
    return (
        typeof candidate.localStoragePrefix === 'string' &&
        (candidate.slug === undefined || typeof candidate.slug === 'string') &&
        (candidate.progress === null || isSorterProgress(candidate.progress))
    );
}

function isSorterProgress(value: unknown): value is SorterProgress {
    if (typeof value !== 'object' || value === null) {
        return false;
    }

    const candidate = value as Partial<SorterProgress>;
    return (
        typeof candidate.percent === 'number' &&
        typeof candidate.label === 'string' &&
        (candidate.kind === 'in-progress' || candidate.kind === 'complete')
    );
}

function externalSorterProgressKey(sorter: SorterIndexEntry): string {
    return `${sorter.sourceIndexUrl ?? ''}:${sorter.sourceSlug ?? sorter.slug}`;
}

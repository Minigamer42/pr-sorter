import { useEffect, useState } from "react";
import externalSorterSources from "./externalSorterSources.json";
import { sorters } from "./sorters.generated";
import type { SorterIndexEntry } from "./types";

type ExternalSorterSource = {
  title: string;
  indexUrl: string;
  catalogUrl?: string;
};

type SorterIndexCatalog = {
  sorters: LegacyCatalogSorterIndexEntry[];
  externalSources: ExternalSorterSource[];
};

type LegacyCatalogSorterIndexEntry = SorterIndexEntry & {
  category?: string;
};

type SorterIndexGroup = {
  title: string;
  subgroups: SorterIndexSubgroup[];
};

type SorterIndexSubgroup = {
  title: string;
  sorters: SorterIndexEntry[];
};

type SorterProgress = {
  percent: number;
  label: string;
  kind: "in-progress" | "complete";
};

export function SorterIndex() {
  const [externalSorters, setExternalSorters] = useState<SorterIndexEntry[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  useEffect(() => {
    document.title = "PR Sorters";
    document.body.classList.add("sorter-index-body");
    document.querySelector('meta[name="og:site_name"]')?.setAttribute("content", "PR Sorters");
    document.querySelector('meta[name="og:description"]')?.setAttribute("content", "Choose a sorter to start ranking.");

    return () => {
      document.body.classList.remove("sorter-index-body");
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

  const allSorters = [...sorters, ...externalSorters].filter((sorter) => sorter.hide !== true);
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
                    className={`sorter-index-tag${selected ? " sorter-index-tag--selected" : ""}`}
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
                  <h2 className="sorter-index-section__title">{group.title}</h2>
                  {group.subgroups.map((subgroup) => (
                    <section className="sorter-index-subsection" key={`${group.title}:${subgroup.title}`}>
                      <h3 className="sorter-index-subsection__title">{subgroup.title}</h3>
                      <div className="sorter-index-grid">
                        {subgroup.sorters.map((sorter) => (
                          <SorterCard
                            sorter={sorter}
                            showLocalProgress={!sorter.sourceTitle}
                            key={`${sorter.sourceTitle ?? "local"}:${sorter.url ?? sorter.slug}`}
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

function SorterCard({ sorter, showLocalProgress }: { sorter: SorterIndexEntry; showLocalProgress: boolean }) {
  const href = sorter.url ?? `${sorter.slug}/`;
  const iconUrl = sorter.iconUrl ?? `${sorter.slug}/customize/favicon.ico`;
  const progress = showLocalProgress ? loadSorterProgress(sorter.localStoragePrefix ?? sorter.slug) : null;
  const deadline = formatDeadline(sorter.deadline);

  return (
    <a className="sorter-index-card" href={href}>
      <img className="sorter-index-card__icon" src={iconUrl} alt="" />
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
              <div className="sorter-index-card__progress-fill" style={{ width: `${progress.percent}%` }} />
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
  kind: "future" | "soon" | "past";
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
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date),
    relative: formatRelativeDeadline(date),
    kind: diffMs < 0 ? "past" : diffMs < 7 * 24 * 60 * 60 * 1000 ? "soon" : "future",
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
  const difference = parts.filter((part): part is string => part !== null).join(" ");

  if (diffMs < 0) {
    return `${difference} ago`;
  }

  return `${difference} left`;
}

function loadSorterProgress(localStoragePrefix: string): SorterProgress | null {
  const raw = localStorage.getItem(`${localStoragePrefix}:sort`);
  if (!raw) {
    return null;
  }

  try {
    const value: unknown = JSON.parse(raw);
    if (!isStoredSortState(value)) {
      return null;
    }

    if (value.current === null && value.groups.length === 1) {
      return { percent: 100, label: "Complete", kind: "complete" };
    }

    if (value.pickedCount <= 0 && value.history.length === 0) {
      return null;
    }

    const percent = Math.max(1, Math.min(99, Math.floor((value.pickedCount * 100) / Math.max(1, value.estimatedBattles))));
    return { percent, label: "In progress", kind: "in-progress" };
  } catch {
    return null;
  }
}

function isStoredSortState(value: unknown): value is {
  groups: unknown[];
  current: unknown;
  pickedCount: number;
  estimatedBattles: number;
  history: unknown[];
} {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as { groups?: unknown }).groups) &&
    "current" in value &&
    typeof (value as { pickedCount?: unknown }).pickedCount === "number" &&
    typeof (value as { estimatedBattles?: unknown }).estimatedBattles === "number" &&
    Array.isArray((value as { history?: unknown }).history)
  );
}

function groupSorters(entries: SorterIndexEntry[]): SorterIndexGroup[] {
  const localSorters = entries.filter((sorter) => !sorter.sourceTitle);
  const groups = localSorters.length ? [{ title: "This Collection", subgroups: groupSorterEntries(localSorters, true) }] : [];
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
    groups.push({ title, subgroups: groupSorterEntries(group, false) });
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

  return [...tags].sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }));
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

function groupSorterEntries(entries: SorterIndexEntry[], includeLocalProgress: boolean): SorterIndexSubgroup[] {
  const now = Date.now();
  const classified = entries.map((sorter, index) => {
    const deadlineTime = parsedDeadlineTime(sorter.deadline);
    const progress = includeLocalProgress ? loadSorterProgress(sorter.localStoragePrefix ?? sorter.slug) : null;
    const isComplete = progress?.kind === "complete";
    const isInProgress = progress?.kind === "in-progress";
    const hasPastDeadline = deadlineTime !== null && deadlineTime < now;
    const isActive = isInProgress || (deadlineTime !== null && !hasPastDeadline && !isComplete);
    const isPast = !isActive && (isComplete || hasPastDeadline);

    return {
      sorter,
      index,
      deadlineTime,
      bucket: isActive ? "active" : isPast ? "past" : "no-deadline",
    };
  });

  return [
    {
      title: "Active",
      sorters: classified
        .filter((entry) => entry.bucket === "active")
        .sort(compareClassifiedSorters)
        .map((entry) => entry.sorter),
    },
    {
      title: "Past",
      sorters: classified
        .filter((entry) => entry.bucket === "past")
        .sort(compareClassifiedSorters)
        .map((entry) => entry.sorter),
    },
    {
      title: "No Deadline",
      sorters: classified
        .filter((entry) => entry.bucket === "no-deadline")
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
  const currentCollectionUrl = new URL(".", window.location.href);
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
    const sourceSorters = sourceCatalog.sorters
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
    const catalogUrl = source.catalogUrl ? new URL(source.catalogUrl, sourceUrl) : new URL("sorter-index.json", sourceUrl);
    const catalogKey = catalogUrl.toString();
    if (visitedCatalogUrls.has(catalogKey)) {
      return { sorters: [], externalSources: [] };
    }

    visitedCatalogUrls.add(catalogKey);

    const response = await fetch(catalogUrl);
    if (!response.ok) {
      throw new Error(`${catalogUrl.toString()} returned ${response.status}.`);
    }

    return parseSorterIndexCatalog(await response.json());
  } catch (error) {
    console.warn(`Skipping external sorter source "${source.title}": ${error instanceof Error ? error.message : error}`);
    return { sorters: [], externalSources: [] };
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
      typeof entry === "object" &&
      entry !== null &&
      typeof candidate.slug === "string" &&
      typeof candidate.title === "string" &&
      typeof candidate.description === "string" &&
      (tags === undefined || (Array.isArray(tags) && tags.every((tag) => typeof tag === "string"))) &&
      (candidate.category === undefined || typeof candidate.category === "string") &&
      (candidate.deadline === undefined || typeof candidate.deadline === "string") &&
      (candidate.hide === undefined || typeof candidate.hide === "boolean")
    );
  });
}

function parseSorterIndexCatalog(value: unknown): SorterIndexCatalog {
  if (typeof value !== "object" || value === null) {
    return { sorters: [], externalSources: [] };
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
    return (
      typeof source === "object" &&
      source !== null &&
      typeof (source as ExternalSorterSource).title === "string" &&
      typeof (source as ExternalSorterSource).indexUrl === "string" &&
      ((source as ExternalSorterSource).catalogUrl === undefined || typeof (source as ExternalSorterSource).catalogUrl === "string")
    );
  });
}

function externalizeEntry(entry: LegacyCatalogSorterIndexEntry, indexUrl: URL, sourceTitle: string): SorterIndexEntry {
  const { category, tags, ...entryWithoutCategory } = entry;
  const url = entry.url ? new URL(entry.url, indexUrl) : new URL(`${entry.slug}/`, indexUrl);
  const iconUrl = entry.iconUrl ? new URL(entry.iconUrl, indexUrl) : new URL(`${entry.slug}/customize/favicon.ico`, indexUrl);
  const nextTags = normalizedTags([...(tags ?? []), ...categoryTag(category)]);

  return {
    ...entryWithoutCategory,
    ...(nextTags.length ? { tags: nextTags } : {}),
    slug: `${sourceTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${entry.slug}`,
    url: url.toString(),
    iconUrl: iconUrl.toString(),
    sourceTitle: entry.sourceTitle ?? sourceTitle,
  };
}

function categoryTag(category: string | undefined): string[] {
  const tag = category?.trim();
  return tag ? [tag] : [];
}

function normalizeCollectionUrl(url: URL): URL {
  return new URL(".", url.pathname.endsWith("/") ? url : new URL(`${url.href}/`));
}

function sameCollectionUrl(left: URL, right: URL): boolean {
  return normalizeCollectionUrl(left).toString() === normalizeCollectionUrl(right).toString();
}

import { useEffect, useState } from "react";
import externalSorterSources from "./externalSorterSources.json";
import { sorters } from "./sorters.generated";
import type { SorterIndexEntry } from "./types";

type ExternalSorterSource = {
  title: string;
  indexUrl: string;
  catalogUrl?: string;
};

export function SorterIndex() {
  const [externalSorters, setExternalSorters] = useState<SorterIndexEntry[]>([]);

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

    void readExternalSorters(externalSorterSources).then((nextExternalSorters) => {
      if (!cancelled) {
        setExternalSorters(nextExternalSorters);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const allSorters = [...sorters, ...externalSorters];
  const sorterGroups = groupSorters(allSorters);

  return (
    <div className="main-page main-page--landing sorter-index-page">
      <div className="title">
        Choose a sorter to start ranking.
      </div>
      {allSorters.length ? (
        <div className="sorter-index-sections">
          {sorterGroups.map((group) => (
            <section className="sorter-index-section" key={group.title}>
              <h2 className="sorter-index-section__title">{group.title}</h2>
              <div className="sorter-index-grid">
                {group.sorters.map((sorter) => (
                  <SorterCard sorter={sorter} key={`${sorter.sourceTitle ?? "local"}:${sorter.url ?? sorter.slug}`} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <p className="sorter-index-empty">No sorters have been published yet.</p>
      )}
    </div>
  );
}

function SorterCard({ sorter }: { sorter: SorterIndexEntry }) {
  const href = sorter.url ?? `${sorter.slug}/`;
  const iconUrl = sorter.iconUrl ?? `${sorter.slug}/customize/favicon.ico`;

  return (
    <a className="sorter-index-card" href={href}>
      <img className="sorter-index-card__icon" src={iconUrl} alt="" />
      <div className="sorter-index-card__body">
        <h3>{sorter.title}</h3>
        <p>{sorter.description}</p>
      </div>
    </a>
  );
}

function groupSorters(entries: SorterIndexEntry[]): { title: string; sorters: SorterIndexEntry[] }[] {
  const localSorters = entries.filter((sorter) => !sorter.sourceTitle);
  const groups = localSorters.length ? [{ title: "This Collection", sorters: localSorters }] : [];
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
    groups.push({ title, sorters: group });
  }

  return groups;
}

async function readExternalSorters(sources: ExternalSorterSource[]): Promise<SorterIndexEntry[]> {
  const sortersBySource = await Promise.all(
    sources
      .filter((source) => source.title && source.indexUrl && !isCurrentCollectionSource(source))
      .map((source) => readExternalSourceSorters(source)),
  );

  return sortersBySource.flat();
}

async function readExternalSourceSorters(source: ExternalSorterSource): Promise<SorterIndexEntry[]> {
  try {
    const indexUrl = new URL(source.indexUrl);
    const catalogUrl = source.catalogUrl ? new URL(source.catalogUrl, indexUrl) : new URL("sorters.json", indexUrl);
    const response = await fetch(catalogUrl);
    if (!response.ok) {
      throw new Error(`${catalogUrl.toString()} returned ${response.status}.`);
    }

    const catalog = parseCatalog(await response.json());

    return uniqueEntries(catalog.map((entry) => externalizeEntry(entry, indexUrl, source.title)));
  } catch (error) {
    console.warn(`Skipping external sorter source "${source.title}": ${error instanceof Error ? error.message : error}`);
    return [];
  }
}

function parseCatalog(value: unknown): SorterIndexEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is SorterIndexEntry => {
    return (
      typeof entry === "object" &&
      entry !== null &&
      typeof (entry as SorterIndexEntry).slug === "string" &&
      typeof (entry as SorterIndexEntry).title === "string" &&
      typeof (entry as SorterIndexEntry).description === "string"
    );
  });
}

function externalizeEntry(entry: SorterIndexEntry, indexUrl: URL, sourceTitle: string): SorterIndexEntry {
  const url = entry.url ? new URL(entry.url, indexUrl) : new URL(`${entry.slug}/`, indexUrl);
  const iconUrl = entry.iconUrl ? new URL(entry.iconUrl, indexUrl) : new URL(`${entry.slug}/customize/favicon.ico`, indexUrl);

  return {
    ...entry,
    slug: `${sourceTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${entry.slug}`,
    url: url.toString(),
    iconUrl: iconUrl.toString(),
    sourceTitle: entry.sourceTitle ?? sourceTitle,
  };
}

function uniqueEntries(entries: SorterIndexEntry[]): SorterIndexEntry[] {
  const seen = new Set<string>();

  return entries.filter((entry) => {
    const key = entry.url ?? entry.slug;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function isCurrentCollectionSource(source: ExternalSorterSource): boolean {
  const sourceUrl = new URL(source.indexUrl);
  const currentUrl = new URL(".", window.location.href);
  const sourcePath = sourceUrl.pathname.endsWith("/") ? sourceUrl.pathname : `${sourceUrl.pathname}/`;
  const currentPath = currentUrl.pathname.endsWith("/") ? currentUrl.pathname : `${currentUrl.pathname}/`;

  return sourceUrl.origin === currentUrl.origin && sourcePath === currentPath;
}

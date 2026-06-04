import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type SorterIndexEntry = {
  slug: string;
  title: string;
  description: string;
  tags?: string[];
  localStoragePrefix?: string;
  deadline?: string;
};

export type SorterIndexManifestEntry = SorterIndexEntry & {
  hide?: boolean;
};

type ExternalSorterSource = {
  title: string;
  indexUrl: string;
  catalogUrl?: string;
};

type PublicSorterIndexEntry = Omit<SorterIndexEntry, "localStoragePrefix">;

const externalSourcesPath = path.resolve(process.cwd(), "src", "sorterIndex", "externalSorterSources.json");
const publicCatalogPath = path.resolve(process.cwd(), "public", "sorter-index.json");

export async function writePublicSorterIndexCatalog(sorters: SorterIndexManifestEntry[]): Promise<void> {
  const externalSources = await readExternalSources();
  const visibleSorters = publicIndexEntries(sorters);

  await mkdir(path.dirname(publicCatalogPath), { recursive: true });
  await writeFile(publicCatalogPath, `${JSON.stringify({ sorters: visibleSorters, externalSources }, null, 2)}\n`, "utf8");
}

export function sortIndexEntries<T extends SorterIndexEntry>(entries: T[]): T[] {
  return entries.sort((left, right) => left.title.localeCompare(right.title, undefined, { sensitivity: "base" }));
}

export function visibleIndexEntries(entries: SorterIndexManifestEntry[]): SorterIndexEntry[] {
  return entries
    .filter((entry) => entry.hide !== true)
    .map(({ hide: _hide, ...entry }) => entry);
}

function publicIndexEntries(entries: SorterIndexManifestEntry[]): PublicSorterIndexEntry[] {
  return visibleIndexEntries(entries).map(({ localStoragePrefix: _localStoragePrefix, ...entry }) => entry);
}

async function readExternalSources(): Promise<ExternalSorterSource[]> {
  try {
    const parsed = JSON.parse(await readFile(externalSourcesPath, "utf8")) as ExternalSorterSource[];

    return parsed.filter((source) => source.title && source.indexUrl);
  } catch {
    return [];
  }
}

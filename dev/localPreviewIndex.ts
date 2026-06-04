import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadCustomizeConfig, serializedDeadline } from "./configLoader.js";
import { writePublicSorterIndexCatalog } from "./sorterIndexCatalog.js";

export const previewSlug = "test";

const generatedModulePath = path.resolve(process.cwd(), "src", "sorterIndex", "sorters.generated.ts");

export async function writeLocalPreviewSorterIndex(): Promise<void> {
  const config = await loadCustomizeConfig();
  const deadline = serializedDeadline(config);
  const localSorter = config.hide
    ? []
    : Array.from({ length: 3 }, (_, index) => ({
        slug: index === 0 ? previewSlug : `${previewSlug}-${index + 1}`,
        title: `${config.title} ${index + 1}`,
        description: config.description,
        localStoragePrefix: config.localStoragePrefix,
        ...(deadline ? { deadline } : {}),
        url: `${previewSlug}/`,
        iconUrl: `${previewSlug}/customize/favicon.ico`,
      }));

  await mkdir(path.dirname(generatedModulePath), { recursive: true });
  await writeFile(
    generatedModulePath,
    `import type { SorterIndexEntry } from "./types";\n\nexport const sorters: SorterIndexEntry[] = ${JSON.stringify(localSorter, null, 2)};\n`,
    "utf8",
  );
  await writePublicSorterIndexCatalog(localSorter);
}

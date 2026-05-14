import type { SortState } from "../sorter";
import { z } from "zod";
import type { AppConfig, Settings } from "./types";
import { isSortState } from "./internal/savedSortValidation";

type StorageFacade = {
  loadSort(): SortState | null;
  saveSort(sort: SortState): void;
  loadSettings(): Settings;
  saveSettings(settings: Settings): void;
};

const settingsSchema = z.object({
  preferVideo: z.boolean(),
  region: z.enum(["eu", "naw", "nae"]),
});

export function createStorage(config: AppConfig, songCount: number): StorageFacade {
  const sortKey = `${config.localStoragePrefix}:sort`;
  const settingsKey = `${config.localStoragePrefix}:settings`;

  function loadSort(): SortState | null {
    const raw = localStorage.getItem(sortKey);
    if (!raw) {
      return null;
    }

    try {
      const parsed: unknown = JSON.parse(raw);
      if (isSortState(parsed, songCount)) {
        return parsed;
      }
    } catch {
      // Invalid progress is removed below.
    }

    localStorage.removeItem(sortKey);
    return null;
  }

  function saveSort(sort: SortState): void {
    localStorage.setItem(sortKey, JSON.stringify(sort));
  }

  function loadSettings(): Settings {
    const fallback: Settings = { preferVideo: true, region: "eu" };
    const raw = localStorage.getItem(settingsKey);
    if (!raw) {
      return fallback;
    }

    try {
      const parsed: unknown = JSON.parse(raw);
      const result = settingsSchema.safeParse(parsed);
      if (result.success) {
        return result.data;
      }
    } catch {
      // Invalid settings fall back to defaults.
    }

    localStorage.removeItem(settingsKey);
    return fallback;
  }

  function saveSettings(settings: Settings): void {
    localStorage.setItem(settingsKey, JSON.stringify(settings));
  }

  return { loadSort, saveSort, loadSettings, saveSettings };
}

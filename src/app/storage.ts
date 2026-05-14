import type { SortState } from "../sorter";
import { z } from "zod";
import type { AppConfig, GoogleSpreadsheetSelection, Settings } from "./types";
import { isSortState } from "./internal/savedSortValidation";

type StorageFacade = {
  loadSort(): SortState | null;
  saveSort(sort: SortState): void;
  loadSettings(): Settings;
  saveSettings(settings: Settings): void;
  loadGoogleSpreadsheetSelection(): GoogleSpreadsheetSelection | null;
  saveGoogleSpreadsheetSelection(selection: GoogleSpreadsheetSelection): void;
  clearGoogleSpreadsheetSelection(): void;
};

const settingsSchema = z.object({
  preferVideo: z.boolean(),
  region: z.enum(["eu", "naw", "nae"]),
});

const googleSpreadsheetSelectionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
});

export function createStorage(config: AppConfig, songCount: number): StorageFacade {
  const sortKey = `${config.localStoragePrefix}:sort`;
  const settingsKey = `${config.localStoragePrefix}:settings`;
  const googleSpreadsheetSelectionKey = `${config.localStoragePrefix}:google-spreadsheet-selection`;

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

  function loadGoogleSpreadsheetSelection(): GoogleSpreadsheetSelection | null {
    const raw = localStorage.getItem(googleSpreadsheetSelectionKey);
    if (!raw) {
      return null;
    }

    try {
      const parsed: unknown = JSON.parse(raw);
      const result = googleSpreadsheetSelectionSchema.safeParse(parsed);
      if (result.success) {
        return result.data;
      }
    } catch {
      // Invalid Google Sheet selection is removed below.
    }

    localStorage.removeItem(googleSpreadsheetSelectionKey);
    return null;
  }

  function saveGoogleSpreadsheetSelection(selection: GoogleSpreadsheetSelection): void {
    localStorage.setItem(googleSpreadsheetSelectionKey, JSON.stringify(selection));
  }

  function clearGoogleSpreadsheetSelection(): void {
    localStorage.removeItem(googleSpreadsheetSelectionKey);
  }

  return {
    loadSort,
    saveSort,
    loadSettings,
    saveSettings,
    loadGoogleSpreadsheetSelection,
    saveGoogleSpreadsheetSelection,
    clearGoogleSpreadsheetSelection,
  };
}

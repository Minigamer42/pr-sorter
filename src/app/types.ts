import type { SortState } from "../sorter";
import type { Song } from "../songs";

export type AppConfig = {
  localStoragePrefix: string;
  title: string;
  description: string;
};

export type Region = "eu" | "naw" | "nae";

export type Settings = {
  preferVideo: boolean;
  region: Region;
};

export type Screen = "landing" | "sorting" | "complete";

export type AppState = {
  screen: Screen;
  songs: Song[];
  settings: Settings;
  sort: SortState | null;
};

export type SavedProgressKind = "none" | "in-progress" | "complete";

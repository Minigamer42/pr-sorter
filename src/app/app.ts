import { choose, createSort, isComplete, ranksBySongId, undo, type SortChoice, type SortState } from "../sorter";
import type { Song } from "../songs";
import { bindDom } from "./dom";
import { createRenderer } from "./render";
import { bindSettingsModal } from "./settingsModal";
import { createStorage } from "./storage";
import type { AppConfig, AppState, SavedProgressKind, Screen, Settings } from "./types";

export type CreateAppOptions = {
  config: AppConfig;
  songs: Song[];
};

type App = {
  start(): void;
};

const screenFor = (sort: SortState | null): Screen => {
  if (!sort) {
    return "landing";
  }

  return isComplete(sort) ? "complete" : "sorting";
};

export function createApp(options: CreateAppOptions): App {
  const { config, songs } = options;
  const storage = createStorage(config, songs.length);
  const refs = bindDom();

  let state: AppState = {
    screen: "landing",
    songs,
    settings: storage.loadSettings(),
    sort: null,
  };

  function savedKind(): SavedProgressKind {
    const savedSort = storage.loadSort();
    if (!savedSort) {
      return "none";
    }

    return isComplete(savedSort) ? "complete" : "in-progress";
  }

  function render(): void {
    renderer.render(state, savedKind());
  }

  function copyRanks(): void {
    if (!state.sort) {
      return;
    }

    const ranks = ranksBySongId(state.songs, state.sort);
    const lines = state.songs.map((song) => {
      const rank = ranks.get(song.id);
      if (rank === undefined) {
        throw new Error(`Missing rank for song id ${song.id}.`);
      }
      return rank;
    });
    void navigator.clipboard
      .writeText(lines.join("\n"))
      .then(() => {
        alert("Copied ranks to clipboard!");
      })
      .catch((error: unknown) => {
        console.error("Error copying ranks:", error);
        alert("Could not copy ranks to clipboard.");
      });
  }

  function updateSettings(nextSettings: Settings): void {
    state = { ...state, settings: nextSettings };
    storage.saveSettings(state.settings);
    settingsModal.sync();
    if (state.screen === "sorting") {
      render();
    }
  }

  function startSort(): void {
    const sort = createSort(state.songs.length);
    state = { ...state, sort, screen: screenFor(sort) };
    storage.saveSort(sort);
    render();
  }

  function loadSort(): void {
    const savedSort = storage.loadSort();
    if (!savedSort) {
      render();
      return;
    }

    state = { ...state, sort: savedSort, screen: screenFor(savedSort) };
    render();
  }

  function pick(choice: SortChoice): void {
    if (!state.sort) {
      return;
    }

    const sort = choose(state.sort, choice);
    state = { ...state, sort, screen: screenFor(sort) };
    storage.saveSort(sort);
    render();
  }

  function undoPick(): void {
    if (!state.sort) {
      return;
    }

    const sort = undo(state.sort);
    state = { ...state, sort, screen: screenFor(sort) };
    storage.saveSort(sort);
    render();
  }

  const renderer = createRenderer(refs, {
    start: startSort,
    load: loadSort,
    pick,
    undo: undoPick,
    copyRanks,
  });

  const settingsModal = bindSettingsModal({
    refs,
    getSettings: () => state.settings,
    onChange: updateSettings,
  });

  function start(): void {
    document.title = config.title;
    document.querySelector('meta[name="og:site_name"]')?.setAttribute("content", config.title);
    document.querySelector('meta[name="og:description"]')?.setAttribute("content", config.description);
    settingsModal.sync();
    render();
  }

  return { start };
}

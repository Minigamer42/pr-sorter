import { useEffect, useMemo, useState } from "react";
import {
  choose,
  createSort,
  isComplete,
  progressPercentage,
  ranksBySongId,
  undo,
  type SortChoice,
  type SortState,
} from "../sorter";
import type { Song } from "../songs";
import { Controls } from "./components/Controls";
import { Duel } from "./components/Duel";
import { Progress } from "./components/Progress";
import { Results } from "./components/Results";
import { SettingsModal } from "./components/SettingsModal";
import { createStorage } from "./storage";
import type { AppConfig, SavedProgressKind, Screen, Settings } from "./types";

type AppProps = {
  config: AppConfig;
  songs: Song[];
};

const screenFor = (sort: SortState | null): Screen => {
  if (!sort) {
    return "landing";
  }

  return isComplete(sort) ? "complete" : "sorting";
};

export function App({ config, songs }: AppProps) {
  const storage = useMemo(() => createStorage(config, songs.length), [config, songs.length]);
  const [screen, setScreen] = useState<Screen>("landing");
  const [settings, setSettings] = useState<Settings>(() => storage.loadSettings());
  const [sort, setSort] = useState<SortState | null>(null);
  const [isSettingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    document.title = config.title;
    document.querySelector('meta[name="og:site_name"]')?.setAttribute("content", config.title);
    document.querySelector('meta[name="og:description"]')?.setAttribute("content", config.description);
  }, [config.description, config.title]);

  const savedKind: SavedProgressKind = useMemo(() => {
    if (screen !== "landing") {
      return "none";
    }

    const savedSort = storage.loadSort();
    if (!savedSort) {
      return "none";
    }

    return isComplete(savedSort) ? "complete" : "in-progress";
  }, [screen, storage]);

  function startSort(): void {
    const nextSort = createSort(songs.length);
    setSort(nextSort);
    setScreen(screenFor(nextSort));
    storage.saveSort(nextSort);
  }

  function loadSort(): void {
    const savedSort = storage.loadSort();
    if (!savedSort) {
      setScreen("landing");
      setSort(null);
      return;
    }

    setSort(savedSort);
    setScreen(screenFor(savedSort));
  }

  function pick(choice: SortChoice): void {
    if (!sort) {
      return;
    }

    const nextSort = choose(sort, choice);
    setSort(nextSort);
    setScreen(screenFor(nextSort));
    storage.saveSort(nextSort);
  }

  function undoPick(): void {
    if (!sort) {
      return;
    }

    const nextSort = undo(sort);
    setSort(nextSort);
    setScreen(screenFor(nextSort));
    storage.saveSort(nextSort);
  }

  function updateSettings(nextSettings: Settings): void {
    setSettings(nextSettings);
    storage.saveSettings(nextSettings);
  }

  function copyRanks(): void {
    if (!sort) {
      return;
    }

    const ranks = ranksBySongId(songs, sort);
    const lines = songs.map((song) => {
      const rank = ranks.get(song.id);
      if (rank === undefined) {
        throw new Error(`Missing rank for song id ${song.id}.`);
      }
      return String(rank);
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

  const progressLabel =
    sort && screen === "complete"
      ? `Completed! (${sort.battleNo} battles)`
      : sort && screen === "sorting"
        ? `Battle no. ${sort.battleNo}`
        : "";
  const progressValue =
    sort && screen === "complete"
      ? 100
      : sort && screen === "sorting"
        ? progressPercentage(sort, songs.length)
        : 0;

  return (
    <>
      <SettingsModal
        open={isSettingsOpen}
        settings={settings}
        onClose={() => setSettingsOpen(false)}
        onChange={updateSettings}
      />
      <div className={`main-page ${screen === "landing" ? "main-page--landing" : ""}`}>
        {screen !== "sorting" ? (
          <div className="title" style={screen === "complete" ? { height: "3%" } : undefined}>
            {screen === "complete" ? "Make sure your sheet is sorted by ID before pasting!" : landingTitle(savedKind)}
          </div>
        ) : null}

        <Controls
          screen={screen}
          savedKind={savedKind}
          onOpenSettings={() => setSettingsOpen(true)}
          onStart={startSort}
          onLoad={loadSort}
          onUndo={undoPick}
          onCopyRanks={copyRanks}
        />

        {screen !== "landing" && sort ? (
          <>
            <div className="duel-container">
              {screen === "sorting" ? <Duel songs={songs} sort={sort} settings={settings} onPick={pick} /> : null}
              {screen === "complete" ? <Results songs={songs} sort={sort} /> : null}
            </div>
            <Progress label={progressLabel} percentage={progressValue} />
          </>
        ) : null}
      </div>
    </>
  );
}

function landingTitle(savedKind: SavedProgressKind): string {
  if (savedKind === "complete") {
    return 'Press "Start" to begin sorting or "Show Results" to display results of previous sorting.';
  }

  if (savedKind === "in-progress") {
    return 'Press "Start" to begin sorting or "Continue" to load saved progress and resume where you left.';
  }

  return 'Press "Start" to begin sorting.';
}

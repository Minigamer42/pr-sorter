import { Media } from "../../media";
import type { ResolvedSong } from "../../songs";
import type { Settings, SongScoresById } from "../types";

export type PlaylistMode = "in-order" | "random";

type PlaylistProps = {
  songs: ResolvedSong[];
  currentSong: ResolvedSong | null;
  currentPosition: number;
  orderLength: number;
  mode: PlaylistMode;
  settings: Settings;
  scoreEnabled: boolean;
  scoresBySongId: SongScoresById;
  onModeChange(mode: PlaylistMode): void;
  onPrevious(): void;
  onNext(): void;
  onScoreChange(songId: number, score: string): void;
};

export function Playlist({
  songs,
  currentSong,
  currentPosition,
  orderLength,
  mode,
  settings,
  scoreEnabled,
  scoresBySongId,
  onModeChange,
  onPrevious,
  onNext,
  onScoreChange,
}: PlaylistProps) {
  if (songs.length === 0 || !currentSong) {
    return (
      <div className="playlist">
        <div className="playlist-empty">No songs are configured.</div>
      </div>
    );
  }

  return (
    <div className="playlist">
      <div className="playlist-toolbar">
        <div className="playlist-position">
          {currentPosition + 1} / {orderLength}
        </div>
        <div className="playlist-mode" aria-label="Playlist order">
          <button
            className={`playlist-mode__button${mode === "in-order" ? " playlist-mode__button--active" : ""}`}
            type="button"
            onClick={() => onModeChange("in-order")}
          >
            In order
          </button>
          <button
            className={`playlist-mode__button${mode === "random" ? " playlist-mode__button--active" : ""}`}
            type="button"
            onClick={() => onModeChange("random")}
          >
            Random
          </button>
        </div>
      </div>

      <div className={`playlist-card${scoreEnabled ? " playlist-card--scored" : ""}`}>
        <div className="playlist-media">
          <Media
            key={`${currentSong.id}:${settings.mediaFormat}:${settings.region}`}
            song={currentSong}
            settings={settings}
            autoPlay
            onEnded={onNext}
          />
        </div>
        <div className="playlist-song-meta">
          <div className="playlist-anime">{currentSong.anime}</div>
          <div className="playlist-song">{currentSong.name}</div>
        </div>
        {scoreEnabled ? (
          <label className="score-field playlist-score-field">
            <span>Score</span>
            <input
              type="number"
              min="0"
              max="10"
              step="0.01"
              value={scoresBySongId[currentSong.id] ?? ""}
              onChange={(event) => onScoreChange(currentSong.id, event.currentTarget.value)}
            />
          </label>
        ) : null}
        <div className="playlist-actions">
          <button type="button" onClick={onPrevious}>
            Previous
          </button>
          <button type="button" onClick={onNext}>
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

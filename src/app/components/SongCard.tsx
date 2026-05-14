import { Media } from "../../media";
import type { SortChoice } from "../../sorter";
import type { Song } from "../../songs";
import type { Settings } from "../types";

type SongCardProps = {
  song: Song;
  side: SortChoice;
  settings: Settings;
  onPick(choice: SortChoice): void;
};

export function SongCard({ song, side, settings, onPick }: SongCardProps) {
  return (
    <div className="music-card">
      <div data-slot="media">
        <Media song={song} settings={settings} />
      </div>
      <div className="anime">{song.anime}</div>
      <div className="song">{song.name}</div>
      <button type="button" onClick={() => onPick(side)}>
        PICK
      </button>
    </div>
  );
}

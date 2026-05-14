import { currentBattle, type SortChoice, type SortState } from "../../sorter";
import type { Song } from "../../songs";
import type { Settings } from "../types";
import { SongCard } from "./SongCard";

type DuelProps = {
  songs: Song[];
  sort: SortState;
  settings: Settings;
  onPick(choice: SortChoice): void;
};

export function Duel({ songs, sort, settings, onPick }: DuelProps) {
  const battle = currentBattle(sort);
  if (battle === null) {
    return null;
  }

  const [leftIndex, rightIndex] = battle;
  const leftSong = songs[leftIndex];
  const rightSong = songs[rightIndex];
  if (leftSong === undefined || rightSong === undefined) {
    throw new Error("Sorter state references a song index outside the configured song list.");
  }

  return (
    <>
      <SongCard song={leftSong} side="left" settings={settings} onPick={onPick} />
      <SongCard song={rightSong} side="right" settings={settings} onPick={onPick} />
    </>
  );
}

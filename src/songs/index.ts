import songList from "../../customize/songList.json";

export type Song = {
  id: number;
  anime: string;
  name: string;
  video: string | null;
  mp3: string | null;
};

export function loadSongs(): Song[] {
  if (!Array.isArray(songList)) {
    throw new Error("customize/songList.json must be an array.");
  }

  return songList.map((song, index) => {
    if (
      typeof song.id !== "number" ||
      typeof song.anime !== "string" ||
      typeof song.name !== "string" ||
      !("video" in song) ||
      !("mp3" in song) ||
      (song.video !== null && typeof song.video !== "string") ||
      (song.mp3 !== null && typeof song.mp3 !== "string")
    ) {
      throw new Error(`Invalid song at index ${index}.`);
    }

    return {
      id: song.id,
      anime: song.anime,
      name: song.name,
      video: song.video,
      mp3: song.mp3,
    };
  });
}

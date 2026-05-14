import { ranksBySongId, type SortState } from "../../sorter";
import type { Song } from "../../songs";

type ResultsProps = {
  songs: Song[];
  sort: SortState;
};

export function Results({ songs, sort }: ResultsProps) {
  const ranks = ranksBySongId(songs, sort);

  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Anime</th>
            <th>Song</th>
            <th>Rank</th>
          </tr>
        </thead>
        <tbody>
          {songs.map((song) => {
            const rank = ranks.get(song.id);
            if (rank === undefined) {
              throw new Error(`Missing rank for song id ${song.id}.`);
            }

            return (
              <tr key={song.id}>
                <td>{song.id}</td>
                <td title={song.anime}>{song.anime}</td>
                <td title={song.name}>{song.name}</td>
                <td>{rank}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

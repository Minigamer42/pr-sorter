import { createMediaElement } from "../media";
import { currentBattle, isComplete, ranksBySongId, type SortChoice } from "../sorter";
import type { Song } from "../songs";
import type { DomRefs } from "./dom";
import { createButton } from "./internal/elements";
import type { AppState, SavedProgressKind } from "./types";

export type AppActions = {
  start(): void;
  load(): void;
  pick(choice: SortChoice): void;
  undo(): void;
  copyRanks(): void;
};

type Renderer = {
  render(state: AppState, savedKind: SavedProgressKind): void;
};

export function createRenderer(refs: DomRefs, actions: AppActions): Renderer {
  function setProgress(indicator: string, percentage: number): void {
    refs.progressBattle.textContent = indicator;
    refs.progressBar.style.width = `${percentage}%`;
  }

  function resetDynamicUi(): void {
    refs.duelContainer.replaceChildren();
    refs.buttonContainer.querySelector("#undo")?.remove();
    refs.buttonContainer.querySelector("#copy-ranks")?.remove();
    refs.progress.hidden = true;
    refs.progressContainer.hidden = true;
    refs.progressBattle.textContent = "";
    refs.progressBar.style.width = "0%";
    refs.startButton.style.display = "";
    refs.loadButton.style.display = "";
    refs.loadButton.hidden = false;
    refs.title.style.display = "block";
    refs.title.style.height = "7%";
  }

  function createMusicCard(state: AppState, song: Song, side: SortChoice): HTMLElement {
    const fragment = refs.cardTemplate.content.cloneNode(true) as DocumentFragment;
    const card = fragment.querySelector<HTMLElement>(".music-card")!;
    const mediaSlot = fragment.querySelector<HTMLElement>('[data-slot="media"]')!;
    const anime = fragment.querySelector<HTMLElement>('[data-slot="anime"]')!;
    const songName = fragment.querySelector<HTMLElement>('[data-slot="song"]')!;
    const button = fragment.querySelector<HTMLButtonElement>('[data-action="pick"]')!;

    mediaSlot.replaceChildren(createMediaElement(song, state.settings));
    anime.textContent = song.anime;
    songName.textContent = song.name;
    button.addEventListener("click", () => actions.pick(side));

    return card;
  }

  function renderLanding(savedKind: SavedProgressKind): void {
    refs.title.textContent = 'Press "Start" to begin sorting.';
    refs.loadButton.textContent = "Load";

    if (savedKind === "none") {
      refs.loadButton.hidden = true;
      return;
    }

    refs.loadButton.hidden = false;
    if (savedKind === "complete") {
      refs.loadButton.textContent = "Show Results";
      refs.title.textContent = 'Press "Start" to begin sorting or "Show Results" to display results of previous sorting.';
    } else {
      refs.loadButton.textContent = "Continue";
      refs.title.textContent = 'Press "Start" to begin sorting or "Continue" to load saved progress and resume where you left.';
    }
  }

  function renderDuel(state: AppState): void {
    if (!state.sort) {
      return;
    }

    const battle = currentBattle(state.sort);
    if (battle === null) {
      return;
    }

    refs.title.style.display = "none";
    refs.startButton.style.display = "none";
    refs.loadButton.style.display = "none";
    refs.progress.hidden = false;
    refs.progressContainer.hidden = false;
    refs.buttonContainer.appendChild(createButton("undo", "basic-button", "Undo", actions.undo));

    const [leftIndex, rightIndex] = battle;
    const leftSong = state.songs[leftIndex];
    const rightSong = state.songs[rightIndex];
    if (leftSong === undefined || rightSong === undefined) {
      throw new Error("Sorter state references a song index outside songList.json.");
    }

    refs.duelContainer.append(createMusicCard(state, leftSong, "left"), createMusicCard(state, rightSong, "right"));

    const percentage = Math.min(99, Math.floor((state.sort.pickedCount * 100) / state.sort.estimatedBattles));
    setProgress(`Battle no. ${state.sort.battleNo}`, percentage);
  }

  function renderResults(state: AppState): void {
    if (!state.sort || !isComplete(state.sort)) {
      return;
    }

    refs.title.style.height = "3%";
    refs.title.textContent = "Make sure your sheet is sorted by ID before pasting!";
    refs.startButton.style.display = "none";
    refs.loadButton.style.display = "none";
    refs.progress.hidden = false;
    refs.progressContainer.hidden = false;
    refs.buttonContainer.appendChild(createButton("copy-ranks", "copy-button", "Copy ranks to clipboard", actions.copyRanks));
    setProgress(`Completed! (${state.sort.battleNo} battles)`, 100);

    const table = document.createElement("table");
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    for (const header of ["ID", "Anime", "Song", "Rank"]) {
      const th = document.createElement("th");
      th.textContent = header;
      headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const ranks = ranksBySongId(state.songs, state.sort);
    const tbody = document.createElement("tbody");
    for (const song of state.songs) {
      const row = document.createElement("tr");
      const id = document.createElement("td");
      id.textContent = String(song.id);

      const anime = document.createElement("td");
      anime.textContent = song.anime;
      anime.title = song.anime;

      const songName = document.createElement("td");
      songName.textContent = song.name;
      songName.title = song.name;

      const rank = document.createElement("td");
      const songRank = ranks.get(song.id);
      if (songRank === undefined) {
        throw new Error(`Missing rank for song id ${song.id}.`);
      }
      rank.textContent = String(songRank);

      row.append(id, anime, songName, rank);
      tbody.appendChild(row);
    }
    table.appendChild(tbody);

    const tableContainer = document.createElement("div");
    tableContainer.className = "table-container";
    tableContainer.appendChild(table);
    refs.duelContainer.appendChild(tableContainer);
  }

  function render(state: AppState, savedKind: SavedProgressKind): void {
    resetDynamicUi();

    if (state.screen === "landing") {
      renderLanding(savedKind);
    } else if (state.screen === "sorting") {
      renderDuel(state);
    } else {
      renderResults(state);
    }
  }

  refs.startButton.addEventListener("click", actions.start);
  refs.loadButton.addEventListener("click", actions.load);

  return { render };
}

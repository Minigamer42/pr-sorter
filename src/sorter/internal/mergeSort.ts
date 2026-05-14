export type SortChoice = "left" | "right";

export type Merge = {
  left: number[];
  right: number[];
  merged: number[];
  leftPos: number;
  rightPos: number;
};

export type SortState = {
  groups: number[][];
  current: Merge | null;
  battleNo: number;
  pickedCount: number;
  estimatedBattles: number;
  history: Omit<SortState, "history">[];
};

type Snapshot = Omit<SortState, "history">;

const cloneMerge = (merge: SortState["current"]): SortState["current"] =>
  merge && {
    left: [...merge.left],
    right: [...merge.right],
    merged: [...merge.merged],
    leftPos: merge.leftPos,
    rightPos: merge.rightPos,
  };

const snapshot = (state: SortState): Snapshot => ({
  groups: state.groups.map((group) => [...group]),
  current: cloneMerge(state.current),
  battleNo: state.battleNo,
  pickedCount: state.pickedCount,
  estimatedBattles: state.estimatedBattles,
});

export const isComplete = (sort: SortState): boolean => sort.current === null && sort.groups.length === 1;

export function createSort(songCount: number): SortState {
  return nextBattle({
    groups: Array.from({ length: songCount }, (_, index) => [index]),
    current: null,
    battleNo: 1,
    pickedCount: 0,
    estimatedBattles: Math.max(1, Math.ceil(songCount * Math.log2(Math.max(2, songCount)))),
    history: [],
  });
}

function nextBattle(state: SortState): SortState {
  while (state.current === null && state.groups.length > 1) {
    const left = state.groups.shift();
    const right = state.groups.shift();
    if (left && right) {
      state.current = { left, right, merged: [], leftPos: 0, rightPos: 0 };
    }
  }
  return state;
}

export function currentBattle(sort: SortState): [number, number] | null {
  const merge = sort.current;
  return merge ? [merge.left[merge.leftPos], merge.right[merge.rightPos]] : null;
}

export function choose(sort: SortState, choice: SortChoice): SortState {
  const merge = cloneMerge(sort.current);
  if (!merge) {
    return sort;
  }

  const next: SortState = { ...snapshot(sort), current: merge, history: [...sort.history, snapshot(sort)] };
  const source = choice === "left" ? merge.left : merge.right;
  const pos = choice === "left" ? merge.leftPos : merge.rightPos;
  merge.merged.push(source[pos]);
  merge.leftPos += choice === "left" ? 1 : 0;
  merge.rightPos += choice === "right" ? 1 : 0;
  next.pickedCount += 1;

  if (merge.leftPos === merge.left.length || merge.rightPos === merge.right.length) {
    next.groups.push([
      ...merge.merged,
      ...merge.left.slice(merge.leftPos),
      ...merge.right.slice(merge.rightPos),
    ]);
    next.current = null;
  }

  if (!isComplete(next)) {
    next.battleNo += 1;
  }

  return nextBattle(next);
}

export function undo(sort: SortState): SortState {
  const previous = sort.history[sort.history.length - 1];
  return previous ? { ...previous, history: sort.history.slice(0, -1) } : sort;
}

export const sortedSongIndexes = (sort: SortState): number[] =>
  isComplete(sort) ? sort.groups[0] : [];

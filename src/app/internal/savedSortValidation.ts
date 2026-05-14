import type { SortState } from "../../sorter";

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => Number.isInteger(item));
}

function isMerge(value: unknown, songCount: number): value is SortState["current"] {
  if (value === null) {
    return true;
  }

  if (typeof value !== "object") {
    return false;
  }

  const merge = value as Record<string, unknown>;
  return (
    isNumberArray(merge.left) &&
    isNumberArray(merge.right) &&
    isNumberArray(merge.merged) &&
    Number.isInteger(merge.leftPos) &&
    Number.isInteger(merge.rightPos) &&
    merge.left.every((index) => index >= 0 && index < songCount) &&
    merge.right.every((index) => index >= 0 && index < songCount) &&
    merge.merged.every((index) => index >= 0 && index < songCount) &&
    (merge.leftPos as number) >= 0 &&
    (merge.leftPos as number) < merge.left.length &&
    (merge.rightPos as number) >= 0 &&
    (merge.rightPos as number) < merge.right.length
  );
}

function isSnapshot(value: unknown, songCount: number): value is Omit<SortState, "history"> {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const snapshot = value as Record<string, unknown>;
  return (
    Array.isArray(snapshot.groups) &&
    snapshot.groups.every((group) => isNumberArray(group) && group.every((index) => index >= 0 && index < songCount)) &&
    isMerge(snapshot.current, songCount) &&
    Number.isInteger(snapshot.battleNo) &&
    Number.isInteger(snapshot.pickedCount) &&
    Number.isInteger(snapshot.estimatedBattles)
  );
}

export function isSortState(value: unknown, songCount: number): value is SortState {
  return (
    isSnapshot(value, songCount) &&
    Array.isArray((value as Record<string, unknown>).history) &&
    ((value as Record<string, unknown>).history as unknown[]).every((item) => isSnapshot(item, songCount))
  );
}

import type { SavedProgressKind, Screen } from "../types";

type ControlsProps = {
  screen: Screen;
  savedKind: SavedProgressKind;
  onOpenSettings(): void;
  onStart(): void;
  onLoad(): void;
  onUndo(): void;
  onCopyRanks(): void;
};

export function Controls({
  screen,
  savedKind,
  onOpenSettings,
  onStart,
  onLoad,
  onUndo,
  onCopyRanks,
}: ControlsProps) {
  return (
    <div className="button-container">
      <button className="basic-button" type="button" onClick={onOpenSettings}>
        Settings
      </button>
      {screen === "landing" ? (
        <button className="basic-button" type="button" onClick={onStart}>
          Start
        </button>
      ) : null}
      {screen === "landing" && savedKind !== "none" ? (
        <button className="basic-button" type="button" onClick={onLoad}>
          {savedKind === "complete" ? "Show Results" : "Continue"}
        </button>
      ) : null}
      {screen === "sorting" ? (
        <button className="basic-button" type="button" onClick={onUndo}>
          Undo
        </button>
      ) : null}
      {screen === "complete" ? (
        <button className="copy-button" type="button" onClick={onCopyRanks}>
          Copy ranks to clipboard
        </button>
      ) : null}
    </div>
  );
}

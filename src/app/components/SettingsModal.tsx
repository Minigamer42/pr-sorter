import type { Region, Settings } from "../types";

type SettingsModalProps = {
  open: boolean;
  settings: Settings;
  onClose(): void;
  onChange(settings: Settings): void;
};

const regions: { value: Region; label: string }[] = [
  { value: "eu", label: "Europe" },
  { value: "naw", label: "NA West" },
  { value: "nae", label: "NA East" },
];

export function SettingsModal({ open, settings, onClose, onChange }: SettingsModalProps) {
  if (!open) {
    return null;
  }

  return (
    <>
      <div className="modal-overlay" onClick={onClose} />
      <div className="modal">
        <h2>Settings</h2>
        <div className="option-group">
          <p>Format:</p>
          <button
            className={`option-button${settings.preferVideo ? " active" : ""}`}
            type="button"
            onClick={() => onChange({ ...settings, preferVideo: true })}
          >
            Video
          </button>
          <button
            className={`option-button${!settings.preferVideo ? " active" : ""}`}
            type="button"
            onClick={() => onChange({ ...settings, preferVideo: false })}
          >
            Audio
          </button>
        </div>
        <div className="option-group">
          <p>Region:</p>
          {regions.map((region) => (
            <button
              key={region.value}
              className={`option-button${settings.region === region.value ? " active" : ""}`}
              type="button"
              onClick={() => onChange({ ...settings, region: region.value })}
            >
              {region.label}
            </button>
          ))}
        </div>
        <button className="close-button" type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </>
  );
}

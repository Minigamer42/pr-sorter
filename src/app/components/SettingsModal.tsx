import type { GoogleSpreadsheetSelection, Region, Settings } from "../types";

type SettingsModalProps = {
  open: boolean;
  settings: Settings;
  googleSheetsConfigured: boolean;
  googleSheetsDisabledReason: string | null;
  googleSpreadsheetSelection: GoogleSpreadsheetSelection | null;
  isConnectingGoogleSheet: boolean;
  onClose(): void;
  onChange(settings: Settings): void;
  onChooseGoogleSheet(): void;
  onClearGoogleSheet(): void;
};

const regions: { value: Region; label: string }[] = [
  { value: "eu", label: "Europe" },
  { value: "naw", label: "NA West" },
  { value: "nae", label: "NA East" },
];

export function SettingsModal({
  open,
  settings,
  googleSheetsConfigured,
  googleSheetsDisabledReason,
  googleSpreadsheetSelection,
  isConnectingGoogleSheet,
  onClose,
  onChange,
  onChooseGoogleSheet,
  onClearGoogleSheet,
}: SettingsModalProps) {
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
        {googleSheetsConfigured ? (
          <div className="option-group">
            <p>Google Sheet:</p>
            <div className="setting-value">
              {googleSpreadsheetSelection ? googleSpreadsheetSelection.name : "No spreadsheet selected"}
            </div>
            <button
              className="option-button"
              type="button"
              onClick={onChooseGoogleSheet}
              disabled={isConnectingGoogleSheet || Boolean(googleSheetsDisabledReason)}
              title={googleSheetsDisabledReason ?? undefined}
            >
              {isConnectingGoogleSheet
                ? "Connecting..."
                : googleSheetsDisabledReason
                  ? "Google setup missing"
                  : googleSpreadsheetSelection
                    ? "Change Sheet"
                    : "Choose Sheet"}
            </button>
            {googleSpreadsheetSelection ? (
              <button className="option-button" type="button" onClick={onClearGoogleSheet}>
                Forget Sheet
              </button>
            ) : null}
          </div>
        ) : null}
        <button className="close-button" type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </>
  );
}

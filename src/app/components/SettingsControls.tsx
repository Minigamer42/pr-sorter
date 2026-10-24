import { useEffect, useState, type ReactNode } from 'react';
import type { MediaFormat, Region, Settings } from '../types';

const mediaFormats: { value: MediaFormat; label: string }[] = [
    { value: 'video', label: 'Video' },
    { value: 'audio', label: 'Audio' },
    { value: 'full', label: 'Full songs' },
];

const regions: { value: Region; label: string }[] = [
    { value: 'eu', label: 'Europe' },
    { value: 'naw', label: 'NA West' },
    { value: 'nae', label: 'NA East' },
];

export function SettingsWindow({ open, onClose, children }: { open: boolean; onClose(): void; children: ReactNode }) {
    if (!open) return null;
    return (
        <>
            <div className="modal-overlay" onClick={onClose}/>
            <div className="modal settings-modal" role="dialog" aria-modal="true" aria-label="Settings">
                <h2>Settings</h2>
                {children}
                <button className="close-button" type="button" onClick={onClose}>Close</button>
            </div>
        </>
    );
}

export function PlaybackSettings({ settings, onChange }: { settings: Settings; onChange(settings: Settings): void }) {
    return (
        <>
            <div className="option-group">
                <p>Format:</p>
                {mediaFormats.map((format) => (
                    <button key={format.value} className={`option-button${settings.mediaFormat === format.value ? ' active' : ''}`} type="button"
                        aria-pressed={settings.mediaFormat === format.value} onClick={() => onChange({ ...settings, mediaFormat: format.value })}>
                        {format.label}
                    </button>
                ))}
            </div>
            <div className="option-group">
                <p>Region:</p>
                {regions.map((region) => (
                    <button key={region.value} className={`option-button${settings.region === region.value ? ' active' : ''}`} type="button"
                        aria-pressed={settings.region === region.value} onClick={() => onChange({ ...settings, region: region.value })}>
                        {region.label}
                    </button>
                ))}
            </div>
        </>
    );
}

export function SettingsHelp({ label, text }: { label: string; text: string }) {
    return <span className="help-icon" data-tooltip={text} aria-label={`${label} help`} tabIndex={0}>?</span>;
}

export function ScoreSetting({ label, help, value, step = '0.01', onChange }: {
    label: string;
    help: string;
    value: number;
    step?: string;
    onChange(value: number): void;
}) {
    const [draft, setDraft] = useState(String(value));

    useEffect(() => {
        setDraft((current) => current.trim() !== '' && Number(current) === value ? current : String(value));
    }, [value]);

    return (
        <div className="option-group">
            <p>{label}:<SettingsHelp label={label} text={help}/></p>
            <input
                className="setting-number-input"
                aria-label={label}
                type="number"
                min="0"
                max="10"
                step={step}
                value={draft}
                onChange={(event) => setDraft(event.currentTarget.value)}
                onBlur={(event) => {
                    const next = event.currentTarget.valueAsNumber;
                    if (Number.isFinite(next) && next >= 0 && next <= 10 && next !== value) onChange(next);
                }}
                onKeyDown={(event) => {
                    if (event.key === 'Enter') event.currentTarget.blur();
                }}
            />
        </div>
    );
}

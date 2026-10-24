import type { Settings } from '../types';
import { PlaybackSettings, ScoreSetting, SettingsWindow } from './SettingsControls';

type LibrarySettingsModalProps = {
    open: boolean;
    settings: Settings;
    scoreThreshold: number;
    onClose(): void;
    onSettingsChange(settings: Settings): void;
    onThresholdChange(threshold: number): void;
};

export function LibrarySettingsModal({ open, settings, scoreThreshold, onClose, onSettingsChange, onThresholdChange }: LibrarySettingsModalProps) {
    return (
        <SettingsWindow open={open} onClose={onClose}>
            <PlaybackSettings settings={settings} onChange={onSettingsChange}/>
            <ScoreSetting
                label="Score ≥"
                help="Includes songs with scores greater than or equal to this value, from 0 to 10. Decimals such as 8.25 are supported. Saved ratings across your sorters are found automatically in this browser. When a recording appears in several sorters, its highest saved score is used. Edit ratings in their original sorter."
                value={scoreThreshold}
                step="any"
                onChange={onThresholdChange}
            />
        </SettingsWindow>
    );
}

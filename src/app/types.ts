export type AppConfig = {
    localStoragePrefix: string;
    title: string;
    description: string;
    tags?: string[];
    hide?: boolean;
    deadline?: Date;
    fallbackAnimeName?: string;
    rankSupported?: boolean;
    googleSheets?: GoogleSheetsConfig;
};

export type GoogleSheetsConfig = {
    clientId: string;
    appId: string;
    idColumnHeader?: string;
    rankColumnHeader?: string;
    scoreColumnHeader?: string;
};

export type GoogleSpreadsheetSelection = {
    id: string;
    name: string;
};

export type Region = 'eu' | 'naw' | 'nae';

export type MediaFormat = 'video' | 'audio' | 'full';

export type SorterAutoPlayMode = 'off' | 'left' | 'right' | 'both' | 'picked' | 'higher-score';

export type Settings = {
    mediaFormat: MediaFormat;
    region: Region;
    sorterAutoPlayMode: SorterAutoPlayMode;
    autoSkipScoreDifference: number;
};

export type Screen = 'landing' | 'sorting' | 'complete' | 'playlist';

export type SavedProgressKind = 'none' | 'in-progress' | 'complete';

export type SongScoresById = Record<number, string>;

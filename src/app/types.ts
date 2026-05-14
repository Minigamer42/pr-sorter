export type AppConfig = {
  localStoragePrefix: string;
  title: string;
  description: string;
  googleSheets?: GoogleSheetsConfig;
};

export type GoogleSheetsConfig = {
  clientId: string;
  appId: string;
  rankColumnHeader: string;
};

export type GoogleSpreadsheetSelection = {
  id: string;
  name: string;
};

export type Region = "eu" | "naw" | "nae";

export type Settings = {
  preferVideo: boolean;
  region: Region;
};

export type Screen = "landing" | "sorting" | "complete";

export type SavedProgressKind = "none" | "in-progress" | "complete";

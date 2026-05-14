export type AppConfig = {
  localStoragePrefix: string;
  title: string;
  description: string;
};

export type Region = "eu" | "naw" | "nae";

export type Settings = {
  preferVideo: boolean;
  region: Region;
};

export type Screen = "landing" | "sorting" | "complete";

export type SavedProgressKind = "none" | "in-progress" | "complete";

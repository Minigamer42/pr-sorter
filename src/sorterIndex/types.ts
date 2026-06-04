export type SorterIndexEntry = {
  slug: string;
  title: string;
  description: string;
  tags?: string[];
  localStoragePrefix?: string;
  deadline?: string;
  url?: string;
  iconUrl?: string;
  sourceTitle?: string;
  sourceIndexUrl?: string;
  sourceSlug?: string;
  hide?: boolean;
};

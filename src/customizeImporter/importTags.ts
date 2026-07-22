export const IMPORT_TAGS = ['Artist', 'Franchise', 'Nominations', 'Seasonal'] as const;

export type ImportTag = (typeof IMPORT_TAGS)[number];

export function isImportTag(value: unknown): value is ImportTag {
    return typeof value === 'string' && IMPORT_TAGS.some((tag) => tag === value);
}

import { config } from "../customize/config.js";
import type { AppConfig } from "../src/app/types.js";

export async function loadCustomizeConfig(): Promise<AppConfig> {
  return config;
}

export function serializedDeadline(config: AppConfig): string | undefined {
  if (config.deadline === undefined) {
    return undefined;
  }

  if (!(config.deadline instanceof Date) || Number.isNaN(config.deadline.getTime())) {
    throw new Error("customize/config.ts deadline must be a valid Date.");
  }

  return config.deadline.toISOString();
}

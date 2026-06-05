import { z } from "zod";

export const preferencesSchema = z.object({
  semester: z.string().optional(),
  openFolders: z.record(z.string(), z.array(z.string())).optional(),
});
export type Preferences = z.infer<typeof preferencesSchema>;

export const COOKIE_NAME = "politeshop_prefs";
const COOKIE_MAX_AGE_MS = 31536000 * 1000;

export function parsePrefsCookie(raw: string | undefined): Preferences {
  if (!raw) return {};
  try {
    return preferencesSchema.parse(JSON.parse(raw));
  } catch {
    return {};
  }
}

export async function getPreferences(): Promise<Preferences> {
  const cookie = await cookieStore.get(COOKIE_NAME);
  if (cookie?.value) {
    try {
      return preferencesSchema.parse(JSON.parse(cookie.value));
    } catch {
      return {};
    }
  }
  return {};
}

export async function setPreference(key: "semester", value: string | undefined): Promise<void>;
export async function setPreference(key: ["openFolders", string], value: string[]): Promise<void>;
export async function setPreference(key: "openFolders", value: Record<string, string[]> | undefined): Promise<void>;
export async function setPreference(
  key: "semester" | "openFolders" | ["openFolders", string],
  value: string | undefined | Record<string, string[]> | undefined | string[],
): Promise<void> {
  const prefs = await getPreferences();

  if (Array.isArray(key)) {
    const folderIds = value as string[];
    prefs.openFolders ||= {};

    if (folderIds.length > 0) {
      prefs.openFolders[key[1]] = folderIds;
    } else {
      delete prefs.openFolders[key[1]];
    }
  } else {
    (prefs as Record<string, any>)[key] = value;
  }

  await cookieStore.set({
    name: COOKIE_NAME,
    value: JSON.stringify(prefs),
    sameSite: "none",
    expires: Date.now() + COOKIE_MAX_AGE_MS,
  });
}

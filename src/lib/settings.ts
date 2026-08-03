import { prisma } from "@/lib/prisma";

export const SETTING_KEYS = {
  platformFeePct: "PLATFORM_FEE_PCT",
  dispatchWindowSeconds: "DISPATCH_FALLBACK_WINDOW_SECONDS",
} as const;

const DEFAULTS: Record<string, string> = {
  [SETTING_KEYS.platformFeePct]: process.env.PLATFORM_FEE_PCT ?? "15",
  [SETTING_KEYS.dispatchWindowSeconds]:
    process.env.DISPATCH_FALLBACK_WINDOW_SECONDS ?? "300",
};

async function getSetting(key: string): Promise<string> {
  const row = await prisma.platformSetting.findUnique({ where: { key } });
  return row?.value ?? DEFAULTS[key] ?? "";
}

export async function setSetting(key: string, value: string): Promise<void> {
  await prisma.platformSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

export async function getPlatformFeePct(): Promise<number> {
  return Number(await getSetting(SETTING_KEYS.platformFeePct));
}

export async function getDispatchWindowSeconds(): Promise<number> {
  return Number(await getSetting(SETTING_KEYS.dispatchWindowSeconds));
}

export async function getAllSettings() {
  return {
    platformFeePct: await getPlatformFeePct(),
    dispatchWindowSeconds: await getDispatchWindowSeconds(),
  };
}

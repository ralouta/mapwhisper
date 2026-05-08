import { translateTexts } from "./services";

export const EN_MESSAGES = {
  appMainAria: "Voice assistant for geographic descriptions",
  micAria: "Tap to speak",
  micTitle: "Tap to speak",
  toggleMapShowText: "Show Map",
  toggleMapShowAria: "Show map",
  toggleMapHideText: "Hide Map",
  toggleMapHideAria: "Hide map",
  languageLabel: "Speech and response language:",
  languageSelectAria: "Select language",
  statusInitialPrompt: "Press the button and ask about a location.",
  statusReady: "Ready. Press the button and ask about your surroundings.",
  statusReadyShort: "Ready.",
  statusSigningIn: "Signing in...",
  statusSignInRedirecting: "Sign-in required. Redirecting...",
  statusAcquiringLocation: "Acquiring your location...",
  statusGeoUnsupported: "Geolocation is not supported by your browser.",
  statusLocationDenied: "Location access denied. Please allow location in browser settings.",
  statusLocationUnavailable: "Location unavailable. Please try again.",
  statusLocationTimeout: "Location request timed out. Please try again.",
  statusLocationUnknown: "Could not get your location.",
  statusTranslating: "Translating...",
  statusFindingLocation: "Finding {location}...",
  statusFoundLocation: "Found: {address}. Capturing map...",
  statusWaitingForLocation: "Still waiting for your location. Please try again in a moment.",
  statusCapturingMap: "Capturing map view...",
  statusMapNotReady: "Map is not ready. Please try again.",
  statusTakingScreenshot: "Taking screenshot...",
  statusAnalyzingArea: "Analyzing the area...",
  statusErrorPrefix: "Error: {message}",
  statusListening: "Listening...",
  statusCouldNotUnderstand: "Could not understand. Try again.",
  statusYouSaid: "You said: \"{transcript}\"",
  statusMicDenied: "Microphone access denied. Please allow microphone in browser settings.",
  statusVoiceError: "Voice error. Try again.",
  statusNoSpeechDetected: "No speech detected. Tap and try again.",
  statusVoiceUnsupported: "Voice input is not supported in this browser.",
  statusMicSettling: "Microphone is still settling. Tap once more.",
  statusLocationNotFound: "Could not find that location. Try being more specific.",
  statusLanguageSet: "Language set to: {language}",
  statusLanguageLoadFallback: "Using English UI. Could not load translations for this language.",
} as const;

export type MessageKey = keyof typeof EN_MESSAGES;
export type MessageCatalog = Record<MessageKey, string>;

const catalogCache = new Map<string, MessageCatalog>();
catalogCache.set("en", { ...EN_MESSAGES });

let active: MessageCatalog = { ...EN_MESSAGES };
let localeVersion = 0;

export function normalizeLocale(locale: string): string {
  const raw = (locale || "en-US").replace(/_/g, "-").trim();
  const parts = raw.split("-").filter(Boolean);
  if (parts.length === 0) return "en-US";
  const lang = parts[0].toLowerCase();
  const region = parts[1] ? parts[1].toUpperCase() : "";
  return region ? lang + "-" + region : lang;
}

export function toCultureCode(locale: string): string {
  return normalizeLocale(locale).split("-")[0] || "en";
}

export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  const template = active[key] ?? EN_MESSAGES[key];
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k: string) =>
    vars[k] === undefined ? "" : String(vars[k]),
  );
}

async function tryTranslate(
  keys: MessageKey[],
  texts: string[],
  lang: string,
): Promise<MessageCatalog | null> {
  try {
    const translated = await translateTexts(texts, lang, "en");
    const catalog = { ...EN_MESSAGES } as MessageCatalog;
    keys.forEach((key, i) => {
      if (translated[i]) catalog[key] = translated[i];
    });
    catalogCache.set(lang, catalog);
    return catalog;
  } catch {
    return null;
  }
}

async function loadCatalog(locale: string): Promise<MessageCatalog | null> {
  const normalized = normalizeLocale(locale);
  const base = toCultureCode(normalized);
  if (base === "en") return { ...EN_MESSAGES };

  const cached = catalogCache.get(normalized) ?? catalogCache.get(base);
  if (cached) return cached;

  const keys = Object.keys(EN_MESSAGES) as MessageKey[];
  const texts = keys.map((k) => EN_MESSAGES[k]);

  return (
    (await tryTranslate(keys, texts, normalized)) ??
    (normalized !== base ? tryTranslate(keys, texts, base) : null)
  );
}

export async function activateCatalog(locale: string): Promise<boolean> {
  const version = ++localeVersion;
  const catalog = await loadCatalog(locale);
  if (version !== localeVersion) return true;
  active = catalog ?? { ...EN_MESSAGES };
  return catalog !== null;
}

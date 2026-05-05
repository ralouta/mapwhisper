import "@arcgis/map-components/components/arcgis-map";
import "@arcgis/map-components/components/arcgis-zoom";
import esriConfig from "@arcgis/core/config";
import esriId from "@arcgis/core/identity/IdentityManager";
import OAuthInfo from "@arcgis/core/identity/OAuthInfo";
import type MapView from "@arcgis/core/views/MapView";

import { OAUTH_APP_ID, PORTAL_URL, APP_TITLE } from "./config";
import {
  setCredential,
  translateText,
  geocodeLocation,
  analyzeMapScreenshot,
} from "./services";
import {
  EN_MESSAGES,
  type MessageKey,
  normalizeLocale,
  toCultureCode,
  t,
  activateCatalog,
} from "./i18n";
import { unlockSpeech, speakText, stopSpeech } from "./speak";
import {
  isSupported,
  isListening,
  setupRecognition,
  setRecognitionLang,
  tryStart,
} from "./recognition";

// == DOM refs ================================================================

const mapEl = document.getElementById("main-map") as HTMLElement & {
  view?: MapView;
};
const micBtn = document.getElementById("mic-btn") as HTMLButtonElement;
const toggleMapBtn = document.getElementById("toggle-map-btn") as HTMLButtonElement;
const statusEl = document.getElementById("status") as HTMLElement;
const titleEl = document.getElementById("app-title") as HTMLElement;
const voiceUiEl = document.getElementById("voice-ui") as HTMLElement;
const langSettingsEl = document.getElementById("lang-settings") as HTMLDivElement;
const langSelectEl = document.getElementById("lang-select") as HTMLSelectElement;
const langLabelEl = document.getElementById("lang-label") as HTMLLabelElement;

const urlParams = new URLSearchParams(window.location.search);
const isEditMode = urlParams.get("mode") === "edit";

// == App state ===============================================================

let mapVisible = false;
let mapViewReady = false;
let userLocation: { longitude: number; latitude: number } | null = null;
let isProcessing = false;
let activeSpeechLang = normalizeLocale(
  urlParams.get("speechLang") ||
    localStorage.getItem("geovoice_lang") ||
    navigator.language ||
    "en-US",
);
let lastStatusKey: MessageKey = "statusInitialPrompt";

// == Status ==================================================================

function setStatus(key: MessageKey, vars?: Record<string, string | number>): void {
  lastStatusKey = key;
  statusEl.textContent = t(key, vars);
}

function setStatusText(text: string): void {
  statusEl.textContent = text;
}

// == UI rendering ============================================================

function applyStaticText(): void {
  titleEl.textContent = APP_TITLE;
  document.title = APP_TITLE;
  voiceUiEl.setAttribute("aria-label", t("appMainAria"));
  micBtn.setAttribute("aria-label", t("micAria"));
  micBtn.title = t("micTitle");
  langLabelEl.textContent = t("languageLabel");
  langSelectEl.setAttribute("aria-label", t("languageSelectAria"));
  toggleMapBtn.textContent = mapVisible ? t("toggleMapHideText") : t("toggleMapShowText");
  toggleMapBtn.setAttribute(
    "aria-label",
    mapVisible ? t("toggleMapHideAria") : t("toggleMapShowAria"),
  );
  if (!isProcessing && !isListening()) setStatus(lastStatusKey);
}

function setMapVisible(visible: boolean): void {
  mapVisible = visible;
  mapEl.classList.replace(
    visible ? "map-hidden" : "map-visible",
    visible ? "map-visible" : "map-hidden",
  );
  document.body.classList.toggle("map-active", visible);
  toggleMapBtn.textContent = visible ? t("toggleMapHideText") : t("toggleMapShowText");
  toggleMapBtn.setAttribute(
    "aria-label",
    visible ? t("toggleMapHideAria") : t("toggleMapShowAria"),
  );
}

function syncLangSelect(): void {
  const exact = langSelectEl.querySelector(
    `option[value="${activeSpeechLang}"]`,
  ) as HTMLOptionElement | null;
  if (exact) { exact.selected = true; return; }
  const base = toCultureCode(activeSpeechLang);
  const match = Array.from(langSelectEl.options).find(
    (o) => toCultureCode(o.value) === base,
  );
  if (match) {
    match.selected = true;
    activeSpeechLang = normalizeLocale(match.value);
  }
}

// == Map helpers =============================================================

async function centerMapOn(lng: number, lat: number, zoom = 16): Promise<void> {
  if (!mapViewReady || !mapEl.view) return;
  try {
    await mapEl.view.goTo({ center: [lng, lat], zoom }, { animate: false });
  } catch {
    // interrupted goTo — safe to ignore
  }
}

// == Geolocation =============================================================

function watchUserLocation(): void {
  if (!("geolocation" in navigator)) {
    setStatus("statusGeoUnsupported");
    return;
  }
  navigator.geolocation.watchPosition(
    (pos) => {
      userLocation = { longitude: pos.coords.longitude, latitude: pos.coords.latitude };
      void centerMapOn(userLocation.longitude, userLocation.latitude);
      if (!isProcessing) micBtn.disabled = false;
      if (lastStatusKey === "statusAcquiringLocation") setStatus("statusReady");
    },
    (err) => {
      if (err.code === err.PERMISSION_DENIED) setStatus("statusLocationDenied");
      else if (err.code === err.POSITION_UNAVAILABLE) setStatus("statusLocationUnavailable");
      else if (err.code === err.TIMEOUT) setStatus("statusLocationTimeout");
      else setStatus("statusLocationUnknown");
    },
    { enableHighAccuracy: true, maximumAge: 30_000, timeout: 15_000 },
  );
}

// == Intent parsing ==========================================================

const LANGUAGE_MAP: Record<string, string> = {
  arabic: "ar", dutch: "nl", french: "fr", german: "de",
  spanish: "es", italian: "it", portuguese: "pt", turkish: "tr",
  japanese: "ja", chinese: "zh", korean: "ko", hindi: "hi",
  russian: "ru", swedish: "sv", norwegian: "no", danish: "da",
  polish: "pl", czech: "cs", greek: "el", hebrew: "he",
  thai: "th", vietnamese: "vi", indonesian: "id", malay: "ms",
};

const SELF_LOCATION_KEYWORDS = [
  "around me", "near me", "my location", "where i am",
  "my surroundings", "my area", "this area", "here",
];

interface ParsedIntent {
  targetLocation: string | null;
  question: string;
  responseLanguage: string | null;
}

function parseIntent(transcript: string): ParsedIntent {
  const lower = transcript.toLowerCase();
  const langMatch = lower.match(
    /(?:in|reply in|respond in|answer in|speak in|say it in|tell me in)\s+(\w+)\s*$/,
  );
  const responseLanguage =
    langMatch && LANGUAGE_MAP[langMatch[1]] ? LANGUAGE_MAP[langMatch[1]] : null;

  const isSelf = SELF_LOCATION_KEYWORDS.some((kw) => lower.includes(kw));
  let targetLocation: string | null = null;

  if (!isSelf) {
    let cleaned = langMatch
      ? transcript.slice(0, lower.lastIndexOf(langMatch[0])).trim()
      : transcript;
    cleaned = cleaned
      .replace(
        /^(describe|tell me about|what's around|what is around|what's near|what is near|show me|what does)\s*/i,
        "",
      )
      .trim()
      .replace(/\s*(look like|looks like)\s*$/i, "")
      .trim();
    if (cleaned.length > 2 && !SELF_LOCATION_KEYWORDS.some((kw) => cleaned.toLowerCase() === kw)) {
      targetLocation = cleaned;
    }
  }

  return { targetLocation, question: transcript, responseLanguage };
}

// == Question flow ===========================================================

async function handleUserQuestion(question: string): Promise<void> {
  if (isProcessing) return;
  isProcessing = true;
  micBtn.disabled = true;

  try {
    const culture = toCultureCode(activeSpeechLang);
    let forIntent = question;

    if (culture !== "en") {
      setStatus("statusTranslating");
      forIntent = await translateText(question, "en", culture);
    }

    let intent = parseIntent(forIntent);
    if (!intent.responseLanguage) intent = { ...intent, responseLanguage: culture };

    let lng = 0;
    let lat = 0;

    if (intent.targetLocation) {
      setStatus("statusFindingLocation", { location: intent.targetLocation });
      const geo = await geocodeLocation(intent.targetLocation);
      if (!geo) { setStatus("statusLocationNotFound"); return; }
      lng = geo.x;
      lat = geo.y;
      setStatus("statusFoundLocation", { address: geo.matchedAddress });
    } else {
      if (!userLocation) { setStatus("statusWaitingForLocation"); return; }
      lng = userLocation.longitude;
      lat = userLocation.latitude;
      setStatus("statusCapturingMap");
    }

    await centerMapOn(lng, lat);
    const view = mapEl.view;
    if (!view) { setStatus("statusMapNotReady"); return; }
    await view.when();
    await new Promise<void>((resolve) => setTimeout(resolve, 1500));

    setStatus("statusTakingScreenshot");
    const shot = await view.takeScreenshot({ format: "jpg", quality: 80 });

    setStatus("statusAnalyzingArea");
    let description = await analyzeMapScreenshot(shot.dataUrl, forIntent);

    if (intent.responseLanguage && intent.responseLanguage !== "en") {
      setStatus("statusTranslating");
      description = await translateText(description, intent.responseLanguage, "en");
    }

    setStatusText(description);
    speakText(description, intent.responseLanguage);
  } catch (err: unknown) {
    setStatus("statusErrorPrefix", {
      message: err instanceof Error ? err.message : EN_MESSAGES.statusErrorPrefix,
    });
  } finally {
    isProcessing = false;
    micBtn.disabled = false;
  }
}

// == Event wiring ============================================================

mapEl.addEventListener("arcgisViewReadyChange", () => { mapViewReady = true; });

toggleMapBtn.addEventListener("click", () => setMapVisible(!mapVisible));

micBtn.addEventListener("click", () => {
  if (window.speechSynthesis?.speaking || window.speechSynthesis?.pending) {
    stopSpeech();
    setStatus("statusReadyShort");
  }
  unlockSpeech();
  const result = tryStart();
  if (result === "error") setStatus("statusMicSettling");
});

if (isEditMode) {
  toggleMapBtn.hidden = false;
  langSettingsEl.hidden = false;
  syncLangSelect();

  langSelectEl.addEventListener("change", async () => {
    const chosen = normalizeLocale(langSelectEl.value);
    localStorage.setItem("geovoice_lang", chosen);
    activeSpeechLang = chosen;
    setRecognitionLang(chosen);
    const ok = await activateCatalog(chosen);
    applyStaticText();
    setStatus(ok ? "statusLanguageSet" : "statusLanguageLoadFallback", {
      language: langSelectEl.selectedOptions[0]?.text ?? chosen,
    });
  });
}

// == Voice recognition =======================================================

micBtn.disabled = true;

if (isSupported()) {
  setupRecognition(activeSpeechLang, {
    onStart() {
      micBtn.classList.add("listening");
      setStatus("statusListening");
    },
    onEnd() {
      micBtn.classList.remove("listening");
    },
    onResult(transcript: string) {
      setStatusText(t("statusYouSaid", { transcript }));
      void handleUserQuestion(transcript);
    },
    onNoSpeech() {
      setStatus("statusCouldNotUnderstand");
    },
    onError(error: string) {
      if (error === "not-allowed") setStatus("statusMicDenied");
      else if (error === "no-speech") setStatus("statusNoSpeechDetected");
      else if (error !== "aborted") setStatus("statusVoiceError");
    },
  });
} else {
  setStatus("statusVoiceUnsupported");
}

// == Init ====================================================================

esriConfig.portalUrl = PORTAL_URL;
esriId.registerOAuthInfos([
  new OAuthInfo({ appId: OAUTH_APP_ID, portalUrl: PORTAL_URL, popup: false }),
]);

async function init(): Promise<void> {
  applyStaticText();
  setStatus("statusSigningIn");

  try {
    const cred = await esriId
      .checkSignInStatus(PORTAL_URL + "/sharing")
      .catch(() => esriId.getCredential(PORTAL_URL + "/sharing"));

    setCredential(cred);
    await activateCatalog(activeSpeechLang);
    applyStaticText();
    setStatus("statusAcquiringLocation");
    watchUserLocation();
  } catch {
    setStatus("statusSignInRedirecting");
  }
}

void init();

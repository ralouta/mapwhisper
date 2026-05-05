import { normalizeLocale } from "./i18n";

// Chrome pauses speechSynthesis silently after ~15s of uninterrupted output.
// A periodic pause+resume keeps the pipeline alive.
let keepAliveTimer: ReturnType<typeof setInterval> | null = null;

function startKeepAlive(): void {
  if (keepAliveTimer !== null) return;
  keepAliveTimer = setInterval(() => {
    if (window.speechSynthesis?.speaking) {
      window.speechSynthesis.pause();
      window.speechSynthesis.resume();
    }
  }, 10_000);
}

function stopKeepAlive(): void {
  if (keepAliveTimer === null) return;
  clearInterval(keepAliveTimer);
  keepAliveTimer = null;
}

// ── Voice resolution ──────────────────────────────────────────────────────────

function pickVoice(
  voices: SpeechSynthesisVoice[],
  locale: string,
): SpeechSynthesisVoice | null {
  const norm = normalizeLocale(locale).toLowerCase();
  const base = norm.split("-")[0];
  return (
    voices.find((v) => v.lang.toLowerCase() === norm) ??
    voices.find((v) => v.lang.toLowerCase().startsWith(base)) ??
    null
  );
}

// Returns voices, waiting for Chrome's async voiceschanged if needed.
function getVoices(): Promise<SpeechSynthesisVoice[]> {
  const ss = window.speechSynthesis;
  if (!ss) return Promise.resolve([]);
  const immediate = ss.getVoices();
  if (immediate.length > 0) return Promise.resolve(immediate);
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(ss.getVoices()), 2000);
    ss.addEventListener(
      "voiceschanged",
      () => {
        clearTimeout(timeout);
        resolve(ss.getVoices());
      },
      { once: true },
    );
  });
}

// ── Unlock (call from a user-gesture handler before first speak) ─────────────

let unlocked = false;

export function unlockSpeech(): void {
  const ss = window.speechSynthesis;
  if (!ss || unlocked) return;
  ss.resume();
  const warmup = new SpeechSynthesisUtterance(" ");
  warmup.volume = 0;
  warmup.rate = 1;
  const markUnlocked = (): void => {
    unlocked = true;
  };
  warmup.onstart = markUnlocked;
  warmup.onend = markUnlocked;
  warmup.onerror = markUnlocked;
  ss.speak(warmup);
  // Safety net if browser never fires the events.
  setTimeout(markUnlocked, 500);
}

// ── Queue ─────────────────────────────────────────────────────────────────────

interface SpeechItem {
  text: string;
  lang: string;
  rate: number;
  attempt: number; // 0 = with matched voice, 1 = browser-default fallback
}

let queue: SpeechItem[] = [];
let sessionId = 0;
let queueRunning = false;

async function drainQueue(session: number): Promise<void> {
  if (queueRunning) return;
  queueRunning = true;
  startKeepAlive();
  try {
    while (queue.length > 0 && session === sessionId) {
      const item = queue.shift()!;
      await speakItem(item, session);
    }
  } finally {
    if (session === sessionId) {
      queueRunning = false;
      stopKeepAlive();
    }
  }
}

async function speakItem(item: SpeechItem, session: number): Promise<void> {
  const ss = window.speechSynthesis;
  if (!ss) return;

  const voices = await getVoices();

  await new Promise<void>((resolve) => {
    const utterance = new SpeechSynthesisUtterance(item.text);
    utterance.lang = item.lang;
    utterance.rate = item.rate;
    utterance.volume = 1;

    // Attempt 0: use best-matching voice.
    // Attempt 1: let browser pick (avoids "synthesis-failed" on some Chrome builds).
    if (item.attempt === 0) {
      const voice = pickVoice(voices, item.lang);
      if (voice) utterance.voice = voice;
    }

    let settled = false;
    const settle = (): void => {
      if (settled) return;
      settled = true;
      resolve();
    };

    // Hard timeout so a permanently-stuck utterance never blocks the queue.
    const timeout = setTimeout(settle, 30_000);

    utterance.onend = () => {
      clearTimeout(timeout);
      settle();
    };

    utterance.onerror = (ev: SpeechSynthesisErrorEvent) => {
      clearTimeout(timeout);
      if (
        item.attempt === 0 &&
        ev.error !== "not-allowed" &&
        ev.error !== "interrupted"
      ) {
        // Retry once without an explicit voice selection.
        if (session === sessionId) {
          queue.unshift({ ...item, attempt: 1 });
        }
      }
      settle();
    };

    ss.resume();
    ss.speak(utterance);
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

function detectLang(text: string): string {
  const arabicChars = (text.match(/[\u0600-\u06FF]/g) ?? []).length;
  return arabicChars > text.length * 0.3 ? "ar" : "en";
}

export function speakText(text: string, lang?: string | null): void {
  const ss = window.speechSynthesis;
  if (!ss || !text.trim()) return;

  const resolved = normalizeLocale(lang ?? detectLang(text));
  const currentSession = ++sessionId;
  queue = [];
  queueRunning = false;

  const enqueue = (): void => {
    if (currentSession !== sessionId) return;
    ss.resume();
    queue = [{ text, lang: resolved, rate: 0.9, attempt: 0 }];
    void drainQueue(currentSession);
  };

  if (ss.speaking || ss.pending) {
    ss.cancel();
    // Chrome needs one tick after cancel() before accepting a new speak().
    setTimeout(enqueue, 50);
  } else {
    enqueue();
  }
}

export function stopSpeech(): void {
  sessionId++;
  queue = [];
  queueRunning = false;
  stopKeepAlive();
  window.speechSynthesis?.cancel();
}

// Debug mode: expose on window for console access
export function enableDebugSpeech(): void {
  (window as any).__debugSpeech = true;
  console.log("Speech debug mode enabled. Watch console for utterance events.");
}

function debugLog(msg: string, data?: unknown): void {
  if ((window as any).__debugSpeech) {
    console.log(`[Speech] ${msg}`, data ?? "");
  }
}

export interface RecognitionCallbacks {
  onStart(): void;
  onEnd(): void;
  onResult(transcript: string): void;
  onNoSpeech(): void;
  onError(error: string): void;
}

const SpeechRecognitionCtor =
  (window as Window & { SpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition ||
  (window as Window & { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition;

let recognition: SpeechRecognition | null = null;
let listening = false;
let lastStartAt = 0;

export function isSupported(): boolean {
  return Boolean(SpeechRecognitionCtor);
}

export function isListening(): boolean {
  return listening;
}

export function setupRecognition(lang: string, cbs: RecognitionCallbacks): void {
  if (!SpeechRecognitionCtor) return;
  recognition = new SpeechRecognitionCtor();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = lang;

  recognition.addEventListener("start", () => {
    listening = true;
    cbs.onStart();
  });

  recognition.addEventListener("end", () => {
    listening = false;
    cbs.onEnd();
  });

  recognition.addEventListener("result", (event: SpeechRecognitionEvent) => {
    const transcript = event.results[0]?.[0]?.transcript ?? "";
    if (transcript) {
      cbs.onResult(transcript);
    } else {
      cbs.onNoSpeech();
    }
  });

  recognition.addEventListener(
    "error",
    (event: SpeechRecognitionErrorEvent) => {
      listening = false;
      cbs.onError(event.error);
    },
  );
}

export function setRecognitionLang(lang: string): void {
  if (recognition) recognition.lang = lang;
}

export type TryStartResult = "started" | "stopped" | "debounced" | "error";

export function tryStart(): TryStartResult {
  if (!recognition) return "error";
  if (listening) {
    recognition.stop();
    return "stopped";
  }
  const now = Date.now();
  if (now - lastStartAt < 350) return "debounced";
  lastStartAt = now;
  try {
    recognition.start();
    return "started";
  } catch {
    return "error";
  }
}

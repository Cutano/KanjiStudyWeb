import { catalog } from "../data/catalog";
import { getAiSpeech } from "./ai-tts";
import { getTtsSettings } from "./tts-settings";
import { speakJapanese } from "./speech";

export type PronunciationSource = "recording" | "ai" | "browser";
type Pronunciation =
  { source: "recording" | "ai"; blob: Blob } | { source: "browser" };

/** Missing recordings fall through; a playback or configured API error does not. */
export async function loadPronunciation(
  text: string,
  resource?: string,
): Promise<Pronunciation> {
  if (resource) {
    try {
      const blob = await catalog.getAudioBlob(resource.split("|")[0]);
      if (blob.size) return { source: "recording", blob };
    } catch {
      // An absent catalog clip can still be pronounced by the selected voice.
    }
  }
  const settings = await getTtsSettings();
  if (settings.enabled && settings.apiKey)
    return { source: "ai", blob: await getAiSpeech(text, settings) };
  return { source: "browser" };
}

let sequence = 0;
let stopCurrent: (() => void) | undefined;

/** Only the latest user request may start playback, even when generation is slow. */
export async function playPronunciation({
  text,
  resource,
  signal,
  onSource,
}: {
  text: string;
  resource?: string;
  signal: AbortSignal;
  onSource: (source: PronunciationSource) => void;
}): Promise<void> {
  if (signal.aborted) return;
  const request = ++sequence;
  stopCurrent?.();
  const audio = new Audio();
  const cancellation = new AbortController();
  let url: string | undefined;
  const stop = () => {
    cancellation.abort();
    audio.pause();
    audio.removeAttribute("src");
    if (url) URL.revokeObjectURL(url);
    url = undefined;
    signal.removeEventListener("abort", stop);
    if (stopCurrent === stop) {
      stopCurrent = undefined;
      window.speechSynthesis?.cancel();
    }
  };
  stopCurrent = stop;
  signal.addEventListener("abort", stop, { once: true });
  try {
    const pronunciation = await loadPronunciation(text, resource);
    if (cancellation.signal.aborted || request !== sequence) return;
    onSource(pronunciation.source);
    if (pronunciation.source === "browser") {
      await speakJapanese(text, cancellation.signal);
    } else {
      url = URL.createObjectURL(pronunciation.blob);
      audio.src = url;
      audio.addEventListener("ended", stop, { once: true });
      audio.addEventListener("error", stop, { once: true });
      await audio.play();
    }
  } catch (error) {
    stop();
    if (!signal.aborted && request === sequence) throw error;
  }
}

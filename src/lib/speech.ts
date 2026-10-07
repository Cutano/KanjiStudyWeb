/** Prefer installed Japanese voices so the browser fallback also works offline. */
export function localJapaneseVoice(): SpeechSynthesisVoice | undefined {
  return window.speechSynthesis
    ?.getVoices()
    .find((voice) => voice.localService && /^ja(?:-|_)/i.test(voice.lang));
}

async function waitForVoices(signal: AbortSignal): Promise<void> {
  if (speechSynthesis.getVoices().length || signal.aborted) return;
  await new Promise<void>((resolve) => {
    const finish = () => {
      clearTimeout(timeout);
      speechSynthesis.removeEventListener("voiceschanged", finish);
      signal.removeEventListener("abort", finish);
      resolve();
    };
    const timeout = setTimeout(finish, 1000);
    speechSynthesis.addEventListener("voiceschanged", finish, { once: true });
    signal.addEventListener("abort", finish, { once: true });
  });
}

export async function speakJapanese(
  text: string,
  signal: AbortSignal,
): Promise<void> {
  if (!window.speechSynthesis)
    throw new Error(
      "This browser does not support speech. Configure AI speech in Settings to generate audio.",
    );
  await waitForVoices(signal);
  if (signal.aborted) return;
  const voice =
    localJapaneseVoice() ||
    (navigator.onLine &&
      speechSynthesis
        .getVoices()
        .find((item) => /^ja(?:-|_)/i.test(item.lang)));
  if (!voice)
    throw new Error(
      "No Japanese browser voice is available. Install a Japanese voice in your device settings, or configure AI speech. Offline playback requires an installed voice or cached audio.",
    );
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = voice;
  utterance.lang = "ja-JP";
  utterance.rate = 0.85;
  speechSynthesis.speak(utterance);
}

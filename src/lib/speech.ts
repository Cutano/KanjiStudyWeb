/** Never select a network voice: optional speech must preserve the offline contract. */
export function localJapaneseVoice(): SpeechSynthesisVoice | undefined {
  return window.speechSynthesis
    ?.getVoices()
    .find((voice) => voice.localService && /^ja(?:-|_)/i.test(voice.lang));
}

export function speakJapanese(text: string): void {
  const voice = localJapaneseVoice();
  if (!voice)
    throw new Error(
      "No offline Japanese device voice is available. Install a Japanese voice in your device accessibility settings; native recordings in this app already work offline.",
    );
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = voice;
  utterance.lang = "ja-JP";
  utterance.rate = 0.85;
  speechSynthesis.speak(utterance);
}

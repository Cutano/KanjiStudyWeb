import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { LoaderCircle, Volume2 } from "lucide-react";
import type { Vocabulary } from "../domain/types";
import { cleanReading, vocabularyLabel } from "../data/text";
import {
  playPronunciation,
  type PronunciationSource,
} from "../lib/pronunciation";
import "./pronunciation.css";

function PronunciationButton({
  text,
  resource,
  label,
}: {
  text: string;
  resource?: string;
  label: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [source, setSource] = useState<PronunciationSource>();
  const errorNotice = useRef<HTMLSpanElement>(null);
  const current = useRef<AbortController>(undefined);
  useLayoutEffect(() => {
    const notice = errorNotice.current;
    if (!notice) return;
    // Playback buttons can sit at either edge of a narrow layout.
    const positionNotice = () => {
      notice.style.transform = "";
      const { left, right } = notice.getBoundingClientRect();
      const shift = Math.max(8 - left, Math.min(0, innerWidth - 8 - right));
      notice.style.transform = `translateX(${shift}px)`;
    };
    positionNotice();
    window.addEventListener("resize", positionNotice);
    return () => window.removeEventListener("resize", positionNotice);
  }, [error]);
  useEffect(() => {
    setBusy(false);
    setError("");
    setSource(undefined);
    return () => current.current?.abort();
  }, [text, resource]);
  async function play() {
    current.current?.abort();
    const controller = new AbortController();
    current.current = controller;
    setBusy(true);
    setError("");
    setSource(undefined);
    try {
      await playPronunciation({
        text,
        resource,
        signal: controller.signal,
        onSource: setSource,
      });
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Audio could not be played.",
      );
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return (
    <span className="pronunciation-control">
      <button
        className="icon-button"
        disabled={busy}
        onClick={play}
        aria-label={label}
        aria-busy={busy}
      >
        {busy ? (
          <LoaderCircle size={18} className="spin" />
        ) : (
          <Volume2 size={18} />
        )}
      </button>
      {source === "ai" && (
        <span className="pronunciation-source" role="status">
          AI voice
        </span>
      )}
      {error && (
        <span className="pronunciation-error" role="alert" ref={errorNotice}>
          {error}
        </span>
      )}
    </span>
  );
}

export function WordAudioButton({ word }: { word: Vocabulary }) {
  const text =
    cleanReading(word.readings.split(";")[0].split(",")[0]) ||
    vocabularyLabel(word);
  return (
    <PronunciationButton
      text={text}
      resource={word.audio}
      label="Play pronunciation"
    />
  );
}

export function SpeechButton({ text }: { text: string }) {
  return <PronunciationButton text={text} label="Read aloud" />;
}

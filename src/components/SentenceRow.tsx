import { ArrowUpRight } from "lucide-react";
import type { Sentence } from "../domain/types";
import { plainSentence } from "../data/text";
import { useProfile } from "../state/useProfile";
import { FavoriteButton, JapaneseSentence } from "./common";

export function SentenceRow({ sentence }: { sentence: Sentence }) {
  const profile = useProfile();
  return (
    <article className="sentence-row">
      <a
        className="sentence-preview"
        href={`#sentence/${sentence.id}`}
        aria-label={`Open sentence: ${plainSentence(sentence.text)}`}
      >
        <p className="japanese-text">
          <JapaneseSentence
            text={sentence.text}
            furigana={profile.settings.showFurigana}
            linked={false}
          />
        </p>
        <p className="muted">{sentence.translation}</p>
        <span className="text-button">
          Open sentence <ArrowUpRight size={14} />
        </span>
      </a>
      <FavoriteButton id={`sentence:${sentence.id}`} />
    </article>
  );
}

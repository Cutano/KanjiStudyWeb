import { useState } from "react";
import { ArrowRight, Plus } from "lucide-react";
import type { CharacterKey, CharacterSummary } from "../domain/types";
import { catalog } from "../data/catalog";
import { useProfile } from "../state/useProfile";
import { updateProfile } from "../state/profile";
import { useAsync } from "../lib/hooks";
import {
  CharacterCard,
  Empty,
  ErrorNotice,
  FavoriteButton,
  JapaneseSentence,
  Loading,
  WordRow,
} from "../components/common";
import { CollectionImport } from "./CollectionImport";

export { SetPicker } from "./CollectionPicker";
export { SetDetails } from "./SetDetails";

interface SetProps {
  onStudy: (items: CharacterSummary[], title: string) => void;
  onAddToSet: (keys: CharacterKey[]) => void;
}
export function Sets({ onAddToSet }: SetProps) {
  const profile = useProfile();
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">PERSONAL COLLECTIONS</p>
          <h1>
            Make the journey yours<span className="accent-dot">.</span>
          </h1>
          <p className="subtitle">Gather the characters that matter to you.</p>
        </div>
        <div className="button-group wrap">
          <CollectionImport
            onImport={async (collection) => {
              const id = crypto.randomUUID();
              await updateProfile((draft) => {
                draft.sets.push({
                  ...collection,
                  id,
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                });
              });
              location.hash = `set/${id}`;
            }}
          />
          <button className="button" onClick={() => onAddToSet([])}>
            <Plus size={18} />
            New study set
          </button>
        </div>
      </div>
      <a href="#favorites" className="favorites-banner">
        <div>
          <span className="eyebrow">SAVED ALONG THE WAY</span>
          <h2>Your favorites</h2>
          <p>
            {profile.favorites.length} characters, words, and sentences worth
            remembering.
          </p>
        </div>
        <ArrowRight size={24} />
      </a>
      {profile.sets.length ? (
        <div className="set-grid">
          {profile.sets.map((set, index) => (
            <a className="set-card" key={set.id} href={`#set/${set.id}`}>
              <span className="set-index">
                COLLECTION {String(index + 1).padStart(2, "0")}
              </span>
              <div lang="ja" className="set-preview">
                {set.keys
                  .slice(0, 5)
                  .map((key) => String.fromCodePoint(+key.split(":")[1]))
                  .join("") || "あ 日 学"}
              </div>
              <h2>{set.name}</h2>
              <p>{set.description || "Your own little corner of Japanese."}</p>
              <div>
                <span>{set.keys.length} characters</span>
                <ArrowRight size={18} />
              </div>
            </a>
          ))}
        </div>
      ) : (
        <Empty title="A collection begins with curiosity">
          Create a set, then add characters from the library or paste your own
          Japanese text.
        </Empty>
      )}
    </div>
  );
}

export function Favorites({ onStudy, onAddToSet }: SetProps) {
  const profile = useProfile();
  const [tab, setTab] = useState("characters");
  const characters = useAsync(
    () =>
      catalog.getCharacters({
        keys: profile.favorites.filter((key) =>
          /^(kanji|hiragana|katakana|radical):/.test(key),
        ) as CharacterKey[],
        limit: 8000,
      }),
    [profile.favorites],
  );
  const words = useAsync(
    () =>
      Promise.all(
        profile.favorites
          .filter((key) => key.startsWith("word:"))
          .map((key) => catalog.getVocabulary(+key.split(":")[1])),
      ),
    [profile.favorites],
  );
  const sentences = useAsync(
    () =>
      Promise.all(
        profile.favorites
          .filter((key) => key.startsWith("sentence:"))
          .map((key) => catalog.getSentence(+key.split(":")[1])),
      ),
    [profile.favorites],
  );
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">WORTH ANOTHER VISIT</p>
          <h1>
            Your favorites<span className="accent-dot">.</span>
          </h1>
          <p className="subtitle">
            A small shelf of things you want to remember.
          </p>
        </div>
        <button
          className="button"
          disabled={!characters.data?.items.length}
          onClick={() => onStudy(characters.data!.items, "Favorite characters")}
        >
          Study favorites
        </button>
      </div>
      <div className="tabs">
        {["characters", "words", "sentences"].map((value) => (
          <button
            className={tab === value ? "active" : ""}
            key={value}
            onClick={() => setTab(value)}
          >
            {value[0].toUpperCase() + value.slice(1)}
          </button>
        ))}
      </div>
      <ErrorNotice
        message={characters.error || words.error || sentences.error}
      />
      {tab === "characters" ? (
        characters.loading ? (
          <Loading />
        ) : characters.data?.items.length ? (
          <>
            <div className="results-toolbar wrap">
              <span>{characters.data.items.length} characters</span>
              <button
                className="text-button"
                onClick={() =>
                  onAddToSet(characters.data!.items.map((item) => item.key))
                }
              >
                Add all to a set
              </button>
            </div>
            <div className="character-grid">
              {characters.data.items.map((item) => (
                <CharacterCard key={item.key} item={item} />
              ))}
            </div>
          </>
        ) : (
          <Empty title="Save a character that speaks to you">
            Tap the star on any character to keep it here.
          </Empty>
        )
      ) : tab === "words" ? (
        words.loading ? (
          <Loading />
        ) : words.data?.length ? (
          words.data.map((word) => <WordRow key={word.id} word={word} />)
        ) : (
          <Empty title="A word for later">
            Star vocabulary in the dictionary to return to it here.
          </Empty>
        )
      ) : sentences.loading ? (
        <Loading />
      ) : sentences.data?.length ? (
        sentences.data.map((sentence) => (
          <article className="sentence-row" key={sentence.id}>
            <div>
              <p className="japanese-text">
                <JapaneseSentence
                  text={sentence.text}
                  furigana={profile.settings.showFurigana}
                />
              </p>
              <p className="muted">{sentence.translation}</p>
            </div>
            <FavoriteButton id={`sentence:${sentence.id}`} />
          </article>
        ))
      ) : (
        <Empty title="Keep a little context">
          Favorite an example sentence while exploring a character.
        </Empty>
      )}
    </div>
  );
}

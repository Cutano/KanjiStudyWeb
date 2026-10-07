import { useState } from "react";
import { BookOpen, Check, Search } from "lucide-react";
import { catalog } from "../data/catalog";
import { plainSentence } from "../data/text";
import { useAsync, useDebounced } from "../lib/hooks";
import { useProfile } from "../state/useProfile";
import { updateProfile } from "../state/profile";
import {
  SpeechButton,
  Empty,
  ErrorNotice,
  FavoriteButton,
  JapaneseSentence,
  Loading,
} from "../components/common";

export function Reading() {
  const profile = useProfile();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [source, setSource] = useState("catalog");
  const [revealed, setRevealed] = useState<string[]>([]);
  const [error, setError] = useState("");
  const term = useDebounced(query);
  const result = useAsync(
    () => catalog.searchSentences(term, { offset: page * 20, limit: 20 }),
    [term, page],
  );
  const imported = profile.extensions
    .flatMap((pack) =>
      pack.readings.map((reading) => ({
        ...reading,
        pack: pack.name,
        id: `${pack.id}:${reading.id}`,
      })),
    )
    .filter(
      (reading) =>
        !term ||
        reading.text.includes(term) ||
        reading.translation.toLowerCase().includes(term.toLowerCase()),
    );
  const rows =
    source === "catalog"
      ? result.data?.items.map((item) => ({
          ...item,
          id: `sentence:${item.id}`,
          pack: "",
        })) || []
      : imported.slice(page * 20, page * 20 + 20);
  const total =
    source === "catalog" ? result.data?.total || 0 : imported.length;
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">CHARACTERS IN CONTEXT</p>
          <h1>
            Let Japanese tell a story<span className="accent-dot">.</span>
          </h1>
          <p className="subtitle">
            Read a little, notice a little. Meaning comes with context.
          </p>
        </div>
        <div className="count-stamp">
          <strong>{profile.readingProgress.length}</strong>
          <span>sentences explored</span>
        </div>
      </div>
      <div className="tabs">
        <button
          className={source === "catalog" ? "active" : ""}
          onClick={() => {
            setSource("catalog");
            setPage(0);
          }}
        >
          Example sentences
        </button>
        <button
          className={source === "extensions" ? "active" : ""}
          onClick={() => {
            setSource("extensions");
            setPage(0);
          }}
        >
          Imported reading sets
        </button>
      </div>
      <div className="search-toolbar">
        <label className="search-input">
          <Search size={19} />
          <input
            aria-label="Search sentences"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
            placeholder="Search Japanese text or an English translation…"
          />
        </label>
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={profile.settings.showFurigana}
            onChange={(event) => {
              const checked = event.target.checked;
              updateProfile((draft) => {
                draft.settings.showFurigana = checked;
              }).catch((reason: Error) => setError(reason.message));
            }}
          />
          Furigana
        </label>
      </div>
      <ErrorNotice message={error || result.error} />
      <div className="results-toolbar">
        <span>
          {total.toLocaleString()}{" "}
          {source === "catalog" ? "examples" : "imported readings"}
        </span>
        <span className="muted">
          Read first. Reveal the meaning when you’re ready.
        </span>
      </div>
      {result.loading && source === "catalog" ? (
        <Loading />
      ) : !rows.length ? (
        <Empty
          title={
            source === "catalog"
              ? "Try a different word"
              : "Bring your own reading collection"
          }
        >
          {source === "catalog" ? (
            "Search a character, phrase, or translation."
          ) : (
            <>
              Import an authorized extension pack in{" "}
              <a href="#settings">Settings</a>. The core library already
              includes 16,277 example sentences.
            </>
          )}
        </Empty>
      ) : (
        <div className="reading-list">
          {rows.map((sentence, index) => {
            const read = profile.readingProgress.includes(sentence.id);
            return (
              <article
                className={`reading-card ${read ? "is-read" : ""}`}
                key={sentence.id}
              >
                <div className="reading-number">
                  {String(page * 20 + index + 1).padStart(2, "0")}
                </div>
                <div className="reading-content">
                  {sentence.pack && (
                    <span className="eyebrow">{sentence.pack}</span>
                  )}
                  <p className="japanese-text">
                    <JapaneseSentence
                      text={sentence.text}
                      furigana={profile.settings.showFurigana}
                    />
                  </p>
                  {revealed.includes(sentence.id) ? (
                    <p className="sentence-translation">
                      {sentence.translation}
                    </p>
                  ) : (
                    <button
                      className="reveal-button"
                      onClick={() => setRevealed([...revealed, sentence.id])}
                    >
                      Reveal meaning
                    </button>
                  )}
                  <div className="reading-actions">
                    <button
                      className={`text-button ${read ? "read-label" : ""}`}
                      onClick={() =>
                        updateProfile((draft) => {
                          draft.readingProgress =
                            draft.readingProgress.includes(sentence.id)
                              ? draft.readingProgress.filter(
                                  (id) => id !== sentence.id,
                                )
                              : [...draft.readingProgress, sentence.id];
                        }).catch((reason: Error) => setError(reason.message))
                      }
                    >
                      {read ? <Check size={16} /> : <BookOpen size={16} />}
                      {read ? "Read" : "Mark as read"}
                    </button>
                    {source === "catalog" && (
                      <a
                        className="text-button"
                        href={`#sentence/${sentence.id.slice("sentence:".length)}`}
                      >
                        Open sentence
                      </a>
                    )}
                    <div className="button-group">
                      <SpeechButton text={plainSentence(sentence.text)} />
                      {source === "catalog" && (
                        <FavoriteButton id={sentence.id} />
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <div className="pagination">
        <span>
          {total
            ? `${page * 20 + 1}–${Math.min((page + 1) * 20, total)}`
            : "0 results"}
        </span>
        <div className="button-group">
          <button
            disabled={!page}
            className="button secondary small"
            onClick={() => setPage(page - 1)}
          >
            Previous
          </button>
          <button
            disabled={(page + 1) * 20 >= total}
            className="button secondary small"
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  Check,
  Clipboard,
  Pencil,
  Plus,
} from "lucide-react";
import type {
  CharacterKey,
  CharacterSummary,
  Rating,
  SequenceSystem,
} from "../domain/types";
import { catalog } from "../data/catalog";
import {
  cleanReading,
  parseVocabularyForms,
  vocabularyLabel,
  vocabularyMeaning,
} from "../data/text";
import { useAsync } from "../lib/hooks";
import { RATING_LABELS, SYSTEMS, levelLabel } from "../lib/constants";
import { useProfile } from "../state/useProfile";
import { updateProfile } from "../state/profile";
import {
  AudioButton,
  DeviceVoiceButton,
  BackButton,
  CharacterCard,
  Empty,
  ErrorNotice,
  FavoriteButton,
  JapaneseSentence,
  Loading,
  Modal,
  WordRow,
} from "../components/common";
import { StrokeDiagram } from "../components/StrokeDiagram";

interface Props {
  characterKey: CharacterKey;
  onStudy: (items: CharacterSummary[], title: string) => void;
  onAddToSet: (keys: CharacterKey[]) => void;
}

const RADICAL_POSITIONS = [
  "No common position",
  "Left side · 偏（へん）",
  "Right side · 旁（つくり）",
  "Top · 冠（かんむり）",
  "Bottom · 脚（あし）",
  "Northwest · 垂（たれ）",
  "Southwest · 繞（にょう）",
  "Enclosure · 構（かまえ）",
] as const;
export function CharacterDetails({ characterKey, onStudy, onAddToSet }: Props) {
  const profile = useProfile();
  const detail = useAsync(
    () => catalog.getCharacter(characterKey),
    [characterKey],
  );
  const [tab, setTab] = useState("words");
  const [page, setPage] = useState(0);
  const words = useAsync(
    () =>
      catalog.getCharacterVocabulary(characterKey, {
        offset: page * 20,
        limit: 20,
      }),
    [characterKey, page],
  );
  const sentences = useAsync(
    () =>
      catalog.getCharacterSentences(characterKey, {
        offset: page * 20,
        limit: 20,
      }),
    [characterKey, page],
  );
  const names = useAsync(
    () =>
      catalog.getCharacterNames(characterKey, { offset: page * 20, limit: 20 }),
    [characterKey, page],
  );
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(profile.notes[characterKey] || "");
  const [meaning, setMeaning] = useState(
    profile.overrides[characterKey]?.meaning || "",
  );
  const [onReading, setOnReading] = useState(
    profile.overrides[characterKey]?.onReading || "",
  );
  const [kunReading, setKunReading] = useState(
    profile.overrides[characterKey]?.kunReading || "",
  );
  const [reading, setReading] = useState(
    profile.overrides[characterKey]?.reading || "",
  );
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const character = detail.data;
  if (detail.loading) return <Loading />;
  if (!character)
    return (
      <div className="page">
        <BackButton />
        <ErrorNotice
          message={
            detail.error || "This character is not in the supplied catalog."
          }
        />
      </div>
    );
  const progress = profile.progress[characterKey];
  const override = profile.overrides[characterKey];
  const extensionEntries = profile.extensions.flatMap((pack) =>
    pack.entries
      .filter((entry) => entry.code === character.code)
      .map((entry) => ({ ...entry, source: pack.name })),
  );
  const activeResult =
    tab === "words" ? words : tab === "sentences" ? sentences : names;
  async function setRating(rating: Rating) {
    await updateProfile((draft) => {
      const previous = draft.progress[characterKey] || {
        reviews: 0,
        correct: 0,
        writingAttempts: 0,
        writingCorrect: 0,
        timeMs: 0,
        lastStudied: 0,
        srs: null,
      };
      draft.progress[characterKey] = { ...previous, rating };
    }).catch((reason: Error) => setError(reason.message));
  }
  async function saveCustomizations() {
    try {
      await updateProfile((draft) => {
        draft.notes[characterKey] = note;
        draft.overrides[characterKey] = {
          meaning,
          onReading,
          kunReading,
          reading,
        };
      });
      setEditing(false);
    } catch (reason) {
      setError((reason as Error).message);
    }
  }
  return (
    <div className="page detail-page">
      <BackButton />
      <ErrorNotice message={error} />
      <div className="detail-layout">
        <aside className="character-aside">
          <div className="stroke-card">
            <div className="stroke-card-top">
              <span className="eyebrow">{character.kind.toUpperCase()}</span>
              <FavoriteButton id={characterKey} />
            </div>
            <StrokeDiagram
              paths={character.paths}
              glyph={character.glyph}
              speed={profile.settings.strokeSpeed}
              size={280}
            />
            <div className="stroke-card-bottom">
              <span>{character.strokeCount} strokes</span>
            </div>
            {!character.paths.length && (
              <p className="muted small-text">
                This source has no stroke paths. Free writing is still
                available.
              </p>
            )}
          </div>
          <button
            className="button full"
            onClick={() => onStudy([character], `Practice ${character.glyph}`)}
          >
            <Pencil size={17} />
            Practice this character
          </button>
          <button
            className="button secondary full"
            onClick={() => onAddToSet([characterKey])}
          >
            <Plus size={17} />
            Add to a study set
          </button>
          <section className="side-note">
            <p className="eyebrow">YOUR FAMILIARITY</p>
            <div className="rating-buttons">
              {RATING_LABELS.map((label, index) => (
                <button
                  className={`rating-choice rating-${index} ${(progress?.rating || 0) === index ? "active" : ""}`}
                  key={label}
                  onClick={() => setRating(index as Rating)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="mini-stats">
              <div>
                <strong>{progress?.reviews || 0}</strong>
                <span>reviews</span>
              </div>
              <div>
                <strong>
                  {progress?.reviews
                    ? Math.round((progress.correct / progress.reviews) * 100)
                    : 0}
                  %
                </strong>
                <span>accuracy</span>
              </div>
            </div>
          </section>
        </aside>
        <div className="character-content">
          <div className="detail-title">
            <div>
              <p className="eyebrow">A CLOSER LOOK</p>
              <h1>
                {override?.meaning ||
                  character.meaning ||
                  override?.reading ||
                  character.reading ||
                  character.glyph}
              </h1>
            </div>
            <button
              aria-label="Copy character"
              className="icon-button"
              onClick={() =>
                navigator.clipboard
                  .writeText(character.glyph)
                  .then(() => setCopied(true))
                  .catch((reason: Error) => setError(reason.message))
              }
            >
              {copied ? <Check /> : <Clipboard size={20} />}
            </button>
          </div>
          <div className="detail-tags">
            <span className="tag">
              U+{character.code.toString(16).toUpperCase()}
            </span>
            {character.kind === "kanji" && (
              <span className="badge">
                {levelLabel(
                  profile.settings.system,
                  character.sequences[profile.settings.system]?.level ??
                    character.level,
                )}
              </span>
            )}
            {character.isKokuji && (
              <span className="tag">Japanese-created</span>
            )}
            {character.isPhantom && (
              <span className="tag">Phantom character</span>
            )}
            {character.isArchaic && (
              <span className="tag">Archaic in source catalog</span>
            )}
            {character.isDiacritic && (
              <span className="tag">Diacritic form</span>
            )}
            {character.isImportant && (
              <span className="tag">Common radical</span>
            )}
          </div>
          <section className="reading-block">
            {(override?.onReading || character.onReading) && (
              <div>
                <span className="eyebrow coral">ON’YOMI</span>
                <p lang="ja">
                  {cleanReading(override?.onReading || character.onReading)}
                </p>
              </div>
            )}
            {(override?.kunReading || character.kunReading) && (
              <div>
                <span className="eyebrow blue">KUN’YOMI</span>
                <p lang="ja">
                  {cleanReading(override?.kunReading || character.kunReading)}
                </p>
              </div>
            )}
            {!character.onReading && !character.kunReading && (
              <div>
                <span className="eyebrow">READING</span>
                <p lang="ja">{override?.reading || character.reading}</p>
              </div>
            )}
            {character.nanori && (
              <div>
                <span className="eyebrow">NAME READINGS</span>
                <p lang="ja">{character.nanori}</p>
              </div>
            )}
          </section>
          {character.components.length > 0 && (
            <section className="detail-section">
              <h3>Built from smaller pieces</h3>
              <div className="component-list">
                {character.components.map((component) => {
                  const Tag = component.key ? "a" : "div";
                  return (
                    <Tag
                      key={component.code}
                      className="component"
                      href={
                        component.key
                          ? `#character/${component.key}`
                          : undefined
                      }
                    >
                      <span lang="ja">{component.glyph}</span>
                      <span>
                        {component.meaning || "Component"}
                        {component.occurrences > 1 && (
                          <small> ×{component.occurrences}</small>
                        )}
                      </span>
                      {component.key && <ArrowUpRight size={13} />}
                    </Tag>
                  );
                })}
              </div>
            </section>
          )}
          {character.origin && (
            <section className="detail-section">
              <h3>Origin</h3>
              <p lang="ja" className="japanese-text">
                {character.origin}
              </p>
              <p>{character.example}</p>
            </section>
          )}
          <section className="note-panel">
            <div className="section-title">
              <h3>Your memory, your words</h3>
              <button className="text-button" onClick={() => setEditing(true)}>
                <Pencil size={14} />
                Edit
              </button>
            </div>
            <p>
              {profile.notes[characterKey] ||
                "Add a mnemonic, a story, or a small connection that makes this character yours."}
            </p>
          </section>
          <details className="more-details">
            <summary>Language notes & study sequences</summary>
            <dl>
              {[
                ["Mandarin", character.pinyin],
                ["Korean", character.korean],
                ["Korean romanization", character.koreanRomanized],
                ["Vietnamese", character.vietnamese],
                [
                  "Alternative forms",
                  character.kind === "kanji"
                    ? character.variants.replace(/^[ks](?=\p{Script=Han})/u, "")
                    : character.variants,
                ],
                ["Classical radical", character.classicalRadical],
                ["Kangxi radical number", character.kangxiNumber],
                ["Kangxi base form", character.kangxiBase],
                ["Variant of", character.variantOf],
                [
                  "Radical position",
                  character.radicalPosition === null
                    ? ""
                    : RADICAL_POSITIONS[character.radicalPosition],
                ],
                ["Decomposition", character.decomposition],
              ]
                .filter(([, value]) => value)
                .map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd lang="ja">{value}</dd>
                  </div>
                ))}
              {Object.entries(character.sequences).map(([system, value]) => (
                <div key={system}>
                  <dt>
                    {SYSTEMS.find((entry) => entry.value === system)?.label}
                  </dt>
                  <dd>
                    {levelLabel(system as SequenceSystem, value!.level)} · #
                    {value!.sequence}
                  </dd>
                </div>
              ))}
            </dl>
          </details>
          {extensionEntries.map((entry, index) => (
            <section className="detail-section" key={index}>
              <p className="eyebrow">{entry.source}</p>
              <h3>Character explanation</h3>
              <p className="preserve-lines">{entry.explanation}</p>
              {entry.etymology && (
                <p className="preserve-lines">{entry.etymology}</p>
              )}
            </section>
          ))}
        </div>
      </div>
      <section className="examples-section">
        <div className="tabs">
          {[
            ["words", "Vocabulary", words.data?.total],
            ["sentences", "Sentences", sentences.data?.total],
            ["names", "Names", names.data?.total],
          ].map(([value, label, count]) => (
            <button
              key={value}
              className={tab === value ? "active" : ""}
              onClick={() => {
                setTab(String(value));
                setPage(0);
              }}
            >
              {label} <span>{count || 0}</span>
            </button>
          ))}
        </div>
        <ErrorNotice message={activeResult.error} />
        {activeResult.loading ? (
          <Loading />
        ) : !activeResult.data?.total ? (
          <Empty title="No examples in this collection">
            Explore the dictionary for more connections.
          </Empty>
        ) : tab === "words" ? (
          words.data?.items.map((word) => <WordRow key={word.id} word={word} />)
        ) : tab === "sentences" ? (
          sentences.data?.items.map((sentence) => (
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
          names.data?.items.map((name) => (
            <article className="word-row" key={name.id}>
              <div>
                <p className="japanese-text" lang="ja">
                  {name.name}
                </p>
                <span lang="ja" className="muted">
                  {name.reading}
                </span>
              </div>
              <span className="tag">{name.type}</span>
            </article>
          ))
        )}
        <div className="pagination">
          <span>{activeResult.data?.total || 0} examples</span>
          <div className="button-group">
            <button
              className="button secondary small"
              disabled={!page}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </button>
            <button
              className="button secondary small"
              disabled={(page + 1) * 20 >= (activeResult.data?.total || 0)}
              onClick={() => setPage(page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </section>
      {editing && (
        <Modal title="Make it memorable" onClose={() => setEditing(false)}>
          <div className="form-stack">
            <label>
              Personal note
              <textarea
                rows={4}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Your mnemonic or example…"
              />
            </label>
            <label>
              Custom meaning
              <input
                value={meaning}
                onChange={(event) => setMeaning(event.target.value)}
                placeholder={character.meaning}
              />
            </label>
            {character.kind === "kanji" ? (
              <>
                <label>
                  Custom on’yomi
                  <input
                    value={onReading}
                    onChange={(event) => setOnReading(event.target.value)}
                    placeholder={cleanReading(character.onReading)}
                  />
                </label>
                <label>
                  Custom kun’yomi
                  <input
                    value={kunReading}
                    onChange={(event) => setKunReading(event.target.value)}
                    placeholder={cleanReading(character.kunReading)}
                  />
                </label>
              </>
            ) : (
              <label>
                Custom reading
                <input
                  value={reading}
                  onChange={(event) => setReading(event.target.value)}
                  placeholder={character.reading}
                />
              </label>
            )}
            <ErrorNotice message={error} />
            <button className="button" onClick={saveCustomizations}>
              <Check size={16} />
              Save changes
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

export function WordDetails({ id }: { id: number }) {
  const {
    data: word,
    loading,
    error,
  } = useAsync(() => catalog.getVocabulary(id), [id]);
  const profile = useProfile();
  const [note, setNote] = useState(profile.notes[`word:${id}`] || "");
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  if (loading) return <Loading />;
  if (!word)
    return (
      <div className="page">
        <BackButton />
        <ErrorNotice message={error} />
      </div>
    );
  return (
    <div className="page word-detail">
      <BackButton />
      <p className="eyebrow spaced-top">DICTIONARY / WORD DETAIL</p>
      <div className="word-detail-title">
        <h1 lang="ja">{vocabularyLabel(word)}</h1>
        <FavoriteButton id={`word:${id}`} />
        {word.audio ? (
          <AudioButton resource={word.audio} />
        ) : (
          <DeviceVoiceButton text={word.readings.split(";")[0].split(",")[0]} />
        )}
      </div>
      <p className="japanese-text muted" lang="ja">
        {word.readings.split(";")[0]}
      </p>
      <p className="romaji">{word.readings.split(";")[1]}</p>
      <div className="detail-tags">
        {word.isCommon && <span className="badge">Common word</span>}
        {word.jlptLevel > 0 && (
          <span className="tag">JLPT N{word.jlptLevel}</span>
        )}
      </div>
      <section className="detail-section">
        <h2>Meaning & usage</h2>
        <p className="definition">{vocabularyMeaning(word)}</p>
        {word.entry.includes("|") && (
          <p className="muted">
            Also written: {word.entry.split("|").slice(1).join(" · ")}
          </p>
        )}
        <p className="muted small-text">
          {word.tags
            .split(" ")
            .filter((tag) => !/^[pck]\d+$/.test(tag))
            .join(" · ")}
        </p>
      </section>
      <section className="detail-section">
        <h2>Forms & readings</h2>
        <div className="vocabulary-forms">
          {parseVocabularyForms(word).map((form, index) => (
            <article key={index}>
              <p className="japanese-text" lang="ja">
                {form.segments.map((segment, segmentIndex) =>
                  segment.reading && profile.settings.showFurigana ? (
                    <ruby key={segmentIndex}>
                      {segment.text}
                      <rt>{segment.reading}</rt>
                    </ruby>
                  ) : (
                    <span key={segmentIndex}>{segment.text}</span>
                  ),
                )}
              </p>
              <p className="muted">{form.readings.join(" · ")}</p>
              {form.pitchAccents.length > 0 && (
                <span className="tag">
                  Accent: {form.pitchAccents.join(" / ")}
                </span>
              )}
            </article>
          ))}
        </div>
      </section>
      {word.characters.length > 0 && (
        <section className="detail-section">
          <h2>Inside this word</h2>
          <div className="character-grid compact-grid">
            {word.characters.map((character) => (
              <CharacterCard item={character} key={character.key} />
            ))}
          </div>
        </section>
      )}
      {word.sentences.length > 0 && (
        <section className="detail-section">
          <h2>In context</h2>
          {word.sentences.map((sentence) => (
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
          ))}
        </section>
      )}
      {word.references.length > 0 && (
        <section className="detail-section">
          <h2>Related words</h2>
          {word.references.map((reference) => (
            <WordRow key={reference.id} word={reference} />
          ))}
        </section>
      )}
      <section className="note-panel">
        <h3>Your note</h3>
        <textarea
          rows={3}
          value={note}
          onChange={(event) => {
            setNote(event.target.value);
            setSaved(false);
          }}
          placeholder="Save an example or a helpful connection…"
        />
        <button
          className="text-button"
          onClick={() =>
            updateProfile((draft) => {
              draft.notes[`word:${id}`] = note;
            })
              .then(() => setSaved(true))
              .catch((reason: Error) => setSaveError(reason.message))
          }
        >
          {saved ? <Check size={16} /> : <BookOpen size={16} />}
          {saved ? "Saved" : "Save note"}
        </button>
        <ErrorNotice message={saveError} />
      </section>
    </div>
  );
}

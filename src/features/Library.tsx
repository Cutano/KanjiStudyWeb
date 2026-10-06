import { useEffect, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Grid2X2,
  List,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import { catalog } from "../data/catalog";
import type {
  CharacterKind,
  CharacterKey,
  CharacterSummary,
  SequenceSystem,
} from "../domain/types";
import { useAsync, useDebounced } from "../lib/hooks";
import { SYSTEMS, SYSTEM_LEVELS, levelLabel } from "../lib/constants";
import { useProfile } from "../state/useProfile";
import { updateProfile } from "../state/profile";
import { RATING_LABELS } from "../lib/constants";
import {
  CharacterCard,
  Empty,
  ErrorNotice,
  Loading,
  WordRow,
} from "../components/common";

interface Props {
  onStudy: (items: CharacterSummary[], title: string) => void;
  onAddToSet: (keys: CharacterKey[]) => void;
  initialQuery?: string;
  initialKind?: CharacterKind | "words";
}
export function Library({
  onStudy,
  onAddToSet,
  initialQuery = "",
  initialKind = "kanji",
}: Props) {
  const profile = useProfile();
  const [kind, setKind] = useState<CharacterKind | "words">(initialKind);
  const [query, setQuery] = useState(initialQuery);
  const [system, setSystem] = useState<SequenceSystem>(profile.settings.system);
  const [level, setLevel] = useState("all");
  const [strokes, setStrokes] = useState("");
  const [components, setComponents] = useState<number[]>([]);
  const [filters, setFilters] = useState(false);
  const [layout, setLayout] = useState("grid");
  const [rating, setRating] = useState("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [searchNotes, setSearchNotes] = useState(false);
  const [selected, setSelected] = useState<CharacterKey[]>([]);
  const [selecting, setSelecting] = useState(false);
  const [page, setPage] = useState(0);
  const term = useDebounced(query);
  useEffect(() => {
    setPage(0);
    setSelected([]);
  }, [
    term,
    kind,
    system,
    level,
    strokes,
    components,
    rating,
    favoritesOnly,
    searchNotes,
  ]);
  useEffect(() => {
    if (!term.trim()) return;
    const timer = setTimeout(
      () =>
        updateProfile((draft) => {
          draft.searchHistory = [
            term.trim(),
            ...draft.searchHistory.filter((item) => item !== term.trim()),
          ].slice(0, 12);
        }).catch((reason: Error) => setActionError(reason.message)),
      1000,
    );
    return () => clearTimeout(timer);
  }, [term]);
  async function loadCharacters(limit: number, offset = 0) {
    const personal = rating !== "all" || favoritesOnly || searchNotes;
    const result = await catalog.getCharacters({
      kind: kind === "words" ? "kanji" : kind,
      system,
      level: level === "all" ? undefined : +level,
      query: searchNotes ? "" : term,
      strokeCount: strokes ? +strokes : undefined,
      components,
      offset: personal ? 0 : offset,
      limit: personal ? 8000 : limit,
    });
    if (!personal) return result;
    const filtered = result.items.filter(
      (item) =>
        (rating === "all" ||
          (profile.progress[item.key]?.rating || 0) === +rating) &&
        (!favoritesOnly || profile.favorites.includes(item.key)) &&
        (!searchNotes ||
          [
            profile.notes[item.key],
            ...Object.values(profile.overrides[item.key] || {}),
          ].some(
            (value) =>
              value && value.toLowerCase().includes(term.trim().toLowerCase()),
          )),
    );
    return {
      items: filtered.slice(offset, offset + limit),
      total: filtered.length,
    };
  }
  const characters = useAsync(
    () =>
      kind === "words"
        ? Promise.resolve({ items: [], total: 0 })
        : loadCharacters(60, page * 60),
    [
      kind,
      system,
      level,
      term,
      strokes,
      components,
      page,
      rating,
      favoritesOnly,
      profile.progress,
      profile.favorites,
      profile.notes,
      profile.overrides,
      searchNotes,
    ],
  );
  const words = useAsync(
    () =>
      kind === "words"
        ? catalog.searchVocabulary(term, { offset: page * 30, limit: 30 })
        : Promise.resolve({ items: [], total: 0 }),
    [kind, term, page],
  );
  const radicals = useAsync(
    () =>
      filters
        ? catalog.getCharacters({ kind: "radical", limit: 300 })
        : Promise.resolve({ items: [], total: 0 }),
    [filters],
  );
  const result = kind === "words" ? words : characters;
  const items = characters.data?.items || [];
  const total = result.data?.total || 0;
  const pageSize = kind === "words" ? 30 : 60;
  const [actionError, setActionError] = useState("");
  async function studyResults() {
    try {
      const result = await loadCharacters(8000);
      const all = selected.length
        ? { items: result.items.filter((item) => selected.includes(item.key)) }
        : result;
      onStudy(
        all.items,
        selected.length
          ? "Your selection"
          : level === "all"
            ? "Library practice"
            : levelLabel(system, +level),
      );
    } catch (reason) {
      setActionError((reason as Error).message);
    }
  }
  return (
    <div className="page library-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">EXPLORE AT YOUR OWN PACE</p>
          <h1>
            Your Japanese library<span className="accent-dot">.</span>
          </h1>
          <p className="subtitle">
            Every character is a small discovery. Find your next one.
          </p>
        </div>
        <span className="count-stamp">
          <strong>7,045</strong>
          <span>kanji to discover</span>
        </span>
      </div>
      <div className="tabs" role="tablist" aria-label="Library category">
        {(["kanji", "hiragana", "katakana", "radical", "words"] as const).map(
          (tab) => (
            <button
              role="tab"
              aria-selected={kind === tab}
              className={kind === tab ? "active" : ""}
              key={tab}
              onClick={() => {
                setKind(tab);
                setLevel("all");
                setComponents([]);
              }}
            >
              {
                {
                  kanji: "Kanji",
                  hiragana: "Hiragana",
                  katakana: "Katakana",
                  radical: "Radicals",
                  words: "Dictionary",
                }[tab]
              }
            </button>
          ),
        )}
      </div>
      <div className="search-toolbar">
        <label className="search-input">
          <Search size={20} />
          <input
            aria-label="Search library"
            placeholder={
              kind === "words"
                ? "Search words, readings, romaji, or meanings…"
                : "Search a character, reading, or meaning…"
            }
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query && (
            <button
              aria-label="Clear search"
              className="icon-button"
              onClick={() => setQuery("")}
            >
              <X size={17} />
            </button>
          )}
          <kbd>/</kbd>
        </label>
        {kind !== "words" && (
          <button
            className={`button secondary ${filters ? "pressed" : ""}`}
            onClick={() => setFilters(!filters)}
          >
            <SlidersHorizontal size={17} />
            <span>Filters</span>
            {components.length > 0 && <span>{components.length}</span>}
          </button>
        )}
      </div>
      {!query && profile.searchHistory.length > 0 && (
        <div className="search-history">
          <span>Recent</span>
          {profile.searchHistory.slice(0, 5).map((entry) => (
            <button key={entry} onClick={() => setQuery(entry)}>
              {entry}
            </button>
          ))}
          <button
            aria-label="Clear search history"
            onClick={() =>
              updateProfile((draft) => {
                draft.searchHistory = [];
              }).catch((reason: Error) => setActionError(reason.message))
            }
          >
            <X size={13} />
          </button>
        </div>
      )}
      <details className="search-help">
        <summary>Search tips</summary>
        <p>
          Combine words to narrow results. Quote an exact meaning phrase and
          prefix a term with <code>-</code> to exclude it. Use <code>n5</code>{" "}
          through <code>n1</code> for JLPT levels.
        </p>
        <p>
          {kind === "words" ? (
            <>
              Try <code>school n5</code>, <code>has:audio</code>,{" "}
              <code>is:common</code>, or <code>pos:noun</code>. Japanese, kana,
              romaji and English all work.
            </>
          ) : (
            <>
              Try <code>water s:4</code> for four strokes, or select components
              in Filters. Familiarity and favorite filters use your own study
              profile.
            </>
          )}
        </p>
      </details>
      {kind === "kanji" && (
        <div className="library-controls">
          <label>
            Study sequence
            <select
              aria-label="Study sequence"
              value={system}
              onChange={(event) => {
                setSystem(event.target.value as SequenceSystem);
                setLevel("all");
              }}
            >
              {SYSTEMS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Level
            <select
              aria-label="Level"
              value={level}
              onChange={(event) => setLevel(event.target.value)}
            >
              <option value="all">All levels</option>
              {Array.from(
                { length: SYSTEM_LEVELS[system] },
                (_, index) => index + 1,
              ).map((value) => (
                <option key={value} value={value}>
                  {levelLabel(system, value)}
                </option>
              ))}
              <option value="0">Unclassified</option>
            </select>
          </label>
          <div className="control-spacer" />
          <button className="text-button" onClick={studyResults}>
            <Sparkles size={17} />
            Study this selection
          </button>
        </div>
      )}
      {filters && kind !== "words" && (
        <section className="filter-panel">
          <div className="section-title">
            <h3>Refine your discovery</h3>
            <button
              className="text-button"
              onClick={() => {
                setComponents([]);
                setStrokes("");
              }}
            >
              Clear filters
            </button>
          </div>
          <label className="inline-label">
            Stroke count
            <input
              aria-label="Stroke count"
              type="number"
              min="1"
              max="33"
              value={strokes}
              onChange={(event) => setStrokes(event.target.value)}
              placeholder="Any"
            />
          </label>
          {kind === "kanji" && (
            <>
              <p className="muted">Contains all selected components</p>
              <div className="radical-picker">
                {radicals.data?.items.map((item) => (
                  <button
                    key={item.key}
                    title={item.meaning}
                    aria-label={`Component ${item.glyph}`}
                    aria-pressed={components.includes(item.code)}
                    className={components.includes(item.code) ? "active" : ""}
                    onClick={() =>
                      setComponents((current) =>
                        current.includes(item.code)
                          ? current.filter((code) => code !== item.code)
                          : [...current, item.code],
                      )
                    }
                  >
                    {item.glyph}
                  </button>
                ))}
              </div>
            </>
          )}
        </section>
      )}
      {kind !== "words" && (
        <div className="personal-filters">
          <label>
            Familiarity
            <select
              aria-label="Filter by familiarity"
              value={rating}
              onChange={(event) => setRating(event.target.value)}
            >
              <option value="all">All characters</option>
              {RATING_LABELS.map((label, index) => (
                <option key={label} value={index}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={favoritesOnly}
              onChange={(event) => setFavoritesOnly(event.target.checked)}
            />
            Favorites only
          </label>
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={searchNotes}
              onChange={(event) => setSearchNotes(event.target.checked)}
            />
            Search my notes & edits
          </label>
        </div>
      )}
      <div className="results-toolbar">
        <span>
          <strong>{total.toLocaleString()}</strong>{" "}
          {kind === "words" ? "words" : "characters"}
          {term && <> matching “{term}”</>}
        </span>
        {kind !== "words" && (
          <div className="button-group">
            <button
              className="text-button"
              onClick={() => {
                setSelecting(!selecting);
                setSelected([]);
              }}
            >
              {selecting ? <X size={15} /> : <Check size={15} />}
              {selecting ? "Cancel selection" : "Select"}
            </button>
            <button
              className={`icon-button ${layout === "grid" ? "pressed" : ""}`}
              onClick={() => setLayout("grid")}
              aria-label="Grid view"
            >
              <Grid2X2 size={17} />
            </button>
            <button
              className={`icon-button ${layout === "list" ? "pressed" : ""}`}
              onClick={() => setLayout("list")}
              aria-label="List view"
            >
              <List size={19} />
            </button>
          </div>
        )}
      </div>
      <ErrorNotice message={result.error || actionError} />
      {result.loading ? (
        <Loading />
      ) : !total ? (
        <Empty title="A fresh place to look">
          Try a different reading or meaning, or clear a filter.
        </Empty>
      ) : kind === "words" ? (
        <div className="word-list">
          {words.data?.items.map((word) => (
            <WordRow key={word.id} word={word} />
          ))}
        </div>
      ) : (
        <div
          className={`character-grid ${layout === "list" ? "list-view" : ""}`}
        >
          {items.map((item) => (
            <CharacterCard
              key={item.key}
              item={item}
              selected={selected.includes(item.key)}
              onSelect={
                selecting
                  ? () =>
                      setSelected((current) =>
                        current.includes(item.key)
                          ? current.filter((key) => key !== item.key)
                          : [...current, item.key],
                      )
                  : undefined
              }
            />
          ))}
        </div>
      )}
      {selecting && (
        <div className="selection-bar">
          <span>{selected.length} selected</span>
          <button
            className="text-button"
            onClick={() => setSelected(items.map((item) => item.key))}
          >
            Select page
          </button>
          <button
            disabled={!selected.length}
            className="button secondary"
            onClick={() => onAddToSet(selected)}
          >
            Add to set
          </button>
          <button
            disabled={!selected.length}
            className="button"
            onClick={studyResults}
          >
            Study selected
          </button>
        </div>
      )}
      <div className="pagination">
        <span>
          {total
            ? `${page * pageSize + 1}–${Math.min((page + 1) * pageSize, total)} of ${total.toLocaleString()}`
            : "0 results"}
        </span>
        <div className="button-group">
          <button
            className="button secondary small"
            disabled={!page}
            onClick={() => setPage(page - 1)}
          >
            <ChevronLeft size={17} />
            Previous
          </button>
          <button
            className="button secondary small"
            disabled={(page + 1) * pageSize >= total}
            onClick={() => setPage(page + 1)}
          >
            Next
            <ChevronRight size={17} />
          </button>
        </div>
      </div>
    </div>
  );
}

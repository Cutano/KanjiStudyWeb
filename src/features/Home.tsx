import {
  ArrowDownLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  Flame,
  Layers,
  Pencil,
  Play,
  Sparkles,
  Target,
} from "lucide-react";
import type { CharacterSummary, StudyConfig } from "../domain/types";
import { catalog } from "../data/catalog";
import { useAsync } from "../lib/hooks";
import { useProfile } from "../state/useProfile";
import { getDailyNewAllowance, statistics } from "../domain/study";
import { CharacterCard, ErrorNotice, Loading } from "../components/common";
import { useState } from "react";

interface Props {
  onStudy: (items: CharacterSummary[], title: string) => void;
  onStart: (config: StudyConfig) => void;
}
export function Home({ onStudy, onStart }: Props) {
  const profile = useProfile();
  const stats = statistics(profile);
  const [error, setError] = useState("");
  const suggestions = useAsync(
    () =>
      catalog.getCharacters({
        kind: "kanji",
        system: profile.settings.system,
        level: 1,
        limit: 6,
      }),
    [profile.settings.system],
  );
  const progress = Math.min(
    100,
    (stats.todayReviews / profile.settings.dailyGoal) * 100,
  );
  const date = new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());
  async function guidedStudy() {
    try {
      const due = Object.entries(profile.progress)
        .filter(([, value]) => value.srs && value.srs.due <= Date.now())
        .sort((a, b) => a[1].srs!.due - b[1].srs!.due)
        .map(([key]) => key);
      const items = await catalog.getCharacters({
        kind: "kanji",
        system: profile.settings.system,
        limit: 8000,
      });
      const newItems = items.items
        .filter((item) => !profile.progress[item.key]?.reviews)
        .slice(0, getDailyNewAllowance(profile));
      const keys = [
        ...due,
        ...newItems.map((item) => item.key),
      ] as StudyConfig["keys"];
      if (!keys.length) {
        setError(
          "Everything is reviewed. Explore the library while your next review rests.",
        );
        return;
      }
      onStart({
        mode: "flashcards",
        keys,
        title: "Guided study",
        size: Math.min(keys.length, profile.settings.sessionSize),
        shuffle: false,
        repeatMistakes: true,
        prompt: "meaning",
        writingMode: "guided",
        guided: true,
      });
    } catch (reason) {
      setError((reason as Error).message);
    }
  }
  async function quickStudy(mode?: StudyConfig["mode"]) {
    try {
      const result = await catalog.getCharacters({
        kind: "kanji",
        system: profile.settings.system,
        level: 1,
        limit: 80,
      });
      if (mode)
        onStart({
          mode,
          keys: result.items.map((item) => item.key),
          title: "Grade 1 practice",
          size: profile.settings.sessionSize,
          shuffle: true,
          repeatMistakes: true,
          prompt: "meaning",
          writingMode: "guided",
          guided: false,
        });
      else onStudy(result.items, "Grade 1 practice");
    } catch (reason) {
      setError((reason as Error).message);
    }
  }
  return (
    <div className="page home-page">
      <div className="page-heading home-heading">
        <div>
          <p className="eyebrow">{date.toUpperCase()}</p>
          <h1>
            A little practice.
            <br />A world of meaning<span className="accent-dot">.</span>
          </h1>
          <p className="subtitle">
            Make room for Japanese, one character at a time.
          </p>
        </div>
        <div className="streak-pill">
          <Flame size={17} />
          <strong>{stats.streak}</strong> day streak
        </div>
      </div>
      <ErrorNotice message={error} />
      <div className="home-hero">
        <section className="daily-card">
          <div className="daily-card-content">
            <span className="light-eyebrow">
              <span className="live-dot" />
              YOUR DAILY PRACTICE
            </span>
            <h2>
              Small steps.
              <br />
              Lasting knowledge.
            </h2>
            <p>
              {stats.due
                ? `${stats.due} characters are ready for another visit.`
                : "A few thoughtful minutes can make all the difference."}
            </p>
            <button className="button cream" onClick={guidedStudy}>
              {stats.due ? "Start your review" : "Begin guided study"}
              <ArrowRight size={18} />
            </button>
            <span className="daily-meta">
              {stats.due} due for review <span>·</span> Up to{" "}
              {getDailyNewAllowance(profile)} new characters
            </span>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <span className="hero-character" lang="ja">
              学
            </span>
            <span className="hero-art-caption">まなぶ · to learn</span>
            <span className="art-seal">日々</span>
          </div>
        </section>
        <section className="goal-card">
          <div className="section-title">
            <span className="eyebrow">TODAY’S INTENTION</span>
            <Target size={18} />
          </div>
          <div
            className="goal-ring"
            style={{ "--progress": `${progress}%` } as React.CSSProperties}
          >
            <div>
              <strong>
                {stats.todayReviews}
                <small> / {profile.settings.dailyGoal}</small>
              </strong>
              <span>reviews completed</span>
            </div>
          </div>
          <p>
            {progress >= 100
              ? "A little effort, beautifully done."
              : "Every encounter is progress."}
          </p>
          <a href="#settings" className="text-button">
            Adjust your daily goal
            <ChevronRight size={15} />
          </a>
        </section>
      </div>
      <div className="overview-strip">
        <div>
          <span className="overview-icon">
            <BookOpen size={19} />
          </span>
          <div>
            <strong>{stats.studied}</strong>
            <span>characters explored</span>
          </div>
        </div>
        <div>
          <span className="overview-icon coral-bg">
            <Check size={19} />
          </span>
          <div>
            <strong>{stats.accuracy}%</strong>
            <span>overall accuracy</span>
          </div>
        </div>
        <div>
          <span className="overview-icon gold-bg">
            <Target size={19} />
          </span>
          <div>
            <strong>
              {Math.round(stats.todayTimeMs / 60000)} <small>min</small>
            </strong>
            <span>time well spent today</span>
          </div>
        </div>
      </div>
      {profile.savedSession && (
        <section className="resume-banner">
          <div>
            <span className="eyebrow">PICK UP WHERE YOU LEFT OFF</span>
            <h3>{profile.savedSession.config.title}</h3>
            <p>
              {profile.savedSession.index} of{" "}
              {profile.savedSession.queue.length} completed ·{" "}
              {profile.savedSession.config.mode}
            </p>
          </div>
          <button
            className="button secondary"
            onClick={() => onStart(profile.savedSession!.config)}
          >
            <Play size={17} />
            Resume session
          </button>
        </section>
      )}
      <section className="home-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">FIND YOUR RHYTHM</p>
            <h2>More ways to make it stick</h2>
          </div>
          <a href="#study" className="text-button">
            All practice modes
            <ArrowRight size={17} />
          </a>
        </div>
        <div className="practice-grid">
          <button
            className="practice-card"
            onClick={() => quickStudy("flashcards")}
          >
            <span className="practice-icon">
              <Layers size={23} />
            </span>
            <div>
              <h3>Flashcards</h3>
              <p>Meet a character. Make a connection.</p>
            </div>
            <ArrowUpRightIcon />
          </button>
          <button className="practice-card" onClick={() => quickStudy("quiz")}>
            <span className="practice-icon coral-bg">
              <Sparkles size={23} />
            </span>
            <div>
              <h3>Quick quiz</h3>
              <p>A little challenge for your memory.</p>
            </div>
            <ArrowUpRightIcon />
          </button>
          <button
            className="practice-card"
            onClick={() => quickStudy("writing")}
          >
            <span className="practice-icon gold-bg">
              <Pencil size={23} />
            </span>
            <div>
              <h3>Writing practice</h3>
              <p>Let your hand remember the way.</p>
            </div>
            <ArrowUpRightIcon />
          </button>
        </div>
      </section>
      <section className="home-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">START WITH THE EVERYDAY</p>
            <h2>Small characters, big ideas</h2>
          </div>
          <a href="#library" className="text-button">
            Explore the library
            <ArrowRight size={17} />
          </a>
        </div>
        {suggestions.loading ? (
          <Loading />
        ) : (
          <div className="character-grid home-character-grid">
            {suggestions.data?.items.map((item) => (
              <CharacterCard key={item.key} item={item} />
            ))}
          </div>
        )}
        <ErrorNotice message={suggestions.error} />
      </section>
      <div className="home-footer">
        <span lang="ja">継続は力なり</span>
        <p>Consistency is its own kind of strength.</p>
        <ArrowDownLeft size={20} />
      </div>
    </div>
  );
}
function ArrowUpRightIcon() {
  return (
    <svg
      className="practice-arrow"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <path d="M6 18 18 6M6 6h12v12" />
    </svg>
  );
}

export function StudyHub({ onStudy, onStart }: Props) {
  const profile = useProfile();
  const data = useAsync(
    () =>
      catalog.getCharacters({
        kind: "kanji",
        system: profile.settings.system,
        limit: 8000,
      }),
    [profile.settings.system],
  );
  const dueKeys = Object.entries(profile.progress)
    .filter(([, value]) => value.srs && value.srs.due <= Date.now())
    .map(([key]) => key);
  const study = (title: string, level?: number) =>
    onStudy(
      (data.data?.items || []).filter(
        (item) => level === undefined || item.level === level,
      ),
      title,
    );
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">YOUR DAILY RITUAL</p>
          <h1>
            Practice with intention<span className="accent-dot">.</span>
          </h1>
          <p className="subtitle">
            Choose what to learn. We’ll help you remember it.
          </p>
        </div>
      </div>
      <ErrorNotice message={data.error} />
      {data.loading ? (
        <Loading />
      ) : (
        <>
          <section className="guided-banner">
            <div>
              <p className="light-eyebrow">GUIDED STUDY</p>
              <h2>
                {dueKeys.length
                  ? `${dueKeys.length} characters are ready for review.`
                  : "Your next chapter starts here."}
              </h2>
              <p>Spaced reviews adapt to what you remember.</p>
            </div>
            <button
              className="button cream"
              onClick={() => {
                const newKeys = (data.data?.items || [])
                  .filter((item) => !profile.progress[item.key]?.reviews)
                  .slice(0, getDailyNewAllowance(profile))
                  .map((item) => item.key);
                const keys = [...dueKeys, ...newKeys] as StudyConfig["keys"];
                onStart({
                  mode: "flashcards",
                  keys,
                  title: "Guided study",
                  size: Math.min(keys.length, profile.settings.sessionSize),
                  shuffle: false,
                  repeatMistakes: true,
                  prompt: "meaning",
                  writingMode: "guided",
                  guided: true,
                });
              }}
            >
              Start guided study
              <ArrowRight size={18} />
            </button>
          </section>
          <section className="home-section">
            <h2>Build your own session</h2>
            <div className="study-groups">
              {Array.from(new Set(data.data?.items.map((item) => item.level)))
                .filter((level) => level > 0)
                .sort((a, b) => a - b)
                .map((level) => (
                  <button
                    className="study-group"
                    key={level}
                    onClick={() => study(`Group ${level}`, level)}
                  >
                    <span className="group-number">
                      {String(level).padStart(2, "0")}
                    </span>
                    <div>
                      <h3>Group {level}</h3>
                      <span>
                        {
                          data.data?.items.filter(
                            (item) => item.level === level,
                          ).length
                        }{" "}
                        characters
                      </span>
                    </div>
                    <ArrowRight size={18} />
                  </button>
                ))}
            </div>
            <div className="button-group spaced-top">
              <button
                className="button secondary"
                onClick={() => study("Complete kanji library")}
              >
                All kanji
              </button>
              <a className="button secondary" href="#library">
                Choose kana or radicals
              </a>
              <a className="button secondary" href="#sets">
                Practice a custom set
              </a>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

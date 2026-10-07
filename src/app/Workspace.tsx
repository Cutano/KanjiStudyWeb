import { useEffect, useState, type ReactNode } from "react";
import {
  BarChart3,
  BookOpen,
  BookOpenText,
  Check,
  ChevronRight,
  FolderHeart,
  Home as HomeIcon,
  Leaf,
  Menu,
  Search,
  Settings as SettingsIcon,
  Smartphone,
  Sparkles,
  WifiOff,
  X,
} from "lucide-react";
import type {
  CharacterKey,
  CharacterKind,
  CharacterSummary,
  StudyConfig,
} from "../domain/types";
import { useProfile } from "../state/useProfile";
import { useHashRoute } from "../lib/hooks";
import { appUrl } from "../lib/urls";
import { Home, StudyHub } from "../features/Home";
import { Library } from "../features/Library";
import { CharacterDetails, WordDetails } from "../features/Details";
import { SetDetails, SetPicker, Sets, Favorites } from "../features/Sets";
import { Reading } from "../features/Reading";
import { SentenceDetails } from "../features/SentenceDetails";
import { Progress } from "../features/Progress";
import { Settings } from "../features/Settings";
import { StudySetup } from "../features/study/StudySetup";
import { StudySession } from "../features/study/StudySession";
import "../features/study/study.css";
import "../features/dictionary.css";

const NAV = [
  { id: "home", label: "Overview", icon: HomeIcon },
  { id: "study", label: "Daily practice", icon: Sparkles },
  { id: "library", label: "Library", icon: BookOpen },
  { id: "reading", label: "Reading room", icon: BookOpenText },
  { id: "sets", label: "My collections", icon: FolderHeart },
  { id: "progress", label: "My progress", icon: BarChart3 },
];

function libraryKind(value: string | null): CharacterKind | "words" {
  return value === "words" ||
    value === "hiragana" ||
    value === "katakana" ||
    value === "radical"
    ? value
    : "kanji";
}

function searchKind(query: string): CharacterKind | "words" {
  if ([...query].length !== 1) return "words";
  if (/\p{Script=Hiragana}/u.test(query)) return "hiragana";
  if (/\p{Script=Katakana}/u.test(query)) return "katakana";
  return /\p{Script=Han}/u.test(query) ? "kanji" : "words";
}

export function Workspace({ onInstall }: { onInstall: () => void }) {
  const route = useHashRoute();
  const profile = useProfile();
  const [setup, setSetup] = useState<{
    items: CharacterSummary[];
    title: string;
  }>();
  const [session, setSession] = useState<StudyConfig>();
  const [setKeys, setSetKeys] = useState<CharacterKey[]>();
  const [mobileMenu, setMobileMenu] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [updateAvailable, setUpdateAvailable] =
    useState<ServiceWorkerRegistration>();
  const [search, setSearch] = useState("");
  const section = route.split("/")[0].split("?")[0];
  useEffect(() => {
    setMobileMenu(false);
    setSession(undefined);
    window.scrollTo(0, 0);
  }, [route]);
  useEffect(() => {
    const match = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        profile.settings.theme === "system"
          ? match.matches
            ? "dark"
            : "light"
          : profile.settings.theme;
      document.documentElement.dataset.fontSize = profile.settings.fontSize;
    };
    apply();
    match.addEventListener("change", apply);
    return () => match.removeEventListener("change", apply);
  }, [profile.settings.theme, profile.settings.fontSize]);
  useEffect(() => {
    const change = () => setOnline(navigator.onLine);
    window.addEventListener("online", change);
    window.addEventListener("offline", change);
    const shortcut = (event: KeyboardEvent) => {
      if (
        event.key === "/" &&
        !(event.target instanceof HTMLInputElement) &&
        !(event.target instanceof HTMLTextAreaElement)
      ) {
        event.preventDefault();
        document
          .querySelector<HTMLInputElement>(".global-search input")
          ?.focus();
      }
      if (event.key === "Escape") {
        setSetup(undefined);
        setSetKeys(undefined);
        setMobileMenu(false);
      }
    };
    window.addEventListener("keydown", shortcut);
    navigator.serviceWorker?.getRegistration().then((registration) => {
      if (!registration) return;
      if (registration.waiting) setUpdateAvailable(registration);
      registration.addEventListener("updatefound", () =>
        registration.installing?.addEventListener("statechange", () => {
          if (registration.waiting) setUpdateAvailable(registration);
        }),
      );
    });
    return () => {
      window.removeEventListener("online", change);
      window.removeEventListener("offline", change);
      window.removeEventListener("keydown", shortcut);
    };
  }, []);
  function begin(config: StudyConfig) {
    setSetup(undefined);
    setSession(config);
  }
  const props = {
    onStudy: (items: CharacterSummary[], title: string) =>
      setSetup({ items, title }),
    onAddToSet: setSetKeys,
  };
  let content: ReactNode;
  if (section === "character")
    content = (
      <CharacterDetails
        key={route}
        characterKey={
          decodeURIComponent(route.slice("character/".length)) as CharacterKey
        }
        {...props}
      />
    );
  else if (section === "word")
    content = <WordDetails key={route} id={+route.slice("word/".length)} />;
  else if (section === "sentence")
    content = (
      <SentenceDetails key={route} id={+route.slice("sentence/".length)} />
    );
  else if (section === "set")
    content = (
      <SetDetails key={route} id={route.slice("set/".length)} {...props} />
    );
  else if (section === "library")
    content = (
      <Library
        key={route}
        initialKind={libraryKind(
          new URLSearchParams(route.split("?")[1]).get("tab"),
        )}
        initialQuery={new URLSearchParams(route.split("?")[1]).get("q") || ""}
        {...props}
      />
    );
  else if (section === "study")
    content = <StudyHub {...props} onStart={begin} />;
  else if (section === "reading") content = <Reading />;
  else if (section === "sets") content = <Sets {...props} />;
  else if (section === "favorites") content = <Favorites {...props} />;
  else if (section === "progress")
    content = <Progress onAddToSet={setSetKeys} />;
  else if (section === "settings") content = <Settings onInstall={onInstall} />;
  else content = <Home {...props} onStart={begin} />;
  return (
    <div className="workspace">
      <a
        href="#main-content"
        className="skip-link"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Skip to main content
      </a>
      {mobileMenu && (
        <div className="sidebar-scrim" onClick={() => setMobileMenu(false)} />
      )}
      <aside
        id="study-navigation"
        className={`sidebar ${mobileMenu ? "is-open" : ""}`}
      >
        <a href="#home" className="brand" onClick={() => setSession(undefined)}>
          <img src={appUrl("icon.svg")} alt="" />
          <span>
            kanji<span className="brand-weight">study</span>
            <small>WEB</small>
          </span>
        </a>
        <div className="sidebar-label">YOUR STUDY SPACE</div>
        <nav aria-label="Main navigation">
          {NAV.map((item) => (
            <a
              className={
                section === item.id ||
                (item.id === "library" &&
                  ["character", "word", "sentence"].includes(section)) ||
                (item.id === "sets" && ["set", "favorites"].includes(section))
                  ? "active"
                  : ""
              }
              href={`#${item.id}`}
              key={item.id}
              onClick={() => setSession(undefined)}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
              {item.id === "study" && <span className="nav-dot" />}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-quote">
            <Leaf size={22} />
            <p>
              A little, every day.
              <br />
              It all adds up.
            </p>
            <span lang="ja">一歩ずつ</span>
          </div>
          <button className="install-sidebar" onClick={onInstall}>
            <Smartphone size={17} />
            <span>Take it with you</span>
            <ChevronRight size={15} />
          </button>
          <a
            href="#settings"
            className={`settings-link ${section === "settings" ? "active" : ""}`}
          >
            <SettingsIcon size={19} />
            Settings & backup
          </a>
          <div className="offline-status">
            <span className="live-dot" />
            {online ? "Your library is ready offline" : "Learning offline"}
          </div>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="topbar">
          <button
            aria-label="Open navigation"
            aria-expanded={mobileMenu}
            aria-controls="study-navigation"
            className="icon-button mobile-menu-button"
            onClick={() => setMobileMenu(!mobileMenu)}
          >
            {mobileMenu ? <X /> : <Menu />}
          </button>
          <div className="breadcrumb">
            Your study space
            <ChevronRight size={13} />
            <span>
              {NAV.find((item) => item.id === section)?.label ||
                (
                  {
                    character: "Character",
                    word: "Dictionary",
                    sentence: "Example sentence",
                    set: "Collection",
                    favorites: "Favorites",
                    settings: "Settings",
                  } as Record<string, string>
                )[section] ||
                "Overview"}
            </span>
          </div>
          <form
            className="global-search"
            onSubmit={(event) => {
              event.preventDefault();
              location.hash = `library?tab=${searchKind(search.trim())}&q=${encodeURIComponent(search.trim())}`;
            }}
          >
            <Search size={17} />
            <input
              aria-label="Search Japanese"
              placeholder="A character, a word, a meaning…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <kbd>/</kbd>
          </form>
          <span className="topbar-status" title="Offline library installed">
            {online ? <Check size={15} /> : <WifiOff size={15} />}
            <span>Offline ready</span>
          </span>
        </header>
        {updateAvailable && !session && (
          <div className="update-banner">
            <span>A new version is ready. Your progress is safely saved.</span>
            <button
              className="text-button"
              onClick={() => {
                navigator.serviceWorker.addEventListener(
                  "controllerchange",
                  () => location.reload(),
                  { once: true },
                );
                updateAvailable.waiting?.postMessage("ACTIVATE_UPDATE");
              }}
            >
              Update app
            </button>
          </div>
        )}
        <main id="main-content" tabIndex={-1}>
          {session ? (
            <StudySession
              config={session}
              onExit={() => setSession(undefined)}
            />
          ) : (
            content
          )}
        </main>
        <footer className="app-footer">
          <span>Kanji Study Web</span>
          <span>Made for a lifetime of learning.</span>
          <a href="#settings">Sources & acknowledgments</a>
        </footer>
      </div>
      {setup && (
        <StudySetup
          items={setup.items}
          title={setup.title}
          onStart={begin}
          onClose={() => setSetup(undefined)}
        />
      )}
      {setKeys && (
        <SetPicker keys={setKeys} onClose={() => setSetKeys(undefined)} />
      )}
    </div>
  );
}

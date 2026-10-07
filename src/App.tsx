import {
  Component,
  useEffect,
  useRef,
  useState,
  type ErrorInfo,
  type ReactNode,
} from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  CloudOff,
  Download,
  Smartphone,
} from "lucide-react";
import type { InstallProgress } from "./domain/types";
import { catalog } from "./data/catalog";
import { initializeProfile } from "./state/profile";
import { prepareAppShell, requestDurableStorage } from "./lib/pwa";
import { ErrorNotice, Loading, Modal } from "./components/common";
import { Workspace } from "./app/Workspace";
import { appUrl } from "./lib/urls";

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
export default function App() {
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [installing, setInstalling] = useState(false);
  const cancelled = useRef(false);
  const [progress, setProgress] = useState<InstallProgress>();
  const [error, setError] = useState("");
  const [installHelp, setInstallHelp] = useState(false);
  const [prompt, setPrompt] = useState<InstallPromptEvent>();
  useEffect(() => {
    const beforeInstall = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", beforeInstall);
    let active = true;
    (async () => {
      await initializeProfile();
      if (await catalog.isInstalled()) {
        await prepareAppShell();
        await catalog.initialize(setProgress);
        if (active) setReady(true);
      }
    })()
      .catch((reason: Error) => {
        if (active) setError(reason.message);
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
      window.removeEventListener("beforeinstallprompt", beforeInstall);
    };
  }, []);
  async function initialize() {
    cancelled.current = false;
    setInstalling(true);
    setError("");
    try {
      await initializeProfile();
      await prepareAppShell();
      await requestDurableStorage();
      if (cancelled.current) return;
      await catalog.initialize(setProgress);
      if (!cancelled.current) setReady(true);
    } catch (reason) {
      if (!cancelled.current) setError((reason as Error).message);
    } finally {
      setInstalling(false);
    }
  }
  async function install() {
    if (prompt) {
      await prompt.prompt();
      await prompt.userChoice;
      setPrompt(undefined);
    } else setInstallHelp(true);
  }
  return (
    <AppBoundary>
      {ready ? (
        <Workspace onInstall={install} />
      ) : (
        <div className="welcome">
          <a href="#" className="brand">
            <img src={appUrl("icon.svg")} alt="" />
            <span>
              kanji<span className="brand-weight">study</span>
              <small>WEB</small>
            </span>
          </a>
          <div className="welcome-layout">
            <div className="welcome-copy">
              <p className="eyebrow">A QUIETER WAY TO LEARN JAPANESE</p>
              <h1>
                One character.
                <br />A thousand
                <br />
                <em>possibilities.</em>
              </h1>
              <p className="welcome-description">
                Your complete Japanese library, a thoughtful daily practice, and
                a little space to grow. All yours. All offline.
              </p>
              <div className="welcome-facts">
                <span>
                  <Check size={17} />
                  7,045 kanji
                </span>
                <span>
                  <Check size={17} />
                  214,894 words
                </span>
                <span>
                  <Check size={17} />
                  8,132 audio clips
                </span>
              </div>
              <div className="install-card">
                {checking ? (
                  <Loading label="Opening your study space…" />
                ) : (
                  <>
                    <div className="install-card-title">
                      <Download size={21} />
                      <div>
                        <strong>
                          {installing
                            ? progress?.phase || "Preparing your offline space…"
                            : "Take your entire library with you"}
                        </strong>
                        <p>
                          {installing
                            ? `${((progress?.bytes || 0) / 1_000_000).toFixed(1)} / ${((progress?.totalBytes || 149300000) / 1_000_000).toFixed(1)} MB`
                            : "A one-time download of about 150 MB. No account needed."}
                        </p>
                      </div>
                    </div>
                    {installing ? (
                      <div className="download-progress">
                        <div
                          role="progressbar"
                          aria-label="Library download progress"
                          aria-valuenow={Math.round(
                            ((progress?.bytes || 0) /
                              (progress?.totalBytes || 1)) *
                              100,
                          )}
                          style={{
                            width: `${Math.max(2, ((progress?.bytes || 0) / (progress?.totalBytes || 1)) * 100)}%`,
                          }}
                        />
                      </div>
                    ) : (
                      <button className="button full" onClick={initialize}>
                        {error
                          ? "Retry download & start learning"
                          : "Download & start learning"}
                        <ArrowRight size={18} />
                      </button>
                    )}
                    <ErrorNotice message={error} />
                    {installing && (
                      <button
                        className="text-button"
                        onClick={() => {
                          cancelled.current = true;
                          catalog.cancelInstall();
                        }}
                      >
                        Cancel download
                      </button>
                    )}
                    <button
                      className="text-button install-first"
                      onClick={install}
                    >
                      <Smartphone size={16} />
                      Install on your home screen first
                      <ChevronRight size={15} />
                    </button>
                  </>
                )}
              </div>
              <p className="welcome-footnote">
                <CloudOff size={15} />
                After setup, your library and progress work without a
                connection.
              </p>
            </div>
            <div className="welcome-art" aria-hidden="true">
              <span className="welcome-japanese">学</span>
              <span className="vertical-script">毎日、少しずつ。</span>
              <div className="welcome-caption">
                <span>まなぶ</span>
                <p>to learn; to study</p>
                <small>A small beginning, every day.</small>
              </div>
              <div className="welcome-seal">学習</div>
            </div>
          </div>
          <footer className="welcome-footer">
            <span>Built for curiosity. Designed for everyday life.</span>
            <span>PRIVATE BY NATURE · OPEN SOURCE</span>
          </footer>
        </div>
      )}
      {installHelp && (
        <Modal
          title="A little space on your home screen"
          onClose={() => setInstallHelp(false)}
        >
          <div className="install-instructions">
            <Smartphone size={35} />
            <h3>iPhone & iPad</h3>
            <p>
              Open this website in Safari, tap <strong>Share</strong>, then{" "}
              <strong>Add to Home Screen</strong>. Open the installed app and
              download the library there.
            </p>
            <h3>Android</h3>
            <p>
              Open the browser menu and choose <strong>Install app</strong> or{" "}
              <strong>Add to Home screen</strong>.
            </p>
            <h3>Desktop</h3>
            <p>
              Use the install icon in the browser address bar. You can also keep
              learning in your browser.
            </p>
            <p className="muted">
              The website must use HTTPS (or localhost for development).
              Installed and browser storage may be separate on iOS.
            </p>
            <button
              className="button full"
              onClick={() => setInstallHelp(false)}
            >
              Got it
            </button>
          </div>
        </Modal>
      )}
    </AppBoundary>
  );
}

class AppBoundary extends Component<
  { children: ReactNode },
  { error: string }
> {
  state = { error: "" };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Application error", error, info.componentStack);
  }
  render() {
    return this.state.error ? (
      <div className="fatal-error">
        <BookOpen size={36} />
        <h1>Let’s reopen your study space.</h1>
        <p>Your saved progress is kept on this device.</p>
        <ErrorNotice message={this.state.error} />
        <button className="button" onClick={() => location.reload()}>
          Reload the app
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}

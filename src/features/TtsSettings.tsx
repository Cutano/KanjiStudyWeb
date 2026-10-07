import { useEffect, useState, type FormEvent } from "react";
import { Check, HardDrive, KeyRound, Save, Trash2 } from "lucide-react";
import { ErrorNotice } from "../components/common";
import {
  DEFAULT_TTS_SETTINGS,
  getTtsSettings,
  saveTtsSettings,
  type TtsSettings as SpeechSettings,
} from "../lib/tts-settings";
import {
  clearTtsCache,
  getTtsCacheStats,
  MAX_TTS_CACHE_BYTES,
  MAX_TTS_CACHE_ENTRIES,
} from "../lib/tts-cache";
import "./tts-settings.css";

const VOICES = [
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "fable",
  "nova",
  "onyx",
  "sage",
  "shimmer",
  "verse",
  "marin",
  "cedar",
];

function megabytes(bytes: number) {
  if (bytes === 0) return "0";
  return (bytes / 1_000_000).toLocaleString(undefined, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

export function TtsSettings() {
  const [settings, setSettings] =
    useState<SpeechSettings>(DEFAULT_TTS_SETTINGS);
  const [saved, setSaved] = useState<SpeechSettings>(DEFAULT_TTS_SETTINGS);
  const [cache, setCache] = useState<{ count: number; bytes: number }>();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    getTtsSettings()
      .then((value) => {
        if (!active) return;
        setSettings(value);
        setSaved(value);
        setReady(true);
      })
      .catch((reason: Error) => {
        if (active) setError(reason.message);
      });
    function refreshCache() {
      getTtsCacheStats()
        .then((value) => {
          if (active) setCache(value);
        })
        .catch((reason: Error) => {
          if (active) setError(reason.message);
        });
    }
    refreshCache();
    window.addEventListener("focus", refreshCache);
    return () => {
      active = false;
      window.removeEventListener("focus", refreshCache);
    };
  }, []);

  function edit(
    field: Exclude<keyof SpeechSettings, "enabled">,
    value: string,
  ) {
    setSettings((previous) => ({ ...previous, [field]: value }));
    setMessage("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await saveTtsSettings(settings);
      const next = await getTtsSettings();
      setSettings(next);
      setSaved(next);
      setMessage("AI speech settings saved.");
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleSpeech() {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const next = { ...(await getTtsSettings()), enabled: !saved.enabled };
      await saveTtsSettings(next);
      setSaved(next);
      setSettings((previous) => ({ ...previous, enabled: next.enabled }));
      setMessage(
        next.enabled
          ? "AI speech preference saved. A configured API key is required."
          : "AI speech disabled. Missing recordings use browser speech.",
      );
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function removeKey() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const next = { ...(await getTtsSettings()), apiKey: "" };
      await saveTtsSettings(next);
      setSaved(next);
      setSettings((previous) => ({ ...previous, apiKey: "" }));
      setMessage("API key removed. AI speech is disabled.");
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function clearAudio() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await clearTtsCache();
      setCache(await getTtsCacheStats());
      setMessage("Generated audio cleared.");
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="settings-section tts-settings"
      aria-labelledby="tts-heading"
    >
      <div>
        <h2 id="tts-heading">AI speech</h2>
        <p>
          Native recordings play first. When a recording is missing, use your AI
          speech provider if enabled and configured, or your browser’s voice.
        </p>
        <p>
          AI speech is a generated voice. Requests go directly to the provider
          you choose and may use paid API credits.
        </p>
      </div>
      <form
        className="settings-fields tts-fields"
        onSubmit={save}
        autoComplete="off"
      >
        <div className="tts-enable-row">
          <span>Enable AI speech</span>
          <button
            type="button"
            role="switch"
            className="tts-enable-switch"
            aria-label="Enable AI speech"
            aria-describedby="tts-enable-help"
            aria-checked={saved.enabled}
            disabled={!ready}
            aria-disabled={!ready || busy}
            onClick={toggleSpeech}
          >
            <span aria-hidden="true" />
          </button>
        </div>
        <p id="tts-enable-help" className="muted small-text tts-field-help">
          Changes apply immediately. Turn off to use browser speech while
          keeping your API settings and generated audio cache.
        </p>
        <div className="tts-connection-state">
          <KeyRound size={17} aria-hidden="true" />
          <span>
            {!ready
              ? "Loading speech settings…"
              : saved.enabled && saved.apiKey
                ? "AI speech enabled"
                : "Browser voice fallback"}
          </span>
        </div>
        <ErrorNotice message={error} />
        {message && (
          <div role="status" className="notice success">
            <Check size={18} aria-hidden="true" />
            {message}
          </div>
        )}
        <label className="tts-field">
          Speech API endpoint
          <input
            type="url"
            value={settings.endpoint}
            onChange={(event) => edit("endpoint", event.target.value)}
            placeholder={DEFAULT_TTS_SETTINGS.endpoint}
            disabled={!ready || busy}
            required
            spellCheck={false}
            autoCapitalize="none"
            aria-describedby="tts-endpoint-help"
          />
        </label>
        <p id="tts-endpoint-help" className="muted small-text tts-field-help">
          Use the full OpenAI-compatible audio/speech URL. Your provider must
          allow requests from this website (CORS).
        </p>
        <label className="tts-field">
          API key
          <input
            type="password"
            value={settings.apiKey}
            onChange={(event) => edit("apiKey", event.target.value)}
            placeholder="Enter your API key"
            disabled={!ready || busy}
            autoComplete="off"
            spellCheck={false}
            autoCapitalize="none"
            aria-describedby="tts-key-help"
          />
        </label>
        <p id="tts-key-help" className="muted small-text tts-field-help">
          Saved only in this browser and excluded from study backups. Save the
          endpoint and key together to apply your changes. Leave the key empty
          to use browser speech.
        </p>
        <div className="tts-model-fields">
          <label className="tts-field">
            Model
            <input
              value={settings.model}
              onChange={(event) => edit("model", event.target.value)}
              disabled={!ready || busy}
              required
              spellCheck={false}
              autoCapitalize="none"
            />
          </label>
          <label className="tts-field">
            Voice
            <input
              list="tts-voices"
              value={settings.voice}
              onChange={(event) => edit("voice", event.target.value)}
              disabled={!ready || busy}
              required
              spellCheck={false}
              autoCapitalize="none"
            />
            <datalist id="tts-voices">
              {VOICES.map((voice) => (
                <option key={voice} value={voice} />
              ))}
            </datalist>
          </label>
        </div>
        <div className="button-group wrap">
          <button className="button" type="submit" disabled={!ready || busy}>
            <Save size={16} aria-hidden="true" />
            Save AI speech settings
          </button>
          <button
            className="button secondary"
            type="button"
            onClick={removeKey}
            disabled={!ready || busy || !saved.apiKey}
          >
            <KeyRound size={16} aria-hidden="true" />
            Clear API key
          </button>
        </div>
        <div className="tts-cache">
          <div className="tts-cache-heading">
            <HardDrive size={20} aria-hidden="true" />
            <div>
              <strong>Generated audio cache</strong>
              <p>
                {cache
                  ? `${cache.count} / ${MAX_TTS_CACHE_ENTRIES} clips · ${megabytes(cache.bytes)} / ${MAX_TTS_CACHE_BYTES / 1_000_000} MB`
                  : "Loading cache usage…"}
              </p>
            </div>
          </div>
          <meter
            aria-label="Generated audio cache usage"
            min={0}
            max={MAX_TTS_CACHE_BYTES}
            value={cache?.bytes ?? 0}
          />
          <p className="muted small-text">
            With AI speech enabled, repeated playback reuses saved audio,
            including offline. Up to 10 clips and 50 MB are kept; the least
            recently played clips are removed when the cache is full.
          </p>
          <button
            className="text-button"
            type="button"
            onClick={clearAudio}
            disabled={busy || !cache?.count}
          >
            <Trash2 size={15} aria-hidden="true" />
            Clear generated audio
          </button>
        </div>
      </form>
    </section>
  );
}

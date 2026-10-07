import { useRef, useState, type ChangeEvent } from "react";
import {
  Check,
  Download,
  FolderInput,
  HardDrive,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Trash2,
  Upload,
} from "lucide-react";
import { useProfile } from "../state/useProfile";
import {
  exportBackup,
  importBackup,
  importExtension,
  updateProfile,
} from "../state/profile";
import { createDefaultProfile } from "../domain/study";
import type {
  InstallProgress,
  Settings as SettingsType,
} from "../domain/types";
import { downloadFile } from "../lib/files";
import { SYSTEMS } from "../lib/constants";
import { useAsync } from "../lib/hooks";
import { ErrorNotice } from "../components/common";
import { catalog } from "../data/catalog";
import { appUrl } from "../lib/urls";
import { requestDurableStorage } from "../lib/pwa";
import { TtsSettings } from "./TtsSettings";

export function Settings({ onInstall }: { onInstall: () => void }) {
  const profile = useProfile();
  const backupInput = useRef<HTMLInputElement>(null);
  const extensionInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [download, setDownload] = useState<InstallProgress>();
  const storage = useAsync(
    async () => ({
      estimate: await navigator.storage?.estimate(),
      persisted: await navigator.storage?.persisted(),
    }),
    [message],
  );
  async function setting<Key extends keyof SettingsType>(
    key: Key,
    value: SettingsType[Key],
  ) {
    try {
      await updateProfile((draft) => {
        draft.settings[key] = value;
      });
    } catch (reason) {
      setError((reason as Error).message);
    }
  }
  async function readImport(
    event: ChangeEvent<HTMLInputElement>,
    kind: "backup" | "extension",
  ) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    setMessage("");
    try {
      if (file.size > 50 * 1024 * 1024)
        throw new Error("This file is larger than the 50 MB import limit.");
      const text = await file.text();
      if (kind === "backup") {
        if (
          !confirm(
            "Restore this backup? It will replace this browser’s study profile. Export your current progress first if you want to keep it.",
          )
        )
          return;
        await importBackup(text);
      } else await importExtension(text);
      setMessage(
        kind === "backup"
          ? "Your study profile has been restored."
          : "Your extension is ready to explore offline.",
      );
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      event.target.value = "";
    }
  }
  function reminderCalendar() {
    const [hour, minute] = (profile.settings.reminderTime || "19:00").split(
      ":",
    );
    const date = new Date();
    const day = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
    const content = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Kanji Study Web//Study Reminder//EN",
      "BEGIN:VEVENT",
      `UID:${crypto.randomUUID()}@kanji-study-web`,
      `DTSTAMP:${new Date()
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d+Z$/, "Z")}`,
      `DTSTART:${day}T${hour}${minute}00`,
      "DURATION:PT10M",
      "RRULE:FREQ=DAILY",
      "SUMMARY:A little Japanese practice",
      "DESCRIPTION:Open Kanji Study Web for your daily review.",
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      "DESCRIPTION:Time for a little Japanese practice",
      "TRIGGER:PT0M",
      "END:VALARM",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    downloadFile("kanji-study-reminder.ics", content, "text/calendar");
    setMessage(
      "Import the calendar file into your device calendar to enable a daily reminder.",
    );
  }
  async function updateCatalog() {
    setBusy(true);
    setError("");
    try {
      const changed = await catalog.downloadUpdate(setDownload);
      setMessage(
        changed
          ? "A new library is installed. Reload to open it; your progress is preserved."
          : "Your offline library is up to date.",
      );
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page settings-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">A SPACE THAT FITS YOU</p>
          <h1>
            Make yourself at home<span className="accent-dot">.</span>
          </h1>
          <p className="subtitle">
            Your learning, your preferences. Saved on this device.
          </p>
        </div>
      </div>
      <ErrorNotice message={error} />
      {message && (
        <div role="status" className="notice success">
          <Check size={18} />
          {message}
        </div>
      )}
      <section className="settings-section">
        <div>
          <h2>Look & feel</h2>
          <p>Make your study space comfortable.</p>
        </div>
        <div className="settings-fields">
          <label>
            Appearance
            <select
              value={profile.settings.theme}
              onChange={(event) =>
                setting("theme", event.target.value as SettingsType["theme"])
              }
            >
              <option value="system">Follow device</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          <label>
            Text size
            <select
              value={profile.settings.fontSize}
              onChange={(event) =>
                setting(
                  "fontSize",
                  event.target.value as SettingsType["fontSize"],
                )
              }
            >
              <option value="normal">Comfortable</option>
              <option value="large">Larger</option>
            </select>
          </label>
          <label>
            Default study sequence
            <select
              value={profile.settings.system}
              onChange={(event) =>
                setting("system", event.target.value as SettingsType["system"])
              }
            >
              {SYSTEMS.map((system) => (
                <option value={system.value} key={system.value}>
                  {system.label}
                </option>
              ))}
            </select>
          </label>
          <label className="switch-row">
            Show furigana
            <input
              type="checkbox"
              checked={profile.settings.showFurigana}
              onChange={(event) =>
                setting("showFurigana", event.target.checked)
              }
            />
          </label>
        </div>
      </section>
      <section className="settings-section">
        <div>
          <h2>Your daily rhythm</h2>
          <p>Keep the workload realistic and the habit enjoyable.</p>
        </div>
        <div className="settings-fields">
          <label>
            Daily review goal
            <select
              value={profile.settings.dailyGoal}
              onChange={(event) => setting("dailyGoal", +event.target.value)}
            >
              {[5, 10, 20, 30, 50, 100].map((number) => (
                <option key={number} value={number}>
                  {number} reviews
                </option>
              ))}
            </select>
          </label>
          <label>
            Characters per session
            <select
              value={profile.settings.sessionSize}
              onChange={(event) => setting("sessionSize", +event.target.value)}
            >
              {[5, 10, 15, 20, 30, 50, 100].map((number) => (
                <option key={number} value={number}>
                  {number} characters
                </option>
              ))}
            </select>
          </label>
          <label>
            New characters per day
            <select
              value={profile.settings.newPerDay}
              onChange={(event) => setting("newPerDay", +event.target.value)}
            >
              {[0, 3, 5, 10, 15, 20].map((number) => (
                <option key={number} value={number}>
                  {number} new characters
                </option>
              ))}
            </select>
          </label>
          <label>
            Stroke animation speed
            <select
              value={profile.settings.strokeSpeed}
              onChange={(event) => setting("strokeSpeed", +event.target.value)}
            >
              <option value="0.5">Thoughtful · 0.5×</option>
              <option value="1">Natural · 1×</option>
              <option value="1.5">Quick · 1.5×</option>
              <option value="2">Brisk · 2×</option>
            </select>
          </label>
          <label className="switch-row">
            Play available native audio automatically
            <input
              type="checkbox"
              checked={profile.settings.autoplayAudio}
              onChange={(event) =>
                setting("autoplayAudio", event.target.checked)
              }
            />
          </label>
          <label>
            Daily reminder
            <input
              type="time"
              value={profile.settings.reminderTime}
              onChange={(event) => setting("reminderTime", event.target.value)}
            />
          </label>
          <p className="muted small-text">
            For a reliable reminder while this offline app is closed, add it to
            your device calendar.
          </p>
          <button
            className="button secondary"
            onClick={reminderCalendar}
            disabled={!profile.settings.reminderTime}
          >
            <Download size={16} />
            Add calendar reminder
          </button>
        </div>
      </section>
      <TtsSettings />
      <section className="settings-section">
        <div>
          <h2>Your progress belongs to you</h2>
          <p>Back up your profile or move it to another device.</p>
        </div>
        <div className="settings-fields">
          <div className="backup-info">
            <ShieldCheck size={25} />
            <p>
              Backups include study history, ratings, notes, custom sets,
              settings, and imported extensions. Dictionary files, AI speech
              credentials, and generated audio stay separate.
            </p>
          </div>
          <div className="button-group wrap">
            <button
              className="button"
              onClick={() =>
                downloadFile(
                  `kanji-study-backup-${new Date().toISOString().slice(0, 10)}.json`,
                  exportBackup(),
                )
              }
            >
              <Download size={17} />
              Export backup
            </button>
            <button
              className="button secondary"
              onClick={() => backupInput.current?.click()}
            >
              <Upload size={17} />
              Restore backup
            </button>
          </div>
          <input
            hidden
            ref={backupInput}
            type="file"
            accept="application/json,.json"
            aria-label="Import backup file"
            onChange={(event) => readImport(event, "backup")}
          />
          <p className="muted small-text">
            Browser data can be removed by device cleanup. Keep a backup
            somewhere you trust.
          </p>
        </div>
      </section>
      <section className="settings-section">
        <div>
          <h2>Room for more</h2>
          <p>
            Bring authorized reading sets and character explanations into your
            library.
          </p>
        </div>
        <div className="settings-fields">
          <button
            className="button secondary"
            onClick={() => extensionInput.current?.click()}
          >
            <FolderInput size={17} />
            Import extension pack
          </button>
          <input
            hidden
            type="file"
            ref={extensionInput}
            accept="application/json,.json"
            aria-label="Import extension file"
            onChange={(event) => readImport(event, "extension")}
          />
          <p className="muted small-text">
            Use the documented Kanji Study Web JSON format. Original app
            purchases are not included. Imported text is available offline.
          </p>
          {profile.extensions.map((pack) => (
            <div className="extension-item" key={pack.id}>
              <div>
                <strong>{pack.name}</strong>
                <p>
                  {pack.author} · {pack.license}
                </p>
                <small>
                  {pack.readings.length} readings · {pack.entries.length}{" "}
                  character explanations
                </small>
              </div>
              <button
                aria-label={`Export ${pack.name}`}
                className="icon-button"
                onClick={() =>
                  downloadFile(`${pack.id}.json`, JSON.stringify(pack, null, 2))
                }
              >
                <Download size={16} />
              </button>
              <button
                aria-label={`Remove ${pack.name}`}
                className="icon-button"
                onClick={() => {
                  if (confirm(`Remove ${pack.name} from this device?`))
                    updateProfile((draft) => {
                      draft.extensions = draft.extensions.filter(
                        (item) => item.id !== pack.id,
                      );
                    }).catch((reason: Error) => setError(reason.message));
                }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </section>
      <section className="settings-section">
        <div>
          <h2>Ready wherever you are</h2>
          <p>
            Your entire library, including native word audio, stays on this
            device.
          </p>
        </div>
        <div className="settings-fields">
          <div className="storage-status">
            <HardDrive size={22} />
            <div>
              <strong>Offline library installed</strong>
              <span>
                {storage.data?.estimate?.usage
                  ? `${Math.round(storage.data.estimate.usage / 1024 / 1024)} MB used on this origin`
                  : "Storage usage unavailable"}{" "}
                ·{" "}
                {storage.data?.persisted
                  ? "Persistent storage granted"
                  : "Standard browser storage"}
              </span>
            </div>
          </div>
          <div className="button-group wrap">
            <button className="button secondary" onClick={onInstall}>
              <Smartphone size={17} />
              Install app
            </button>
            <button
              className="button secondary"
              onClick={() =>
                requestDurableStorage()
                  .then((granted) =>
                    setMessage(
                      granted
                        ? "Persistent storage has been granted."
                        : "Your browser manages storage automatically. Keep a recent backup.",
                    ),
                  )
                  .catch((reason: Error) => setError(reason.message))
              }
            >
              Protect offline storage
            </button>
            <button
              className="button secondary"
              onClick={updateCatalog}
              disabled={busy}
            >
              <RefreshCw size={17} className={busy ? "spin" : ""} />
              Check library updates
            </button>
          </div>
          {busy && (
            <p role="status">
              {download?.phase}{" "}
              {download?.totalBytes
                ? Math.round((download.bytes / download.totalBytes) * 100)
                : 0}
              %
            </p>
          )}
          <button
            className="text-button"
            onClick={async () => {
              if (
                confirm(
                  "Remove the downloaded dictionary and audio? Your study profile stays on this device. You will need a connection to download the library again.",
                )
              ) {
                try {
                  await catalog.removeCatalog();
                  location.reload();
                } catch (reason) {
                  setError((reason as Error).message);
                }
              }
            }}
          >
            Remove downloaded library
          </button>
          <p className="muted small-text">
            On iPhone and iPad, install from Safari’s Share menu, then download
            the library inside the installed app.
          </p>
        </div>
      </section>
      <section className="settings-section">
        <div>
          <h2>Acknowledgments</h2>
          <p>Built on years of generous language research.</p>
        </div>
        <div className="settings-fields sources">
          <p>
            <strong>Kanji Study Web</strong> · Independent web implementation ·
            Code licensed under LGPL-3.0-or-later.
          </p>
          <p>
            Dictionary:{" "}
            <a
              href="https://www.edrdg.org/edrdg/licence.html"
              target="_blank"
              rel="noreferrer"
            >
              EDRDG / WWWJDIC
            </a>{" "}
            (CC BY-SA 4.0). Stroke data:{" "}
            <a
              href="https://kanjivg.tagaini.net/"
              target="_blank"
              rel="noreferrer"
            >
              KanjiVG
            </a>{" "}
            (CC BY-SA 3.0). Example sentences:{" "}
            <a href="https://tatoeba.org/" target="_blank" rel="noreferrer">
              Tatoeba
            </a>{" "}
            (CC BY 2.0 attribution observed in the source app). JLPT material:
            Tanos (CC BY 2.0). Native word audio:{" "}
            <a
              href="https://github.com/kanjialive/kanji-data-media"
              target="_blank"
              rel="noreferrer"
            >
              Kanji alive
            </a>{" "}
            (CC BY 4.0).
          </p>
          <div className="button-group wrap">
            <a
              href={appUrl("licenses/LGPL-3.0.txt")}
              className="text-button"
              target="_blank"
            >
              Code license
            </a>
            <a
              href={appUrl("licenses/THIRD-PARTY-NOTICES.txt")}
              className="text-button"
              target="_blank"
            >
              Offline data notices
            </a>
            <a
              href={appUrl("licenses/DEPENDENCY-LICENSES.txt")}
              className="text-button"
              target="_blank"
            >
              Dependency licenses
            </a>
          </div>
          <p className="small-text muted">
            The supplied database is a user-provided snapshot. Textbook sequence
            permissions and original add-on content retain their own terms. This
            project is not affiliated with the original Android developer.
            External source links require a connection.
          </p>
        </div>
      </section>
      <section className="settings-section danger-zone">
        <div>
          <h2>Start fresh</h2>
          <p>Export a backup before removing your learning history.</p>
        </div>
        <div className="settings-fields">
          <button
            className="button secondary danger"
            onClick={async () => {
              if (
                confirm(
                  "Reset all study progress, notes, favorites, custom sets, extensions, and study settings? AI speech settings and generated audio stay on this device. This cannot be undone without a backup.",
                )
              ) {
                await updateProfile((draft) =>
                  Object.assign(draft, createDefaultProfile()),
                )
                  .then(() =>
                    setMessage(
                      "Your study profile has been reset. The offline library is still installed.",
                    ),
                  )
                  .catch((reason: Error) => setError(reason.message));
              }
            }}
          >
            <Trash2 size={17} />
            Reset study profile
          </button>
        </div>
      </section>
    </div>
  );
}

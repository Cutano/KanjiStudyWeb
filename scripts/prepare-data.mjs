import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import {
  mkdir,
  readFile,
  writeFile,
  stat,
  copyFile,
  rename,
  rm,
  readdir,
} from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { gzipSync } from "node:zlib";
import { unzipSync } from "fflate";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const output = path.join(root, "public/data");
const cache = path.join(root, ".cache/kanji-alive");
const source = path.join(root, "Resource/kanji.db");
const sourceHash =
  "f0ab73a3a8d425455f93647c4305b76185d8156592df0cf534bbf4f7674ce4e6";
const audioUrl = "https://media.kanjialive.com/examples_audio/audio-mp3.zip";
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const exists = async (file) =>
  stat(file).then(
    () => true,
    () => false,
  );
await mkdir(output, { recursive: true });
await mkdir(cache, { recursive: true });
if (digest(await readFile(source)) !== sourceHash)
  throw new Error(
    "The source catalog does not match its audited SHA-256. Re-audit before generating a release.",
  );

const catalogFile = path.join(cache, "catalog.sqlite");
await copyFile(source, catalogFile);
const db = new DatabaseSync(catalogFile);
db.exec(
  "DROP TABLE analytics; DROP TABLE quiz_mistake; DROP TABLE draw_mistake;",
);
// Customizations belong to the user profile; these source slots contain no data.
for (const [table, columns] of Object.entries({
  kanji: [
    "custom_meaning",
    "translation",
    "custom_on_reading",
    "custom_kun_reading",
    "notes",
  ],
  radical: ["custom_reading", "custom_meaning", "translation"],
  kana: ["translation"],
  dict_entry: ["translation", "notes", "exercise_count", "sentence_count"],
})) {
  for (const column of columns) {
    // This original index includes a discarded, always-zero counter.
    if (column === "sentence_count")
      db.exec("DROP INDEX IF EXISTS search_sort_idx");
    db.exec(`ALTER TABLE ${table} DROP COLUMN ${column}`);
  }
}
db.exec(
  "CREATE INDEX catalog_vocab_common_idx ON dict_entry(is_common DESC, id); VACUUM;",
);
const counts = {
  kanji: "kanji",
  kana: "kana",
  radicals: "radical",
  vocabulary: "dict_entry",
  names: "name",
  sentences: "sentence",
};
const stats = Object.fromEntries(
  Object.entries(counts).map(([key, table]) => [
    key,
    db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count,
  ]),
);
const resources = db
  .prepare(
    "SELECT audio FROM dict_entry WHERE audio IS NOT NULL ORDER BY audio",
  )
  .all()
  .map(({ audio }) => audio.split("|")[0]);
stats.audio = resources.length;
if (db.prepare("PRAGMA integrity_check").get().integrity_check !== "ok")
  throw new Error("Derived catalog integrity check failed.");
db.close();

const assets = [];
async function saveAsset(name, data, kind) {
  const hash = digest(data);
  const file = `${name}.${hash.slice(0, 12)}${kind === "catalog" ? ".sqlite.bin" : kind === "audio" ? ".bin" : ".json"}`;
  await writeFile(path.join(output, file), data);
  const asset = {
    path: `/data/${file}`,
    bytes: data.byteLength,
    sha256: hash,
    kind,
  };
  assets.push(asset);
  return asset.path;
}
const catalogPath = await saveAsset(
  "catalog",
  gzipSync(await readFile(catalogFile), { level: 9 }),
  "catalog",
);
const archivePath = path.join(cache, "audio-mp3.zip");
if (!(await exists(archivePath))) {
  console.log("Downloading licensed Kanji alive recordings (130 MB)…");
  const response = await fetch(audioUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      Referer: "https://app.kanjialive.com/",
    },
  });
  if (!response.ok || !response.body)
    throw new Error(`Audio archive download failed: HTTP ${response.status}`);
  const temporary = `${archivePath}.partial`;
  await pipeline(Readable.fromWeb(response.body), createWriteStream(temporary));
  await rename(temporary, archivePath);
}
const archive = await readFile(archivePath);
const audioSourceHash = digest(archive);
if (
  audioSourceHash !==
  "c9cf970981c5d8c3f05bc9216c3b36a644a8be389183fb5b667b233028ec5aa4"
)
  throw new Error(
    "The audio source archive changed. Review its provenance before rebuilding.",
  );
const selected = new Set(resources.map((id) => `audio-mp3/${id}.mp3`));
const recordings = unzipSync(archive, {
  filter: (file) => selected.has(file.name),
});
const audioIndex = {};
const shardTarget = 16 * 1024 * 1024;
let buffers = [],
  entries = [],
  bytes = 0,
  shard = 0;
async function flushAudio() {
  if (!buffers.length) return;
  const audioPath = await saveAsset(
    `audio-${String(shard++).padStart(2, "0")}`,
    Buffer.concat(buffers),
    "audio",
  );
  for (const [id, offset, length] of entries)
    audioIndex[id] = { path: audioPath, offset, length };
  buffers = [];
  entries = [];
  bytes = 0;
}
for (const id of resources) {
  const recording = recordings[`audio-mp3/${id}.mp3`];
  if (!recording) throw new Error(`Missing audio recording: ${id}`);
  if (bytes && bytes + recording.byteLength > shardTarget) await flushAudio();
  entries.push([id, bytes, recording.byteLength]);
  buffers.push(Buffer.from(recording));
  bytes += recording.byteLength;
}
await flushAudio();
const audioIndexPath = await saveAsset(
  "audio-index",
  Buffer.from(JSON.stringify(audioIndex)),
  "index",
);
const version = digest(Buffer.from(JSON.stringify(assets))).slice(0, 20);
const manifest = {
  schemaVersion: 1,
  version,
  catalogPath,
  audioIndexPath,
  stats,
  assets,
  source: { path: "Resource/kanji.db", sha256: sourceHash },
  audioSource: {
    url: audioUrl,
    sha256: audioSourceHash,
    license: "CC-BY-4.0",
    attribution: "Kanji alive — Harumi Hibino Lory & Arno Bosse",
    website: "https://kanjialive.com",
  },
};
await writeFile(
  path.join(output, "manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
const retained = new Set(assets.map((asset) => path.basename(asset.path)));
for (const file of await readdir(output)) {
  if (
    /^(catalog|audio-index|audio-\d+)\.[a-f0-9]{12}\.(sqlite\.gz|sqlite\.bin|json|bin)$/.test(
      file,
    ) &&
    !retained.has(file)
  )
    await rm(path.join(output, file));
}
await rm(catalogFile);
console.log(
  `Prepared ${stats.kanji} kanji, ${stats.vocabulary} words, and ${stats.audio} recordings.`,
);
console.log(
  `Catalog version ${version}: ${(assets.reduce((total, a) => total + a.bytes, 0) / 1048576).toFixed(1)} MiB across ${assets.length} verified assets.`,
);
console.log(`Audio source SHA-256: ${audioSourceHash}`);

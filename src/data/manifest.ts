import type { CatalogStats } from "../domain/types";

export interface CatalogAsset {
  path: string;
  bytes: number;
  sha256: string;
  kind: "catalog" | "audio" | "index";
}
export interface CatalogManifest {
  schemaVersion: 1;
  version: string;
  catalogPath: string;
  audioIndexPath: string;
  stats: CatalogStats;
  assets: CatalogAsset[];
}
export interface AudioLocation {
  path: string;
  offset: number;
  length: number;
}
export type AudioIndex = Record<string, AudioLocation>;

export function parseManifest(value: unknown): CatalogManifest {
  if (!value || typeof value !== "object")
    throw new Error("Invalid catalog manifest.");
  const manifest = value as Partial<CatalogManifest>;
  if (
    manifest.schemaVersion !== 1 ||
    !manifest.version ||
    !manifest.catalogPath ||
    !manifest.audioIndexPath ||
    !manifest.stats ||
    !Array.isArray(manifest.assets)
  ) {
    throw new Error("Unsupported catalog manifest.");
  }
  const paths = new Set<string>();
  for (const asset of manifest.assets) {
    if (
      !/^\/data\/[a-z0-9.-]+$/.test(asset.path) ||
      !Number.isSafeInteger(asset.bytes) ||
      asset.bytes <= 0 ||
      !/^[a-f0-9]{64}$/.test(asset.sha256) ||
      !["catalog", "audio", "index"].includes(asset.kind) ||
      paths.has(asset.path)
    ) {
      throw new Error("Invalid catalog asset metadata.");
    }
    paths.add(asset.path);
  }
  if (!paths.has(manifest.catalogPath) || !paths.has(manifest.audioIndexPath))
    throw new Error("Catalog manifest is missing required assets.");
  return manifest as CatalogManifest;
}

export async function sha256(data: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

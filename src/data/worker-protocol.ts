import type { CatalogRepository } from "./repository";
export type CatalogMethod = keyof CatalogRepository;
export interface CatalogRequest {
  id: number;
  method: CatalogMethod | "open";
  args: unknown[];
}
export interface CatalogResponse {
  id: number;
  result?: unknown;
  error?: string;
}

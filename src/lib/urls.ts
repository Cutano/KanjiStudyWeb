/** Resolve an app-owned resource under the deployment's Vite base path. */
export function appUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;
}

import defaultPaths from "../paths.json" with { type: "json" };
import type { PathsConfig } from "./types.js";

let _paths: PathsConfig = defaultPaths as PathsConfig;

/** Override the bundled paths config (e.g. with one freshly fetched from GitHub). */
export function setPathsConfig(config: PathsConfig): void {
    _paths = config;
}

/** Reset to the bundled default paths config. */
export function resetPathsConfig(): void {
    _paths = defaultPaths as PathsConfig;
}

/** Get the active paths config. */
export function getPathsConfig(): PathsConfig {
    return _paths;
}

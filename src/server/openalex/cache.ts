// The local cache of harvested OpenAlex responses in data/raw/. `pnpm harvest`
// writes it and `pnpm load` reads it, so OpenAlex is only asked once.

import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { WorksPage } from "./client";
import type { OpenAlexWork } from "./mapper";

export const RAW_DIR = path.join(process.cwd(), "data", "raw");
const WORKS_DIR = path.join(RAW_DIR, "works");

/** The challenge query is harvested as 5 pages of 200: the top 1,000. */
export const PAGE_COUNT = 5;

/** data/raw/page-<n>.json: one list page, 1-based, as OpenAlex returned it. */
export function pagePath(n: number) {
  return path.join(RAW_DIR, `page-${n}.json`);
}

/** data/raw/works/<short id>.json: one work from the single-work endpoint. */
export function workPath(shortId: string) {
  return path.join(WORKS_DIR, `${shortId}.json`);
}

export function isCached(file: string) {
  return existsSync(file);
}

/**
 * Writes JSON through a temporary file, so an interrupted harvest never
 * leaves a partial file that a later run would take as cached.
 */
export async function writeJson(file: string, value: unknown) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  await writeFile(temporary, JSON.stringify(value));
  await rename(temporary, file);
}

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

export function readPage(n: number): Promise<WorksPage> {
  return readJson<WorksPage>(pagePath(n));
}

/** Every cached single work. */
export async function readSingleWorks(): Promise<OpenAlexWork[]> {
  if (!existsSync(WORKS_DIR)) return [];
  const files = (await readdir(WORKS_DIR)).filter((f) => f.endsWith(".json"));
  return Promise.all(
    files.map((f) => readJson<OpenAlexWork>(path.join(WORKS_DIR, f))),
  );
}

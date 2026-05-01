import { existsSync, readFileSync, appendFileSync } from "fs";
import { EOL } from "os";
import { join, extname } from "path";
import ignore from "ignore";
import { WEBDRIVE_BASE_URL } from "./constants.js";

export function extractWikiLinks(content: string): string[] {
  const seen = new Set<string>();
  const results: string[] = [];
  for (const match of content.matchAll(/\[\[([^\]]+)\]\]/g)) {
    const link = match[1].trim();
    if (!seen.has(link)) {
      seen.add(link);
      results.push(link);
    }
  }
  return results;
}

function readSyncfilesPatterns(gobiDir: string): string[] {
  const syncfilesPath = join(gobiDir, "syncfiles");
  if (!existsSync(syncfilesPath)) return [];
  return readFileSync(syncfilesPath, "utf-8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));
}

function isPathCovered(filePath: string, patterns: string[]): boolean {
  if (patterns.length === 0) return false;
  return ignore().add(patterns).ignores(filePath.replace(/\\/g, "/"));
}

function addToLocalSyncfiles(gobiDir: string, filePath: string): void {
  const patterns = readSyncfilesPatterns(gobiDir);
  if (isPathCovered(filePath, patterns)) return;
  const syncfilesPath = join(gobiDir, "syncfiles");
  appendFileSync(syncfilesPath, `${EOL}${filePath}`);
  console.log(`Added to syncfiles: ${filePath}`);
}

export async function uploadAttachments(
  vaultSlug: string,
  links: string[],
  token: string,
  options?: { addToSyncfiles?: boolean },
): Promise<void> {
  const addToSyncfiles = options?.addToSyncfiles ?? false;
  const gobiDir = join(process.cwd(), ".gobi");

  for (const link of links) {
    let localPath = join(process.cwd(), link);
    if (!existsSync(localPath)) {
      if (!extname(link)) {
        localPath = join(process.cwd(), link + ".md");
      }
      if (!existsSync(localPath)) {
        console.warn(`Warning: Skipping [[${link}]]: not found locally`);
        continue;
      }
    }

    const filePath = extname(link) ? link : link + ".md";
    console.log(`Uploading [[${link}]]...`);
    const content = readFileSync(localPath);
    const queryString = addToSyncfiles ? "?add_to_syncfiles=true" : "";
    const url = `${WEBDRIVE_BASE_URL}/api/v1/vaults/${vaultSlug}/file/${filePath}${queryString}`;
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/octet-stream",
      },
      body: content,
    });

    if (!res.ok) {
      throw new Error(
        `Failed to upload [[${link}]]: HTTP ${res.status}: ${(await res.text()) || "(no body)"}`,
      );
    }
    console.log(`Uploaded [[${link}]]`);

    if (addToSyncfiles) {
      addToLocalSyncfiles(gobiDir, filePath);
    }
  }
}

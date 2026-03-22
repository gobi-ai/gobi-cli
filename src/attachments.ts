import { existsSync, readFileSync } from "fs";
import { join, extname } from "path";
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

export async function uploadAttachments(
  vaultSlug: string,
  links: string[],
  token: string,
): Promise<void> {
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
    const url = `${WEBDRIVE_BASE_URL}/api/v1/vaults/${vaultSlug}/files/${filePath}`;
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
  }
}

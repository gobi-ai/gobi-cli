import { Command } from "commander";
import { apiGet, apiPost } from "../client.js";
import { BASE_URL, POLL_MAX_DURATION_MS } from "../constants.js";
import { getValidToken } from "../auth/manager.js";
import { ApiError } from "../errors.js";
import { isJsonMode, jsonOut, unwrapResp } from "./utils.js";

// ── Helpers ──

async function pollStatus(
  path: string,
  terminalStates: string[],
  intervalMs = 3000,
): Promise<Record<string, unknown>> {
  const start = Date.now();
  while (Date.now() - start < POLL_MAX_DURATION_MS) {
    const resp = (await apiGet(path)) as Record<string, unknown>;
    const data = unwrapResp(resp) as Record<string, unknown>;
    const status = (data.status as string) || "";
    if (terminalStates.includes(status)) return data;
    // If no status field but downloadUrl exists, treat as completed
    if (!status && extractImageUrl(data)) return data;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Polling timed out after ${POLL_MAX_DURATION_MS / 1000}s`);
}

function extractImageUrl(data: Record<string, unknown>): string | undefined {
  return (data.downloadUrl || data.download_url || data.url) as
    | string
    | undefined;
}

export function registerMediaCommand(program: Command): void {
  const media = program
    .command("media")
    .description(
      "Media generation commands (videos, images).",
    );

  // ════════════════════════════════════════════════════════════════════
  //  Upload
  // ════════════════════════════════════════════════════════════════════

  media
    .command("upload-init")
    .description("Get a presigned upload URL for a media file.")
    .requiredOption("--file-name <fileName>", "Name of the file to upload")
    .requiredOption(
      "--content-type <contentType>",
      "MIME type (e.g. image/png, video/mp4)",
    )
    .option("--file-size <fileSize>", "File size in bytes")
    .action(
      async (opts: {
        fileName: string;
        contentType: string;
        fileSize?: string;
      }) => {
        const body: Record<string, unknown> = {
          fileName: opts.fileName,
          contentType: opts.contentType,
        };
        if (opts.fileSize) body.fileSize = parseInt(opts.fileSize, 10);
        const resp = (await apiPost(
          "/media-gen/media/initialize",
          body,
        )) as Record<string, unknown>;
        const data = unwrapResp(resp) as Record<string, unknown>;

        if (isJsonMode(media)) {
          jsonOut(data);
          return;
        }

        console.log(
          `Upload initialized!\n` +
            `  Media ID:   ${data.mediaId}\n` +
            `  Upload URL: ${data.uploadUrl}\n\n` +
            `PUT your file to the upload URL, then run:\n` +
            `  gobi media upload-finalize --media-id ${data.mediaId}`,
        );
      },
    );

  media
    .command("upload-finalize")
    .description("Confirm that a media upload is complete.")
    .requiredOption("--media-id <mediaId>", "Media ID from upload-init")
    .action(async (opts: { mediaId: string }) => {
      const resp = (await apiPost("/media-gen/media/finalize", {
        mediaId: opts.mediaId,
      })) as Record<string, unknown>;
      const data = unwrapResp(resp) as Record<string, unknown>;

      if (isJsonMode(media)) {
        jsonOut(data);
        return;
      }

      console.log(`Upload finalized for media ${opts.mediaId}.`);
    });

  // ════════════════════════════════════════════════════════════════════
  //  Avatars & Voices
  // ════════════════════════════════════════════════════════════════════

  media
    .command("avatars")
    .description("List available avatars.")
    .action(async () => {
      const resp = (await apiGet("/media-gen/avatars")) as Record<
        string,
        unknown
      >;
      const data = unwrapResp(resp) as unknown[];

      if (isJsonMode(media)) {
        jsonOut(data);
        return;
      }

      if (!Array.isArray(data) || data.length === 0) {
        console.log("No avatars available.");
        return;
      }
      console.log("Available avatars:");
      for (const a of data as Record<string, unknown>[]) {
        console.log(`  - ${a.id || a.avatarId}: ${a.name || "(unnamed)"}`);
      }
    });

  media
    .command("voices")
    .description("List available voices.")
    .action(async () => {
      const resp = (await apiGet("/media-gen/voices")) as Record<
        string,
        unknown
      >;
      const data = unwrapResp(resp) as unknown[];

      if (isJsonMode(media)) {
        jsonOut(data);
        return;
      }

      if (!Array.isArray(data) || data.length === 0) {
        console.log("No voices available.");
        return;
      }
      console.log("Available voices:");
      for (const v of data as Record<string, unknown>[]) {
        console.log(`  - ${v.id || v.voiceId}: ${v.name || "(unnamed)"}`);
      }
    });

  // ════════════════════════════════════════════════════════════════════
  //  Videos
  // ════════════════════════════════════════════════════════════════════

  media
    .command("video-create")
    .description("Create an avatar video generation job.")
    .requiredOption("--name <name>", "Name for the video")
    .requiredOption("--avatar-id <avatarId>", "Avatar to use")
    .requiredOption("--voice-id <voiceId>", "Voice to use")
    .requiredOption("--script <script>", "Script for the avatar to read")
    .option(
      "--background-media-id <backgroundMediaId>",
      "Background media ID (from upload)",
    )
    .option("--wait", "Poll until generation completes")
    .action(
      async (opts: {
        name: string;
        avatarId: string;
        voiceId: string;
        script: string;
        backgroundMediaId?: string;
        wait?: boolean;
      }) => {
        const body: Record<string, unknown> = {
          name: opts.name,
          avatarId: opts.avatarId,
          voiceId: opts.voiceId,
          script: opts.script,
        };
        if (opts.backgroundMediaId)
          body.backgroundMediaId = opts.backgroundMediaId;

        const resp = (await apiPost(
          "/media-gen/videos",
          body,
        )) as Record<string, unknown>;
        let data = unwrapResp(resp) as Record<string, unknown>;
        const videoId = data.id || data.videoId;

        if (opts.wait && videoId) {
          console.log(`Video ${videoId} queued — polling for completion…`);
          data = await pollStatus(
            `/media-gen/videos/${videoId}/status`,
            ["inference_complete", "inference_failed"],
          );
        }

        if (isJsonMode(media)) {
          jsonOut(data);
          return;
        }

        const status = data.status || "queued";
        console.log(
          `Video created!\n` +
            `  ID:     ${videoId}\n` +
            `  Status: ${status}`,
        );
        if (status === "inference_complete") {
          console.log(
            `  Download: gobi media video-download ${videoId}`,
          );
        }
      },
    );

  media
    .command("video-list")
    .description("List all videos.")
    .action(async () => {
      const resp = (await apiGet("/media-gen/videos")) as Record<
        string,
        unknown
      >;
      const data = unwrapResp(resp) as unknown[];

      if (isJsonMode(media)) {
        jsonOut(data);
        return;
      }

      if (!Array.isArray(data) || data.length === 0) {
        console.log("No videos found.");
        return;
      }
      console.log("Videos:");
      for (const v of data as Record<string, unknown>[]) {
        console.log(
          `  - [${v.id}] status: ${v.status || "unknown"}, created: ${v.createdAt || "?"}`,
        );
      }
    });

  media
    .command("video-get <id>")
    .description("Get video metadata.")
    .action(async (id: string) => {
      const resp = (await apiGet(
        `/media-gen/videos/${id}`,
      )) as Record<string, unknown>;
      const data = unwrapResp(resp) as Record<string, unknown>;

      if (isJsonMode(media)) {
        jsonOut(data);
        return;
      }

      console.log(`Video ${id}:`);
      for (const [k, v] of Object.entries(data)) {
        console.log(`  ${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`);
      }
    });

  media
    .command("video-status <id>")
    .description("Poll video generation status.")
    .option("--wait", "Poll until a terminal state is reached")
    .action(async (id: string, opts: { wait?: boolean }) => {
      if (opts.wait) {
        const data = await pollStatus(
          `/media-gen/videos/${id}/status`,
          ["inference_complete", "inference_failed"],
        );
        if (isJsonMode(media)) {
          jsonOut(data);
          return;
        }
        console.log(`Video ${id} — status: ${data.status}`);
        return;
      }

      const resp = (await apiGet(
        `/media-gen/videos/${id}/status`,
      )) as Record<string, unknown>;
      const data = unwrapResp(resp) as Record<string, unknown>;

      if (isJsonMode(media)) {
        jsonOut(data);
        return;
      }

      console.log(`Video ${id} — status: ${data.status || "unknown"}`);
    });

  media
    .command("video-download <id>")
    .description("Get the download URL for a completed video.")
    .action(async (id: string) => {
      const token = await getValidToken();
      const url = `${BASE_URL}/media-gen/videos/${id}/download`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        redirect: "manual",
      });

      // If the server redirects, extract the Location header
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location") || "";
        if (isJsonMode(media)) {
          jsonOut({ downloadUrl: location });
          return;
        }
        console.log(`Download URL for video ${id}:\n  ${location}`);
        return;
      }

      if (!res.ok) {
        const text = (await res.text()) || "(no body)";
        throw new ApiError(res.status, `/media-gen/videos/${id}/download`, text);
      }

      // If it returns JSON instead of a redirect
      const resp = (await res.json()) as Record<string, unknown>;
      const data = unwrapResp(resp) as Record<string, unknown>;

      if (isJsonMode(media)) {
        jsonOut(data);
        return;
      }

      console.log(
        `Download URL for video ${id}:\n  ${data.url || data.downloadUrl || JSON.stringify(data)}`,
      );
    });

  // ════════════════════════════════════════════════════════════════════
  //  Images
  // ════════════════════════════════════════════════════════════════════

  media
    .command("image-generate")
    .description(
      "Generate an image from a text prompt. Types: image (default), thumbnail (YouTube-optimized), asset (logo/product). Aspect ratios: 1:1, 16:9, 9:16, 4:3, 3:4",
    )
    .requiredOption("--prompt <prompt>", "Text prompt for image generation")
    .option("--name <name>", "Name for the generated image (auto-generated from prompt if omitted)")
    .option(
      "--type <type>",
      "Generation type: image (default), thumbnail (YouTube-optimized), asset (logo/product)",
    )
    .option(
      "--aspect-ratio <aspectRatio>",
      "Aspect ratio (1:1, 16:9, 9:16, 4:3, 3:4)",
    )
    .option("--negative-prompt <negativePrompt>", "Negative prompt")
    .option("--seed <seed>", "Random seed for reproducibility")
    .option(
      "--reference-media-id <referenceMediaId>",
      "Reference image media ID",
    )
    .option("--wait", "Poll until generation completes")
    .action(
      async (opts: {
        prompt: string;
        name: string;
        type?: string;
        aspectRatio?: string;
        negativePrompt?: string;
        seed?: string;
        referenceMediaId?: string;
        wait?: boolean;
      }) => {
        const name = opts.name || opts.prompt.slice(0, 50).replace(/[^a-zA-Z0-9-_ ]/g, "").trim().replace(/\s+/g, "-");
        const body: Record<string, unknown> = {
          prompt: opts.prompt,
          name,
        };
        if (opts.type) body.type = opts.type;
        if (opts.aspectRatio) body.aspectRatio = opts.aspectRatio;
        if (opts.negativePrompt) body.negativePrompt = opts.negativePrompt;
        if (opts.seed) body.seed = parseInt(opts.seed, 10);
        if (opts.referenceMediaId) body.referenceMediaId = opts.referenceMediaId;

        const resp = (await apiPost(
          "/media-gen/images/generate",
          body,
        )) as Record<string, unknown>;
        let data = unwrapResp(resp) as Record<string, unknown>;
        const jobId = data.jobId || data.id;

        if (opts.wait && jobId) {
          console.log(`Image job ${jobId} queued — polling for completion…`);
          data = await pollStatus(`/media-gen/images/${jobId}`, [
            "completed",
            "failed",
            "inference_complete",
            "inference_failed",
          ]);
        }

        if (isJsonMode(media)) {
          jsonOut(data);
          return;
        }

        const imgUrl = extractImageUrl(data);
        const status = data.status || "queued";
        console.log(
          `Image generation started!\n` +
            `  Job ID: ${jobId}\n` +
            `  Status: ${status}`,
        );
        if (imgUrl) {
          console.log(`  Download URL: ${imgUrl}`);
        } else if (status === "queued" || status === "inference_started" || status === "inference_working") {
          console.log(`  Check:  gobi media image-status ${jobId}`);
        }
      },
    );

  media
    .command("image-edit")
    .description("Edit an existing image with a prompt (image-to-image).")
    .requiredOption("--media-id <mediaId>", "Source image media ID")
    .requiredOption("--prompt <prompt>", "Edit instruction")
    .requiredOption("--name <name>", "Name for the edited image")
    .option("--wait", "Poll until generation completes")
    .action(
      async (opts: { mediaId: string; prompt: string; name: string; wait?: boolean }) => {
        const resp = (await apiPost("/media-gen/images/edit", {
          mediaId: opts.mediaId,
          prompt: opts.prompt,
          name: opts.name,
        })) as Record<string, unknown>;
        let data = unwrapResp(resp) as Record<string, unknown>;
        const jobId = data.jobId || data.id;

        if (opts.wait && jobId) {
          console.log(`Image edit job ${jobId} — polling for completion…`);
          data = await pollStatus(`/media-gen/images/${jobId}`, [
            "completed",
            "failed",
            "inference_complete",
            "inference_failed",
          ]);
        }

        if (isJsonMode(media)) {
          jsonOut(data);
          return;
        }

        const imgUrl = extractImageUrl(data);
        console.log(
          `Image edit started!\n` +
            `  Job ID: ${jobId}\n` +
            `  Status: ${data.status || "queued"}`,
        );
        if (imgUrl) {
          console.log(`  Download URL: ${imgUrl}`);
        }
      },
    );

  media
    .command("image-inpaint")
    .description("Inpaint an image region using a mask.")
    .requiredOption("--media-id <mediaId>", "Source image media ID")
    .requiredOption("--mask-media-id <maskMediaId>", "Mask image media ID")
    .requiredOption("--prompt <prompt>", "Inpainting prompt")
    .requiredOption("--name <name>", "Name for the inpainted image")
    .option("--wait", "Poll until generation completes")
    .action(
      async (opts: {
        mediaId: string;
        maskMediaId: string;
        prompt: string;
        name: string;
        wait?: boolean;
      }) => {
        const resp = (await apiPost("/media-gen/images/inpaint", {
          mediaId: opts.mediaId,
          maskMediaId: opts.maskMediaId,
          prompt: opts.prompt,
          name: opts.name,
        })) as Record<string, unknown>;
        let data = unwrapResp(resp) as Record<string, unknown>;
        const jobId = data.jobId || data.id;

        if (opts.wait && jobId) {
          console.log(`Inpaint job ${jobId} — polling for completion…`);
          data = await pollStatus(`/media-gen/images/${jobId}`, [
            "completed",
            "failed",
            "inference_complete",
            "inference_failed",
          ]);
        }

        if (isJsonMode(media)) {
          jsonOut(data);
          return;
        }

        const imgUrl = extractImageUrl(data);
        console.log(
          `Inpainting started!\n` +
            `  Job ID: ${jobId}\n` +
            `  Status: ${data.status || "queued"}`,
        );
        if (imgUrl) {
          console.log(`  Download URL: ${imgUrl}`);
        }
      },
    );

  media
    .command("image-status <jobId>")
    .description("Check image generation job status.")
    .option("--wait", "Poll until a terminal state is reached")
    .action(async (jobId: string, opts: { wait?: boolean }) => {
      let data: Record<string, unknown>;

      if (opts.wait) {
        data = await pollStatus(`/media-gen/images/${jobId}`, [
          "completed",
          "failed",
          "inference_complete",
          "inference_failed",
        ]);
      } else {
        const resp = (await apiGet(
          `/media-gen/images/${jobId}`,
        )) as Record<string, unknown>;
        data = unwrapResp(resp) as Record<string, unknown>;
      }

      if (isJsonMode(media)) {
        jsonOut(data);
        return;
      }

      const imgUrl = extractImageUrl(data);
      console.log(`Image job ${jobId} — status: ${data.status || "unknown"}`);
      if (imgUrl) {
        console.log(`  Download URL: ${imgUrl}`);
      }
    });

  media
    .command("image-download <jobId>")
    .description("Download a generated image.")
    .option("--wait", "Poll until generation completes before downloading")
    .option("--type <type>", "Image type (image, thumbnail, asset)")
    .option("-o, --output <path>", "Output file path (default: {jobId}.{ext} in current directory)")
    .action(async (jobId: string, opts: { wait?: boolean; type?: string; output?: string }) => {
      if (opts.wait) {
        console.log(`Waiting for image job ${jobId} to complete…`);
        await pollStatus(`/media-gen/images/${jobId}`, [
          "completed",
          "failed",
          "inference_complete",
          "inference_failed",
        ]);
      }

      const token = await getValidToken();
      const query = opts.type ? `?type=${opts.type}` : "";
      const url = `${BASE_URL}/media-gen/images/${jobId}/download${query}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const text = (await res.text()) || "(no body)";
        throw new ApiError(res.status, `/media-gen/images/${jobId}/download`, text);
      }

      const contentType = res.headers.get("content-type") || "image/png";
      const ext = contentType.includes("jpeg") || contentType.includes("jpg") ? "jpg"
        : contentType.includes("webp") ? "webp"
        : "png";
      const filename = opts.output || `${jobId}.${ext}`;

      if (isJsonMode(media)) {
        // In JSON mode, save to file and return metadata
        const { writeFile, mkdir } = await import("fs/promises");
        const { dirname } = await import("path");
        const buffer = Buffer.from(await res.arrayBuffer());
        await mkdir(dirname(filename), { recursive: true });
        await writeFile(filename, buffer);
        jsonOut({ filename, contentType, size: buffer.length });
        return;
      }

      // Write to file
      const { writeFile, mkdir } = await import("fs/promises");
      const { dirname } = await import("path");
      const buffer = Buffer.from(await res.arrayBuffer());
      await mkdir(dirname(filename), { recursive: true });
      await writeFile(filename, buffer);
      console.log(`Image saved to ${filename} (${buffer.length} bytes)`);
    });

}

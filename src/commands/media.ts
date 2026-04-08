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

/**
 * Download a video binary from the media-gen download endpoint.
 * Handles three cases:
 *   1. Direct binary response (redirect: "follow" returns the file)
 *   2. JSON response with downloadUrl (need to fetch that URL)
 *   3. Redirect (302) with Location header
 */
async function downloadVideoToFile(
  videoId: string,
  outputPath: string,
): Promise<{ contentType: string; size: number }> {
  const { writeFile, mkdir } = await import("fs/promises");
  const { dirname } = await import("path");
  const token = await getValidToken();
  const dlUrl = `${BASE_URL}/media-gen/videos/${videoId}/download`;

  // Try following redirects first
  const res = await fetch(dlUrl, {
    headers: { Authorization: `Bearer ${token}` },
    redirect: "follow",
  });
  if (!res.ok) {
    throw new ApiError(res.status, `/media-gen/videos/${videoId}/download`, await res.text());
  }

  const ct = res.headers.get("content-type") || "";

  // If the response is JSON, extract downloadUrl and fetch the actual binary
  if (ct.includes("application/json")) {
    const json = (await res.json()) as Record<string, unknown>;
    const inner = (json.data || json) as Record<string, unknown>;
    const url = (inner.downloadUrl || inner.download_url || inner.url) as string | undefined;
    if (!url) throw new Error("Download endpoint returned JSON without a downloadUrl");
    const videoRes = await fetch(url);
    if (!videoRes.ok) throw new Error(`Failed to fetch video from ${url}: ${videoRes.status}`);
    const buffer = Buffer.from(await videoRes.arrayBuffer());
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, buffer);
    return { contentType: videoRes.headers.get("content-type") || "video/mp4", size: buffer.length };
  }

  // Direct binary response
  const buffer = Buffer.from(await res.arrayBuffer());
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, buffer);
  return { contentType: ct || "video/mp4", size: buffer.length };
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
    .option("--name <name>", "Name for the video (auto-generated if omitted)")
    .requiredOption("--avatar-id <avatarId>", "Avatar to use")
    .requiredOption("--voice-id <voiceId>", "Voice to use")
    .requiredOption("--script <script>", "Script for the avatar to read")
    .option(
      "--background-media-id <backgroundMediaId>",
      "Background media ID (from upload)",
    )
    .option("--wait", "Poll until generation completes")
    .option("-o, --output <path>", "Download video to this path when done (implies --wait)")
    .action(
      async (opts: {
        name?: string;
        avatarId: string;
        voiceId: string;
        script: string;
        backgroundMediaId?: string;
        wait?: boolean;
        output?: string;
      }) => {
        const shouldWait = opts.wait || !!opts.output;
        const autoName = opts.name || `video-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}`;
        const body: Record<string, unknown> = {
          name: autoName,
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
        const videoId = data.id || data.videoId || data.jobId;

        if (shouldWait && videoId) {
          console.log(`Video ${videoId} queued — polling for completion…`);
          data = await pollStatus(
            `/media-gen/videos/${videoId}/status`,
            ["inference_complete", "inference_failed"],
          );
        }

        // After polling, the status response may contain the real videoId for download
        const downloadId = data.videoId || data.id || videoId;

        // Download video to file if -o specified
        if (opts.output && downloadId && data.status === "inference_complete") {
          const { contentType, size } = await downloadVideoToFile(downloadId as string, opts.output);
          if (isJsonMode(media)) {
            jsonOut({ ...data, filename: opts.output, contentType, size });
            return;
          }
          console.log(`Video saved to ${opts.output} (${size} bytes)`);
          return;
        }

        if (isJsonMode(media)) {
          jsonOut(data);
          return;
        }

        const status = data.status || "queued";
        console.log(
          `Video created!\n` +
            `  ID:     ${downloadId}\n` +
            `  Status: ${status}`,
        );
        if (status === "inference_complete") {
          console.log(
            `  Download: gobi media video-download ${downloadId}`,
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
    .option("-o, --output <path>", "Download video to this path when complete (implies --wait)")
    .action(async (id: string, opts: { wait?: boolean; output?: string }) => {
      const shouldWait = opts.wait || !!opts.output;
      if (shouldWait) {
        const data = await pollStatus(
          `/media-gen/videos/${id}/status`,
          ["inference_complete", "inference_failed"],
        );

        // Download if -o specified and completed
        if (opts.output && data.status === "inference_complete") {
          const dlId = (data.videoId || data.id || id) as string;
          const { contentType, size } = await downloadVideoToFile(dlId, opts.output);
          if (isJsonMode(media)) {
            jsonOut({ ...data, filename: opts.output, contentType, size });
            return;
          }
          console.log(`Video ${id} — ${data.status}\nSaved to ${opts.output} (${size} bytes)`);
          return;
        }

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
    .description("Download a completed video (or get its URL).")
    .option("-o, --output <path>", "Save video to this file path")
    .action(async (id: string, opts: { output?: string }) => {
      const token = await getValidToken();
      const url = `${BASE_URL}/media-gen/videos/${id}/download`;

      // If -o specified, download directly to file
      if (opts.output) {
        const { contentType, size } = await downloadVideoToFile(id, opts.output);
        if (isJsonMode(media)) {
          jsonOut({ filename: opts.output, contentType, size });
          return;
        }
        console.log(`Video saved to ${opts.output} (${size} bytes)`);
        return;
      }

      // No -o: just return the URL (existing behavior)
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
  //  Cinematic Video
  // ════════════════════════════════════════════════════════════════════

  media
    .command("cinematic-create")
    .description("Create a cinematic video from a text prompt.")
    .requiredOption("--prompt <prompt>", "Text prompt describing the video")
    .option("--name <name>", "Name for the video (auto-generated if omitted)")
    .option("--aspect-ratio <aspectRatio>", "Aspect ratio: 16:9, 9:16, 1:1")
    .option("--duration <seconds>", "Duration in seconds (4-8)")
    .option("--resolution <resolution>", "Resolution: 720p, 1080p")
    .option("--enhance-prompt", "Enhance the prompt with AI")
    .option("--generate-audio", "Generate audio for the video")
    .option("--negative-prompt <negativePrompt>", "Negative prompt")
    .option("--sample-count <count>", "Number of samples (1-4)")
    .option("--first-frame-media-id <mediaId>", "First frame image media ID")
    .option("--last-frame-media-id <mediaId>", "Last frame image media ID")
    .option("--reference-media-ids <ids>", "Comma-separated reference image media IDs (max 3)")
    .option("--wait", "Poll until generation completes")
    .option("-o, --output <path>", "Download video to this path when done (implies --wait)")
    .action(
      async (opts: {
        prompt: string;
        name?: string;
        aspectRatio?: string;
        duration?: string;
        resolution?: string;
        enhancePrompt?: boolean;
        generateAudio?: boolean;
        negativePrompt?: string;
        sampleCount?: string;
        firstFrameMediaId?: string;
        lastFrameMediaId?: string;
        referenceMediaIds?: string;
        wait?: boolean;
        output?: string;
      }) => {
        const shouldWait = opts.wait || !!opts.output;
        const autoName = opts.name || `cinematic-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}`;
        const body: Record<string, unknown> = {
          name: autoName,
          prompt: opts.prompt,
        };
        if (opts.aspectRatio) body.aspectRatio = opts.aspectRatio;
        if (opts.duration) {
          const v = parseInt(opts.duration, 10);
          if (Number.isNaN(v)) throw new Error("--duration must be a number");
          body.durationSeconds = v;
        }
        if (opts.resolution) body.resolution = opts.resolution;
        if (opts.enhancePrompt) body.enhancePrompt = true;
        if (opts.generateAudio) body.generateAudio = true;
        if (opts.negativePrompt) body.negativePrompt = opts.negativePrompt;
        if (opts.sampleCount) {
          const v = parseInt(opts.sampleCount, 10);
          if (Number.isNaN(v)) throw new Error("--sample-count must be a number");
          body.sampleCount = v;
        }
        if (opts.firstFrameMediaId) body.firstFrameImageMediaId = opts.firstFrameMediaId;
        if (opts.lastFrameMediaId) body.lastFrameImageMediaId = opts.lastFrameMediaId;
        if (opts.referenceMediaIds) body.referenceImageMediaIds = opts.referenceMediaIds.split(",").map((s) => s.trim());

        const resp = (await apiPost(
          "/media-gen/videos/cinematic",
          body,
        )) as Record<string, unknown>;
        let data = unwrapResp(resp) as Record<string, unknown>;
        const videoId = data.id || data.videoId || data.jobId;

        if (shouldWait && videoId) {
          console.log(`Cinematic video ${videoId} queued — polling for completion…`);
          data = await pollStatus(
            `/media-gen/videos/${videoId}/status`,
            ["inference_complete", "inference_failed"],
          );
        }

        // After polling, the status response may contain the real videoId for download
        const downloadId = data.videoId || data.id || videoId;

        // Download video to file if -o specified
        if (opts.output && downloadId && data.status === "inference_complete") {
          const { contentType, size } = await downloadVideoToFile(downloadId as string, opts.output);
          if (isJsonMode(media)) {
            jsonOut({ ...data, filename: opts.output, contentType, size });
            return;
          }
          console.log(`Cinematic video saved to ${opts.output} (${size} bytes)`);
          return;
        }

        if (isJsonMode(media)) {
          jsonOut(data);
          return;
        }

        const status = data.status || "queued";
        console.log(
          `Cinematic video created!\n` +
            `  ID:     ${downloadId}\n` +
            `  Status: ${status}`,
        );
        if (status === "inference_complete") {
          console.log(`  Download: gobi media video-download ${downloadId}`);
        }
      },
    );

  // ════════════════════════════════════════════════════════════════════
  //  Custom Avatars
  // ════════════════════════════════════════════════════════════════════

  media
    .command("avatar-design")
    .description("Start a design-your-avatar job.")
    .option("--name <name>", "Name for the avatar (auto-generated if omitted)")
    .requiredOption("--gender <gender>", "Gender for the avatar design")
    .requiredOption("--age <age>", "Age range for the avatar")
    .requiredOption("--ethnicity <ethnicity>", "Ethnicity for the avatar")
    .requiredOption("--outfit <outfit>", "Outfit description")
    .requiredOption("--background <background>", "Background description")
    .option("--no-portrait", "Generate full-body instead of portrait")
    .option("--audio-media-id <mediaId>", "Custom voice audio media ID")
    .option("--wait", "Poll until variants are ready")
    .action(
      async (opts: {
        name?: string;
        gender: string;
        age: string;
        ethnicity: string;
        outfit: string;
        background: string;
        portrait: boolean;
        audioMediaId?: string;
        wait?: boolean;
      }) => {
        const body: Record<string, unknown> = {
          name: opts.name || `avatar-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}`,
          gender: opts.gender,
          age: opts.age,
          ethnicity: opts.ethnicity,
          outfit: opts.outfit,
          background: opts.background,
          isPortrait: opts.portrait,
        };
        if (opts.audioMediaId) body.audioMediaId = opts.audioMediaId;

        const resp = (await apiPost(
          "/media-gen/avatars/design",
          body,
        )) as Record<string, unknown>;
        let data = unwrapResp(resp) as Record<string, unknown>;
        const jobId = data.jobId || data.id;

        if (opts.wait && jobId) {
          console.log(`Avatar design job ${jobId} — polling for completion…`);
          data = await pollStatus(
            `/media-gen/avatars/jobs/${jobId}/status`,
            ["variants_ready", "complete", "failed"],
          );
        }

        if (isJsonMode(media)) {
          jsonOut(data);
          return;
        }

        const status = data.status || "queued";
        console.log(
          `Avatar design started!\n` +
            `  Job ID: ${jobId}\n` +
            `  Status: ${status}`,
        );
        if (status === "variants_ready") {
          console.log(`  Confirm: gobi media avatar-confirm --job-id ${jobId}`);
        }
      },
    );

  media
    .command("avatar-confirm")
    .description("Confirm avatar variant(s) after design.")
    .requiredOption("--job-id <jobId>", "Job ID from avatar-design")
    .option("--variant <variant>", "Variant to confirm (1 or 2); omit to confirm both")
    .action(
      async (opts: { jobId: string; variant?: string }) => {
        const body: Record<string, unknown> = { jobId: opts.jobId };
        if (opts.variant) {
          const v = parseInt(opts.variant, 10);
          if (Number.isNaN(v)) throw new Error("--variant must be a number (1 or 2)");
          body.variant = v;
        }

        const resp = (await apiPost(
          "/media-gen/avatars/confirm",
          body,
        )) as Record<string, unknown>;
        const data = unwrapResp(resp) as Record<string, unknown>;

        if (isJsonMode(media)) {
          jsonOut(data);
          return;
        }

        const avatarId = data.avatarId || data.id;
        console.log(
          `Avatar confirmed!\n` +
            `  Avatar ID: ${avatarId || JSON.stringify(data)}`,
        );
      },
    );

  media
    .command("avatar-from-selfie")
    .description("Create an avatar from a selfie (instant or enhanced with prompt).")
    .option("--name <name>", "Name for the avatar (auto-generated if omitted)")
    .requiredOption("--photo-media-id <mediaId>", "Selfie photo media ID")
    .option("--prompt <prompt>", "Enhancement prompt (triggers async enhance flow)")
    .option("--audio-media-id <mediaId>", "Custom voice audio media ID")
    .option("--wait", "Poll until job completes (only for enhance flow)")
    .action(
      async (opts: {
        name?: string;
        photoMediaId: string;
        prompt?: string;
        audioMediaId?: string;
        wait?: boolean;
      }) => {
        const body: Record<string, unknown> = {
          name: opts.name || `avatar-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}`,
          photoMediaId: opts.photoMediaId,
        };
        if (opts.prompt) body.prompt = opts.prompt;
        if (opts.audioMediaId) body.audioMediaId = opts.audioMediaId;

        const resp = (await apiPost(
          "/media-gen/avatars/from-selfie",
          body,
        )) as Record<string, unknown>;
        let data = unwrapResp(resp) as Record<string, unknown>;
        const jobId = data.jobId || data.id;

        // Enhance flow is async — poll if --wait
        if (opts.wait && opts.prompt && jobId) {
          console.log(`Avatar enhance job ${jobId} — polling for completion…`);
          data = await pollStatus(
            `/media-gen/avatars/jobs/${jobId}/status`,
            ["variants_ready", "complete", "failed"],
          );
        }

        if (isJsonMode(media)) {
          jsonOut(data);
          return;
        }

        if (opts.prompt) {
          const status = data.status || "queued";
          console.log(
            `Avatar enhance started!\n` +
              `  Job ID: ${jobId}\n` +
              `  Status: ${status}`,
          );
        } else {
          const avatarId = data.avatarId || data.id;
          console.log(
            `Avatar created from selfie!\n` +
              `  Avatar ID: ${avatarId || JSON.stringify(data)}`,
          );
        }
      },
    );

  media
    .command("avatar-job-status <jobId>")
    .description("Check avatar job status.")
    .option("--wait", "Poll until a terminal state is reached")
    .action(async (jobId: string, opts: { wait?: boolean }) => {
      let data: Record<string, unknown>;

      if (opts.wait) {
        data = await pollStatus(
          `/media-gen/avatars/jobs/${jobId}/status`,
          ["variants_ready", "complete", "failed"],
        );
      } else {
        const resp = (await apiGet(
          `/media-gen/avatars/jobs/${jobId}/status`,
        )) as Record<string, unknown>;
        data = unwrapResp(resp) as Record<string, unknown>;
      }

      if (isJsonMode(media)) {
        jsonOut(data);
        return;
      }

      console.log(`Avatar job ${jobId} — status: ${data.status || "unknown"}`);
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
    .option("-o, --output <path>", "Download image to this path when done (implies --wait)")
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
        output?: string;
      }) => {
        const shouldWait = opts.wait || !!opts.output;
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

        if (shouldWait && jobId) {
          console.log(`Image job ${jobId} queued — polling for completion…`);
          data = await pollStatus(`/media-gen/images/${jobId}`, [
            "completed",
            "failed",
            "inference_complete",
            "inference_failed",
          ]);
        }

        // Download image to file if -o specified
        if (opts.output && data) {
          const id = data.jobId || data.id;
          if (id) {
            const token = await getValidToken();
            const url = `${BASE_URL}/media-gen/images/${id}/download`;
            const res = await fetch(url, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
              const { writeFile, mkdir } = await import("fs/promises");
              const { dirname } = await import("path");
              const buffer = Buffer.from(await res.arrayBuffer());
              await mkdir(dirname(opts.output), { recursive: true });
              await writeFile(opts.output, buffer);
              const contentType = res.headers.get("content-type") || "image/png";
              if (isJsonMode(media)) {
                jsonOut({ ...data, filename: opts.output, contentType, size: buffer.length });
                return;
              }
              console.log(`Image saved to ${opts.output} (${buffer.length} bytes)`);
              return;
            }
          }
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
    .option("--name <name>", "Name for the edited image (auto-generated if omitted)")
    .option("--wait", "Poll until generation completes")
    .option("-o, --output <path>", "Download image to this path when done (implies --wait)")
    .action(
      async (opts: { mediaId: string; prompt: string; name?: string; wait?: boolean; output?: string }) => {
        const shouldWait = opts.wait || !!opts.output;
        const autoName = opts.name || opts.prompt.slice(0, 50).replace(/[^a-zA-Z0-9-_ ]/g, "").trim().replace(/\s+/g, "-");
        const resp = (await apiPost("/media-gen/images/edit", {
          mediaId: opts.mediaId,
          prompt: opts.prompt,
          name: autoName,
        })) as Record<string, unknown>;
        let data = unwrapResp(resp) as Record<string, unknown>;
        const jobId = data.jobId || data.id;

        if (shouldWait && jobId) {
          console.log(`Image edit job ${jobId} — polling for completion…`);
          data = await pollStatus(`/media-gen/images/${jobId}`, [
            "completed",
            "failed",
            "inference_complete",
            "inference_failed",
          ]);
        }

        // Download image to file if -o specified
        if (opts.output && jobId) {
          const token = await getValidToken();
          const query = "";
          const url = `${BASE_URL}/media-gen/images/${jobId}/download${query}`;
          const res = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const { writeFile, mkdir } = await import("fs/promises");
            const { dirname } = await import("path");
            const buffer = Buffer.from(await res.arrayBuffer());
            await mkdir(dirname(opts.output), { recursive: true });
            await writeFile(opts.output, buffer);
            const contentType = res.headers.get("content-type") || "image/png";
            if (isJsonMode(media)) {
              jsonOut({ ...data, filename: opts.output, contentType, size: buffer.length });
              return;
            }
            console.log(`Image saved to ${opts.output} (${buffer.length} bytes)`);
            return;
          }
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
    .option("--name <name>", "Name for the inpainted image (auto-generated if omitted)")
    .option("--wait", "Poll until generation completes")
    .option("-o, --output <path>", "Download image to this path when done (implies --wait)")
    .action(
      async (opts: {
        mediaId: string;
        maskMediaId: string;
        prompt: string;
        name?: string;
        wait?: boolean;
        output?: string;
      }) => {
        const shouldWait = opts.wait || !!opts.output;
        const autoName = opts.name || opts.prompt.slice(0, 50).replace(/[^a-zA-Z0-9-_ ]/g, "").trim().replace(/\s+/g, "-");
        const resp = (await apiPost("/media-gen/images/inpaint", {
          mediaId: opts.mediaId,
          maskMediaId: opts.maskMediaId,
          prompt: opts.prompt,
          name: autoName,
        })) as Record<string, unknown>;
        let data = unwrapResp(resp) as Record<string, unknown>;
        const jobId = data.jobId || data.id;

        if (shouldWait && jobId) {
          console.log(`Inpaint job ${jobId} — polling for completion…`);
          data = await pollStatus(`/media-gen/images/${jobId}`, [
            "completed",
            "failed",
            "inference_complete",
            "inference_failed",
          ]);
        }

        // Download image to file if -o specified
        if (opts.output && jobId) {
          const token = await getValidToken();
          const url = `${BASE_URL}/media-gen/images/${jobId}/download`;
          const res = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const { writeFile, mkdir } = await import("fs/promises");
            const { dirname } = await import("path");
            const buffer = Buffer.from(await res.arrayBuffer());
            await mkdir(dirname(opts.output), { recursive: true });
            await writeFile(opts.output, buffer);
            const contentType = res.headers.get("content-type") || "image/png";
            if (isJsonMode(media)) {
              jsonOut({ ...data, filename: opts.output, contentType, size: buffer.length });
              return;
            }
            console.log(`Image saved to ${opts.output} (${buffer.length} bytes)`);
            return;
          }
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

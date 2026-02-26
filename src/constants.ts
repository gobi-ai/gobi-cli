export const BASE_URL =
  process.env.GOBI_BASE_URL || "https://backend.joingobi.com";

export const WEBDRIVE_BASE_URL =
  process.env.GOBI_WEBDRIVE_BASE_URL || "https://webdrive.joingobi.com";

// Refresh access token when less than 5 minutes remain
export const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

// Max polling duration before giving up (ms) - 10 minutes
export const POLL_MAX_DURATION_MS = 10 * 60 * 1000;

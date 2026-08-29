export const BASE_URL =
  process.env.GOBI_BASE_URL || "https://api.joingobi.com";

export const WEBDRIVE_BASE_URL =
  process.env.GOBI_WEBDRIVE_BASE_URL || "https://webdrive.joingobi.com";

export const WEB_BASE_URL =
  process.env.GOBI_WEB_BASE_URL || "https://gobispace.com";

// Refresh before expiry so a long-running command doesn't 401 mid-flight.
export const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

// Device-code login: stop polling after this so a forgotten terminal doesn't loop forever.
export const POLL_MAX_DURATION_MS = 10 * 60 * 1000;

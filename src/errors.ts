export class AstraError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.code = code;
    this.name = "AstraError";
  }
}

export class NotAuthenticatedError extends AstraError {
  constructor() {
    super(
      "Not authenticated. Use 'gobi auth login' to begin the login flow.",
      "NOT_AUTHENTICATED",
    );
    this.name = "NotAuthenticatedError";
  }
}

export class TokenRefreshError extends AstraError {
  constructor(detail: string) {
    super(
      `Failed to refresh access token: ${detail}. Please run 'gobi auth login' to re-authenticate.`,
      "TOKEN_REFRESH_FAILED",
    );
    this.name = "TokenRefreshError";
  }
}

export class ApiError extends AstraError {
  status: number;
  endpoint: string;

  constructor(status: number, endpoint: string, body: string) {
    let message = body;
    try {
      const parsed = JSON.parse(body);
      if (parsed.message) message = parsed.message;
    } catch {
      // use raw body as-is
    }
    super(message, "API_ERROR");
    this.status = status;
    this.endpoint = endpoint;
    this.name = "ApiError";
  }
}

export class DeviceCodeError extends AstraError {
  constructor(detail: string) {
    super(`Device code flow error: ${detail}`, "DEVICE_CODE_ERROR");
    this.name = "DeviceCodeError";
  }
}

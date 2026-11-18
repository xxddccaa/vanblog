import { afterEach, describe, expect, it } from "vitest";
import {
  isRevalidateRequestAuthorized,
  isRevalidateTokenConfigured,
} from "../utils/revalidateAuth";
import { getInternalRequestSecret } from "../utils/loadConfig";

const SECRET_KEYS = [
  "NODE_ENV",
  "VANBLOG_ISR_TOKEN",
  "VANBLOG_SHARED_SECRET",
  "WALINE_JWT_TOKEN",
] as const;

describe("revalidateAuth", () => {
  const env = process.env as Record<(typeof SECRET_KEYS)[number], string | undefined>;
  const snapshot = Object.fromEntries(SECRET_KEYS.map((key) => [key, env[key]]));

  const clearSecrets = () => {
    delete env.VANBLOG_ISR_TOKEN;
    delete env.VANBLOG_SHARED_SECRET;
    delete env.WALINE_JWT_TOKEN;
  };

  afterEach(() => {
    for (const key of SECRET_KEYS) {
      if (snapshot[key] === undefined) {
        delete env[key];
      } else {
        env[key] = snapshot[key];
      }
    }
  });

  it("allows development revalidate requests when no token is configured", () => {
    env.NODE_ENV = "development";
    clearSecrets();

    expect(isRevalidateTokenConfigured()).toBe(false);
    expect(isRevalidateRequestAuthorized(null)).toBe(true);
  });

  it("requires a configured token in production", () => {
    env.NODE_ENV = "production";
    clearSecrets();
    env.VANBLOG_ISR_TOKEN = "isr-secret";

    expect(isRevalidateTokenConfigured()).toBe(true);
    expect(isRevalidateRequestAuthorized("wrong")).toBe(false);
    expect(isRevalidateRequestAuthorized("isr-secret")).toBe(true);
  });

  it("rejects every request in production when no secret is configured", () => {
    env.NODE_ENV = "production";
    clearSecrets();

    expect(isRevalidateTokenConfigured()).toBe(false);
    expect(isRevalidateRequestAuthorized("")).toBe(false);
    expect(isRevalidateRequestAuthorized(null)).toBe(false);
  });

  it("falls back to VANBLOG_SHARED_SECRET when a dedicated ISR token is absent", () => {
    env.NODE_ENV = "production";
    clearSecrets();
    env.VANBLOG_SHARED_SECRET = "shared-secret";
    env.WALINE_JWT_TOKEN = "legacy-secret";

    expect(isRevalidateTokenConfigured()).toBe(true);
    expect(isRevalidateRequestAuthorized("shared-secret")).toBe(true);
    expect(isRevalidateRequestAuthorized("legacy-secret")).toBe(false);
  });

  it("keeps the legacy WALINE_JWT_TOKEN as the last fallback", () => {
    env.NODE_ENV = "production";
    clearSecrets();
    env.WALINE_JWT_TOKEN = "legacy-secret";

    expect(isRevalidateTokenConfigured()).toBe(true);
    expect(isRevalidateRequestAuthorized("legacy-secret")).toBe(true);
    expect(isRevalidateRequestAuthorized("different")).toBe(false);
  });

  it("prefers the ISR token over both shared secret names", () => {
    env.NODE_ENV = "production";
    clearSecrets();
    env.VANBLOG_ISR_TOKEN = "isr-secret";
    env.VANBLOG_SHARED_SECRET = "shared-secret";
    env.WALINE_JWT_TOKEN = "legacy-secret";

    expect(isRevalidateRequestAuthorized("isr-secret")).toBe(true);
    expect(isRevalidateRequestAuthorized("shared-secret")).toBe(false);
  });

  it("uses the same precedence for internal server-side requests", () => {
    clearSecrets();
    expect(getInternalRequestSecret()).toBe("");

    env.WALINE_JWT_TOKEN = "legacy-secret";
    expect(getInternalRequestSecret()).toBe("legacy-secret");

    env.VANBLOG_SHARED_SECRET = "shared-secret";
    expect(getInternalRequestSecret()).toBe("shared-secret");

    env.VANBLOG_ISR_TOKEN = "isr-secret";
    expect(getInternalRequestSecret()).toBe("isr-secret");
  });
});

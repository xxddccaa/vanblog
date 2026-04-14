import { afterEach, describe, expect, it } from "vitest";
import {
  isRevalidateRequestAuthorized,
  isRevalidateTokenConfigured,
} from "../utils/revalidateAuth";

describe("revalidateAuth", () => {
  const oldNodeEnv = process.env.NODE_ENV;
  const oldToken = process.env.VANBLOG_ISR_TOKEN;
  const oldWalineToken = process.env.WALINE_JWT_TOKEN;

  afterEach(() => {
    if (oldNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = oldNodeEnv;
    }
    if (oldToken === undefined) {
      delete process.env.VANBLOG_ISR_TOKEN;
    } else {
      process.env.VANBLOG_ISR_TOKEN = oldToken;
    }
    if (oldWalineToken === undefined) {
      delete process.env.WALINE_JWT_TOKEN;
    } else {
      process.env.WALINE_JWT_TOKEN = oldWalineToken;
    }
  });

  it("allows development revalidate requests when no token is configured", () => {
    process.env.NODE_ENV = "development";
    delete process.env.VANBLOG_ISR_TOKEN;
    delete process.env.WALINE_JWT_TOKEN;

    expect(isRevalidateTokenConfigured()).toBe(false);
    expect(isRevalidateRequestAuthorized(null)).toBe(true);
  });

  it("requires a configured token in production", () => {
    process.env.NODE_ENV = "production";
    process.env.VANBLOG_ISR_TOKEN = "isr-secret";

    expect(isRevalidateTokenConfigured()).toBe(true);
    expect(isRevalidateRequestAuthorized("wrong")).toBe(false);
    expect(isRevalidateRequestAuthorized("isr-secret")).toBe(true);
  });

  it("falls back to WALINE_JWT_TOKEN when a dedicated ISR token is absent", () => {
    process.env.NODE_ENV = "production";
    delete process.env.VANBLOG_ISR_TOKEN;
    process.env.WALINE_JWT_TOKEN = "waline-shared-secret";

    expect(isRevalidateTokenConfigured()).toBe(true);
    expect(isRevalidateRequestAuthorized("waline-shared-secret")).toBe(true);
    expect(isRevalidateRequestAuthorized("different")).toBe(false);
  });
});

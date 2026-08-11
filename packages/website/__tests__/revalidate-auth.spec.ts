import { afterEach, describe, expect, it } from "vitest";
import {
  isRevalidateRequestAuthorized,
  isRevalidateTokenConfigured,
} from "../utils/revalidateAuth";

describe("revalidateAuth", () => {
  const env = process.env as {
    NODE_ENV?: string;
    VANBLOG_ISR_TOKEN?: string;
    WALINE_JWT_TOKEN?: string;
  };
  const oldNodeEnv = env.NODE_ENV;
  const oldToken = env.VANBLOG_ISR_TOKEN;
  const oldWalineToken = env.WALINE_JWT_TOKEN;

  afterEach(() => {
    if (oldNodeEnv === undefined) {
      delete env.NODE_ENV;
    } else {
      env.NODE_ENV = oldNodeEnv;
    }
    if (oldToken === undefined) {
      delete env.VANBLOG_ISR_TOKEN;
    } else {
      env.VANBLOG_ISR_TOKEN = oldToken;
    }
    if (oldWalineToken === undefined) {
      delete env.WALINE_JWT_TOKEN;
    } else {
      env.WALINE_JWT_TOKEN = oldWalineToken;
    }
  });

  it("allows development revalidate requests when no token is configured", () => {
    env.NODE_ENV = "development";
    delete env.VANBLOG_ISR_TOKEN;
    delete env.WALINE_JWT_TOKEN;

    expect(isRevalidateTokenConfigured()).toBe(false);
    expect(isRevalidateRequestAuthorized(null)).toBe(true);
  });

  it("requires a configured token in production", () => {
    env.NODE_ENV = "production";
    env.VANBLOG_ISR_TOKEN = "isr-secret";

    expect(isRevalidateTokenConfigured()).toBe(true);
    expect(isRevalidateRequestAuthorized("wrong")).toBe(false);
    expect(isRevalidateRequestAuthorized("isr-secret")).toBe(true);
  });

  it("falls back to WALINE_JWT_TOKEN when a dedicated ISR token is absent", () => {
    env.NODE_ENV = "production";
    delete env.VANBLOG_ISR_TOKEN;
    env.WALINE_JWT_TOKEN = "waline-shared-secret";

    expect(isRevalidateTokenConfigured()).toBe(true);
    expect(isRevalidateRequestAuthorized("waline-shared-secret")).toBe(true);
    expect(isRevalidateRequestAuthorized("different")).toBe(false);
  });
});

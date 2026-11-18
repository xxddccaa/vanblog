import { Injectable, Logger } from '@nestjs/common';
import IP2Region from 'ip2region';
import UAParser from 'ua-parser-js';
import { isPrivateClientIp, normalizeClientIp } from 'src/provider/log/utils';
import { CommentClientInfo, CommentClientInfoResolver } from 'src/types/comment.dto';

/** Upper bound for every display field derived from client input. */
export const CLIENT_INFO_FIELD_MAX_LENGTH = 64;

/** Longest user agent string handed to the parser. */
const USER_AGENT_MAX_LENGTH = 512;

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/gu;

/** Minimal surface of the ip2region searcher, injectable for tests. */
export interface RegionSearcher {
  search(ip: string): { country?: string; province?: string } | null;
}

/** Collapses whitespace, strips control characters and caps the length. */
export function cleanClientInfoField(value: unknown): string {
  return String(value ?? '')
    .replace(CONTROL_CHARACTERS, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, CLIENT_INFO_FIELD_MAX_LENGTH)
    .trim();
}

function joinProduct(name: unknown, version: unknown): string {
  const cleanName = cleanClientInfoField(name);
  if (!cleanName) return '';
  const cleanVersion = cleanClientInfoField(version);
  return cleanClientInfoField(cleanVersion ? `${cleanName} ${cleanVersion}` : cleanName);
}

/**
 * Derives the display metadata stored with a comment: a coarse location from
 * the bundled offline ip2region database (no network access) and the browser
 * and operating system from the user agent.
 */
@Injectable()
export class CommentClientInfoProvider implements CommentClientInfoResolver {
  private readonly logger = new Logger(CommentClientInfoProvider.name);
  private searcher: RegionSearcher | null = null;
  private searcherUnavailable = false;

  inspect(ip: string, userAgent: string): CommentClientInfo {
    return {
      location: this.safely(() => this.resolveLocation(ip)),
      ...this.safelyParseUserAgent(userAgent),
    };
  }

  /**
   * Province when the database knows it, otherwise the country. Unknown,
   * private, loopback and malformed addresses all resolve to ''.
   */
  resolveLocation(ip: unknown): string {
    const normalized = normalizeClientIp(ip);
    if (!normalized || isPrivateClientIp(normalized)) return '';
    const searcher = this.getSearcher();
    if (!searcher) return '';
    const result = searcher.search(normalized);
    if (!result) return '';
    return cleanClientInfoField(result.province) || cleanClientInfoField(result.country);
  }

  parseUserAgent(userAgent: unknown): { browser: string; os: string } {
    const ua = String(userAgent ?? '').slice(0, USER_AGENT_MAX_LENGTH);
    if (!ua.trim()) return { browser: '', os: '' };
    const result = new UAParser(ua).getResult();
    return {
      browser: joinProduct(result.browser?.name, result.browser?.major),
      os: joinProduct(result.os?.name, result.os?.version),
    };
  }

  private safelyParseUserAgent(userAgent: unknown): { browser: string; os: string } {
    try {
      return this.parseUserAgent(userAgent);
    } catch (error) {
      this.logger.warn(`User agent parsing failed: ${(error as Error)?.message || error}`);
      return { browser: '', os: '' };
    }
  }

  private safely(resolve: () => string): string {
    try {
      return resolve();
    } catch (error) {
      this.logger.warn(`IP location lookup failed: ${(error as Error)?.message || error}`);
      return '';
    }
  }

  /** Separate so tests can substitute the database. */
  protected createSearcher(): RegionSearcher {
    return new IP2Region();
  }

  /** Loads the ~11 MB database on first use; a broken install degrades to ''. */
  private getSearcher(): RegionSearcher | null {
    if (this.searcher) return this.searcher;
    if (this.searcherUnavailable) return null;
    try {
      this.searcher = this.createSearcher();
      return this.searcher;
    } catch (error) {
      this.searcherUnavailable = true;
      this.logger.error(`IP location database unavailable: ${(error as Error)?.message || error}`);
      return null;
    }
  }
}

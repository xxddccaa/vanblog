import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
  Optional,
} from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { randomBytes } from 'node:crypto';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { INACTIVE_PUBLIC_MASKER, maskPublicPayload, PublicMasker } from 'src/utils/publicMask';
import {
  PUBLIC_MASK_BASE64_FIELDS_METADATA,
  SKIP_PUBLIC_MASK_METADATA,
} from './public-mask.decorators';
import { PublicMaskProvider } from './public-mask.provider';

/** Keys that must never appear in anonymous output, at any depth. */
export const PUBLIC_OUTPUT_STRIPPED_KEYS = new Set(['password']);

/**
 * Replaces route params and query values that contain a masked term. It cannot
 * match any stored id, name, path, or search text, so every route answers exactly
 * as it does for a value that does not exist, and the mask list cannot be probed.
 */
export const PUBLIC_MASK_UNMATCHABLE_INPUT = `vanblog-masked-${randomBytes(8).toString('hex')}`;

const PUBLIC_CONTROLLER_PREFIX = 'api/public';

export const normalizeControllerPath = (value: unknown) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\/{2,}/g, '/')
    .replace(/^\/+|\/+$/g, '');

/**
 * A controller is public when its declared path starts with `api/public`.
 * Selection uses route metadata rather than `req.path`, because Express and Caddy
 * route case-insensitively and `/API/PUBLIC/...` would slip past a string check.
 */
export const isPublicOutputController = (controllerClass: unknown) => {
  if (!controllerClass) {
    return false;
  }
  const raw = Reflect.getMetadata(PATH_METADATA, controllerClass as object);
  const paths = Array.isArray(raw) ? raw : [raw];
  return paths.some((item) => {
    const normalized = normalizeControllerPath(item);
    return (
      normalized === PUBLIC_CONTROLLER_PREFIX ||
      normalized.startsWith(`${PUBLIC_CONTROLLER_PREFIX}/`)
    );
  });
};

const isPlainContainer = (value: unknown): value is Record<string, unknown> | unknown[] =>
  Array.isArray(value) || (typeof value === 'object' && value !== null);

/**
 * Returns a JSON-safe deep copy with sensitive keys removed. The copy matters:
 * handlers often return objects that also live in in-memory caches.
 */
export const stripPublicOutputKeys = <T>(payload: T): T => {
  if (!isPlainContainer(payload)) {
    return payload;
  }
  const cloned = JSON.parse(JSON.stringify(payload));
  const visit = (node: unknown) => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (!isPlainContainer(node)) {
      return;
    }
    for (const key of Object.keys(node)) {
      if (PUBLIC_OUTPUT_STRIPPED_KEYS.has(key.toLowerCase())) {
        delete (node as Record<string, unknown>)[key];
        continue;
      }
      visit((node as Record<string, unknown>)[key]);
    }
  };
  visit(cloned);
  return cloned;
};

const safeDecode = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const inputHasHit = (value: unknown, masker: PublicMasker): boolean => {
  if (typeof value === 'string') {
    // Handlers decode some params a second time, so check both forms.
    return masker.hasHit(value) || masker.hasHit(safeDecode(value));
  }
  if (Array.isArray(value)) {
    return value.some((item) => inputHasHit(item, masker));
  }
  if (value && typeof value === 'object') {
    return Object.values(value).some((item) => inputHasHit(item, masker));
  }
  return false;
};

/** Neutralizes request params and query values that contain masked terms. */
export const neutralizeMaskedInput = (req: any, masker: PublicMasker) => {
  if (!masker.active || !req) {
    return;
  }
  const params = req.params;
  if (params && typeof params === 'object') {
    for (const key of Object.keys(params)) {
      if (inputHasHit(params[key], masker)) {
        params[key] = PUBLIC_MASK_UNMATCHABLE_INPUT;
      }
    }
  }
  const query = req.query;
  if (query && typeof query === 'object') {
    let changed = false;
    const nextQuery: Record<string, unknown> = { ...query };
    for (const key of Object.keys(nextQuery)) {
      if (inputHasHit(nextQuery[key], masker)) {
        nextQuery[key] = PUBLIC_MASK_UNMATCHABLE_INPUT;
        changed = true;
      }
    }
    if (changed) {
      // Express 5 exposes req.query as a getter that re-parses the URL on every
      // access, so shadow it with an own property.
      Object.defineProperty(req, 'query', {
        value: nextQuery,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    }
  }
};

const bumpLastModified = (res: any, updatedAt?: string) => {
  if (!updatedAt || typeof res?.getHeader !== 'function') {
    return;
  }
  const existing = res.getHeader('Last-Modified');
  if (!existing) {
    return;
  }
  const current = new Date(String(existing)).getTime();
  const maskTime = new Date(updatedAt).getTime();
  if (!Number.isNaN(maskTime) && (Number.isNaN(current) || maskTime > current)) {
    res.setHeader('Last-Modified', new Date(maskTime).toUTCString());
  }
};

@Injectable()
export class PublicOutputInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    @Optional() private readonly publicMaskProvider?: PublicMaskProvider,
  ) {}

  shouldHandle(context: ExecutionContext) {
    if (context.getType() !== 'http') {
      return false;
    }
    if (!isPublicOutputController(context.getClass())) {
      return false;
    }
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_PUBLIC_MASK_METADATA, [
      context.getHandler(),
      context.getClass(),
    ]);
    return !skip;
  }

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    if (!this.shouldHandle(context)) {
      return next.handle();
    }
    // Throws 503 when the stored rules cannot compile: public output fails closed.
    const masker = this.publicMaskProvider
      ? await this.publicMaskProvider.getMasker()
      : INACTIVE_PUBLIC_MASKER;
    const http = context.switchToHttp();
    const req = http.getRequest();
    const res = http.getResponse();
    neutralizeMaskedInput(req, masker);
    const base64Paths =
      this.reflector.getAllAndOverride<string[]>(PUBLIC_MASK_BASE64_FIELDS_METADATA, [
        context.getHandler(),
        context.getClass(),
      ]) || [];

    return next.handle().pipe(
      map((body) => {
        const stripped = stripPublicOutputKeys(body);
        if (!masker.active) {
          return stripped;
        }
        const masked = maskPublicPayload(stripped, masker, { base64Paths });
        bumpLastModified(res, masker.updatedAt);
        return masked;
      }),
      catchError((error) => {
        if (masker.active && error instanceof HttpException) {
          const response = maskPublicPayload(stripPublicOutputKeys(error.getResponse()), masker);
          return throwError(() => new HttpException(response, error.getStatus()));
        }
        return throwError(() => error);
      }),
    );
  }
}

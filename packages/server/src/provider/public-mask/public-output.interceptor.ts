import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { SKIP_PUBLIC_MASK_METADATA } from './public-mask.decorators';

/** Keys that must never appear in anonymous output, at any depth. */
export const PUBLIC_OUTPUT_STRIPPED_KEYS = new Set(['password']);

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

@Injectable()
export class PublicOutputInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

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

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (!this.shouldHandle(context)) {
      return next.handle();
    }
    return next.handle().pipe(map((body) => stripPublicOutputKeys(body)));
  }
}

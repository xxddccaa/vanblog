import { BadRequestException } from '@nestjs/common';

export function normalizeCustomPageRoutePath(input?: string, allowRoot = true) {
  const raw = String(input || '')
    .trim()
    .replace(/[?#].*$/, '')
    .replace(/\\/g, '/');

  if (!raw) {
    throw new BadRequestException('自定义页面路径不能为空');
  }

  let pathname = raw;
  if (pathname === '/c') {
    pathname = '/';
  } else if (pathname.startsWith('/c/')) {
    pathname = pathname.slice(2);
  }

  if (!pathname.startsWith('/')) {
    pathname = `/${pathname}`;
  }

  const segments = pathname.split('/').filter(Boolean);
  if (segments.some((segment) => segment === '.' || segment === '..')) {
    throw new BadRequestException('自定义页面路径非法');
  }

  if (!segments.length) {
    if (!allowRoot) {
      throw new BadRequestException('自定义页面路径非法');
    }
    return '/';
  }

  return `/${segments.join('/')}`;
}

export function splitCustomPageRoutePath(input?: string) {
  const normalized = normalizeCustomPageRoutePath(input);
  return normalized === '/' ? [] : normalized.slice(1).split('/');
}

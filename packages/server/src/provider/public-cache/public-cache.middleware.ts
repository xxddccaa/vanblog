import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class PublicCacheMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    if (!['GET', 'HEAD'].includes(req.method)) {
      return next();
    }

    const path = req.path;

    if (path === '/api/public/search' || path === '/api/public/search/all') {
      res.setHeader('Cache-Control', 'no-store');
      return next();
    }

    if (
      path === '/api/public/viewer' ||
      path.startsWith('/api/public/article/viewer/') ||
      path.startsWith('/api/public/comment')
    ) {
      res.setHeader('Cache-Control', 'public, max-age=15, s-maxage=60, stale-while-revalidate=300');
      res.setHeader('Surrogate-Control', 'max-age=60, stale-while-revalidate=300');
      return next();
    }

    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=3600, stale-while-revalidate=86400');
    res.setHeader('Surrogate-Control', 'max-age=3600, stale-while-revalidate=86400');
    next();
  }
}

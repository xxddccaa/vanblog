import { Body, Controller, HttpStatus, Logger, Post, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { deflateRaw } from 'node:zlib';
import { CacheProvider } from 'src/provider/cache/cache.provider';
import { getRequestIp } from 'src/provider/log/utils';

const KROKI_URL = process.env.VANBLOG_KROKI_URL || 'http://kroki:8000';
const PLANTUML_URL = process.env.VANBLOG_PLANTUML_URL || '';
const PLANTUML_TYPES = new Set(['plantuml', 'puml', 'c4plantuml']);
const deflateRawAsync = promisify(deflateRaw);

const MAX_SOURCE_BYTES = 256 * 1024;
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const MAX_CACHE_BYTES = 20 * 1024 * 1024;
const MAX_CONCURRENT_RENDERS = 4;
const REQUEST_TIMEOUT_MS = 10_000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_REQUESTS = 30;
const GLOBAL_RATE_LIMIT_REQUESTS = 300;

async function plantumlEncode(text: string): Promise<string> {
  const compressed = await deflateRawAsync(Buffer.from(text, 'utf8'), { level: 6 });
  return encode64(compressed);
}

function encode6bit(b: number): string {
  if (b < 10) return String.fromCharCode(48 + b);
  b -= 10;
  if (b < 26) return String.fromCharCode(65 + b);
  b -= 26;
  if (b < 26) return String.fromCharCode(97 + b);
  b -= 26;
  if (b === 0) return '-';
  if (b === 1) return '_';
  return '?';
}

function append3bytes(b1: number, b2: number, b3: number): string {
  const c1 = b1 >> 2;
  const c2 = ((b1 & 0x3) << 4) | (b2 >> 4);
  const c3 = ((b2 & 0xf) << 2) | (b3 >> 6);
  const c4 = b3 & 0x3f;
  return encode6bit(c1 & 0x3f) + encode6bit(c2 & 0x3f) + encode6bit(c3 & 0x3f) + encode6bit(c4 & 0x3f);
}

function encode64(data: Buffer): string {
  let result = '';
  for (let i = 0; i < data.length; i += 3) {
    result += append3bytes(data[i], data[i + 1] || 0, data[i + 2] || 0);
  }
  return result;
}

const SUPPORTED_TYPES = new Set([
  'plantuml', 'graphviz', 'dot', 'd2', 'mermaid', 'vegalite', 'vega', 'wavedrom',
  'bytefield', 'ditaa', 'nomnoml', 'svgbob', 'umlet', 'excalidraw', 'structurizr',
  'c4plantuml', 'erd', 'blockdiag', 'seqdiag', 'actdiag', 'nwdiag', 'packetdiag', 'rackdiag',
]);
const SUPPORTED_FORMATS = new Set(['svg', 'png']);

interface RenderDiagramDto {
  type: string;
  source: string;
  format?: string;
  themeMode?: string;
}

interface CacheEntry {
  data: Buffer;
  contentType: string;
  timestamp: number;
  bytes: number;
}

const diagramCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 60 * 1000;
let cacheBytes = 0;
let activeRenders = 0;

function getCacheKey(type: string, source: string, format: string, themeMode: string): string {
  return createHash('sha256')
    .update(`${type}|${format}|${themeMode}|${source}`)
    .digest('hex')
    .slice(0, 32);
}

function removeCacheEntry(key: string) {
  const entry = diagramCache.get(key);
  if (entry) cacheBytes -= entry.bytes;
  diagramCache.delete(key);
}

function cacheResult(key: string, data: Buffer, contentType: string) {
  removeCacheEntry(key);
  const entry = { data, contentType, timestamp: Date.now(), bytes: data.byteLength };
  diagramCache.set(key, entry);
  cacheBytes += entry.bytes;
  while (cacheBytes > MAX_CACHE_BYTES && diagramCache.size) {
    removeCacheEntry(diagramCache.keys().next().value);
  }
}

async function readLimitedBody(response: globalThis.Response): Promise<Buffer> {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    throw new Error('diagram response exceeds size limit');
  }
  if (!response.body) return Buffer.alloc(0);

  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error('diagram response exceeds size limit');
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, total);
}

@ApiTags('diagram')
@Controller('/api/public/diagram')
export class DiagramController {
  private readonly logger = new Logger(DiagramController.name);

  constructor(private readonly cacheProvider: CacheProvider) {}

  @Post('render')
  @ApiOperation({ summary: '通过 Kroki 渲染图表' })
  async render(@Body() body: RenderDiagramDto, @Req() req: Request, @Res() res: Response) {
    const ip = getRequestIp(req) || 'unknown';
    const ipDigest = createHash('sha256').update(ip).digest('hex').slice(0, 24);
    const ttlSeconds = Math.ceil(RATE_LIMIT_WINDOW_MS / 1000);
    const [ipRequests, globalRequests] = await Promise.all([
      this.cacheProvider.incrementWithTtl(`diagram:rate:ip:${ipDigest}`, ttlSeconds),
      this.cacheProvider.incrementWithTtl('diagram:rate:global', ttlSeconds),
    ]);
    if (
      ipRequests > RATE_LIMIT_REQUESTS ||
      globalRequests > GLOBAL_RATE_LIMIT_REQUESTS
    ) {
      return res.status(HttpStatus.TOO_MANY_REQUESTS).json({ message: 'Too many diagram requests' });
    }

    const type = typeof body?.type === 'string' ? body.type : '';
    const source = typeof body?.source === 'string' ? body.source : '';
    const format = typeof body?.format === 'string' ? body.format : 'svg';
    const themeMode = body?.themeMode === 'dark' ? 'dark' : 'light';
    if (!type || !source) return res.status(400).json({ message: 'type and source are required' });
    if (Buffer.byteLength(source, 'utf8') > MAX_SOURCE_BYTES) {
      return res.status(HttpStatus.PAYLOAD_TOO_LARGE).json({ message: 'Diagram source is too large' });
    }

    const normalizedType = type.toLowerCase().trim();
    if (!SUPPORTED_TYPES.has(normalizedType)) {
      return res.status(400).json({ message: `Unsupported diagram type: ${type}` });
    }
    if (!SUPPORTED_FORMATS.has(format)) {
      return res.status(400).json({ message: `Unsupported format: ${format}` });
    }

    const cacheKey = getCacheKey(normalizedType, source, format, themeMode);
    const cached = diagramCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      res.setHeader('Content-Type', cached.contentType);
      res.setHeader('X-Diagram-Cache', 'hit');
      return res.send(cached.data);
    }
    if (cached) removeCacheEntry(cacheKey);
    if (activeRenders >= MAX_CONCURRENT_RENDERS) {
      return res.status(HttpStatus.SERVICE_UNAVAILABLE).json({ message: 'Diagram renderer is busy' });
    }

    activeRenders += 1;
    try {
      const krokiType = normalizedType === 'dot' ? 'graphviz' : normalizedType;
      const contentType = format === 'svg' ? 'image/svg+xml' : 'image/png';

      if (PLANTUML_TYPES.has(normalizedType) && PLANTUML_URL) {
        try {
          const encoded = await plantumlEncode(source);
          const response = await fetch(`${PLANTUML_URL}/${format}/${encoded}`, {
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          });
          if (response.ok) {
            const data = await readLimitedBody(response);
            cacheResult(cacheKey, data, contentType);
            res.setHeader('Content-Type', contentType);
            res.setHeader('X-Diagram-Cache', 'miss');
            return res.send(data);
          }
        } catch (error) {
          this.logger.warn(`PlantUML server failed, falling back to Kroki: ${error.message}`);
        }
      }

      const response = await fetch(`${KROKI_URL}/${krokiType}/${format}`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: source,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const data = await readLimitedBody(response);
      if (!response.ok) {
        const detail = data.toString('utf8').slice(0, 500);
        this.logger.warn(`Kroki render failed: ${response.status} - ${detail.slice(0, 200)}`);
        return res.status(502).json({ message: 'Diagram rendering failed', detail });
      }

      cacheResult(cacheKey, data, contentType);
      res.setHeader('Content-Type', contentType);
      res.setHeader('X-Diagram-Cache', 'miss');
      return res.send(data);
    } catch (error) {
      this.logger.error(`Kroki request failed: ${error.message}`);
      return res.status(503).json({ message: 'Kroki service unavailable' });
    } finally {
      activeRenders -= 1;
    }
  }
}

export function resetDiagramControllerStateForTests() {
  diagramCache.clear();
  cacheBytes = 0;
  activeRenders = 0;
}

import { Body, Controller, Logger, Post, Res } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';

const KROKI_URL = process.env.VANBLOG_KROKI_URL || 'http://kroki:8000';
const PLANTUML_URL = process.env.VANBLOG_PLANTUML_URL || '';

const PLANTUML_TYPES = new Set(['plantuml', 'puml', 'c4plantuml']);

function plantumlEncode(text: string): string {
  const zlib = require('zlib');
  const data = Buffer.from(text, 'utf8');
  const compressed = zlib.deflateRawSync(data, { level: 9 });
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
  let r = '';
  for (let i = 0; i < data.length; i += 3) {
    if (i + 2 === data.length) {
      r += append3bytes(data[i], data[i + 1], 0);
    } else if (i + 1 === data.length) {
      r += append3bytes(data[i], 0, 0);
    } else {
      r += append3bytes(data[i], data[i + 1], data[i + 2]);
    }
  }
  return r;
}

const SUPPORTED_TYPES = new Set([
  'plantuml',
  'graphviz',
  'dot',
  'd2',
  'mermaid',
  'vegalite',
  'vega',
  'wavedrom',
  'bytefield',
  'ditaa',
  'nomnoml',
  'svgbob',
  'umlet',
  'excalidraw',
  'structurizr',
  'c4plantuml',
  'erd',
  'blockdiag',
  'seqdiag',
  'actdiag',
  'nwdiag',
  'packetdiag',
  'rackdiag',
]);

const SUPPORTED_FORMATS = new Set(['svg', 'png']);

interface RenderDiagramDto {
  type: string;
  source: string;
  format?: string;
  themeMode?: string;
}

const diagramCache = new Map<string, { data: string; timestamp: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function getCacheKey(
  type: string,
  source: string,
  format: string,
  themeMode: string,
): string {
  const crypto = require('crypto');
  return crypto
    .createHash('sha256')
    .update(`${type}|${format}|${themeMode}|${source}`)
    .digest('hex')
    .slice(0, 32);
}

@ApiTags('diagram')
@Controller('/api/public/diagram')
export class DiagramController {
  private readonly logger = new Logger(DiagramController.name);

  @Post('render')
  @ApiOperation({ summary: '通过 Kroki 渲染图表' })
  async render(@Body() body: RenderDiagramDto, @Res() res: Response) {
    const { type, source, format = 'svg' } = body;
    const themeMode = body.themeMode === 'dark' ? 'dark' : 'light';

    if (!type || !source) {
      return res.status(400).json({ message: 'type and source are required' });
    }

    const normalizedType = type.toLowerCase().trim();
    if (!SUPPORTED_TYPES.has(normalizedType)) {
      return res
        .status(400)
        .json({ message: `Unsupported diagram type: ${type}` });
    }

    if (!SUPPORTED_FORMATS.has(format)) {
      return res
        .status(400)
        .json({ message: `Unsupported format: ${format}` });
    }

    const cacheKey = getCacheKey(normalizedType, source, format, themeMode);
    const cached = diagramCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      const contentType = format === 'svg' ? 'image/svg+xml' : 'image/png';
      res.setHeader('Content-Type', contentType);
      res.setHeader('X-Diagram-Cache', 'hit');
      return res.send(cached.data);
    }

    const krokiType = normalizedType === 'dot' ? 'graphviz' : normalizedType;

    // PlantUML: use dedicated PlantUML server if available (Kroki native binary often requires AVX2)
    if (PLANTUML_TYPES.has(normalizedType) && PLANTUML_URL) {
      try {
        const encoded = plantumlEncode(source);
        const pumlUrl = `${PLANTUML_URL}/${format === 'png' ? 'png' : 'svg'}/${encoded}`;
        const response = await fetch(pumlUrl);
        if (response.ok) {
          const data = await response.text();
          diagramCache.set(cacheKey, { data, timestamp: Date.now() });
          const contentType = format === 'svg' ? 'image/svg+xml' : 'image/png';
          res.setHeader('Content-Type', contentType);
          res.setHeader('X-Diagram-Cache', 'miss');
          return res.send(data);
        }
      } catch (error) {
        this.logger.warn(`PlantUML server failed, falling back to Kroki: ${error.message}`);
      }
    }

    // All Kroki diagrams render in default (light) colors; dark mode is handled
    // uniformly via a CSS filter on the frontend for a consistent soft-dark look.
    const url = `${KROKI_URL}/${krokiType}/${format}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: source,
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.warn(
          `Kroki render failed: ${response.status} - ${errorText.slice(0, 200)}`,
        );
        return res.status(502).json({
          message: 'Diagram rendering failed',
          detail: errorText.slice(0, 500),
        });
      }

      const data = await response.text();

      diagramCache.set(cacheKey, { data, timestamp: Date.now() });
      if (diagramCache.size > 500) {
        const oldest = [...diagramCache.entries()].sort(
          (a, b) => a[1].timestamp - b[1].timestamp,
        );
        for (let i = 0; i < 100; i++) {
          diagramCache.delete(oldest[i][0]);
        }
      }

      const contentType = format === 'svg' ? 'image/svg+xml' : 'image/png';
      res.setHeader('Content-Type', contentType);
      res.setHeader('X-Diagram-Cache', 'miss');
      return res.send(data);
    } catch (error) {
      this.logger.error(`Kroki request failed: ${error.message}`);
      return res.status(503).json({
        message: 'Kroki service unavailable',
        detail: error.message,
      });
    }
  }
}

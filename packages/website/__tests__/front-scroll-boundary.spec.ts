import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(__dirname, '../../..');
const globalsCss = fs.readFileSync(
  path.join(repoRoot, 'packages/website/styles/globals.css'),
  'utf8',
);

describe('front page scroll boundary styles', () => {
  it('prevents top-edge overscroll from exposing only the configured page background', () => {
    expect(globalsCss).toMatch(/html\s*\{[\s\S]*?overscroll-behavior-y:\s*none;/);
    expect(globalsCss).toMatch(/body\s*\{[\s\S]*?overscroll-behavior-y:\s*none;/);
  });

  it('keeps the mobile background attachment fallback in place', () => {
    expect(globalsCss).toContain('@media (max-width: 768px), (pointer: coarse), (hover: none)');
    expect(globalsCss).toMatch(/background-attachment:\s*scroll;/);
  });
});

import { readFileSync } from 'node:fs';

import dayjs from 'dayjs';

describe('admin app entry dependencies', () => {
  it('uses Day.js for the global update timestamp without importing Moment', () => {
    const source = readFileSync(new URL('./app.jsx', import.meta.url), 'utf8');

    expect(source).not.toMatch(/from ['"]moment['"]/);
    expect(source).toContain("import dayjs from 'dayjs'");
    expect(source).toMatch(/dayjs\(updatedAt\)\.format\(\s*['"]YYYY-MM-DD HH:mm:ss['"]/);
    expect(dayjs('2026-08-31T12:34:56').format('YYYY-MM-DD HH:mm:ss')).toBe('2026-08-31 12:34:56');
  });
});

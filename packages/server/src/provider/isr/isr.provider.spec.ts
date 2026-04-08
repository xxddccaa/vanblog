import { ISRProvider } from './isr.provider';

describe('ISRProvider', () => {
  const oldEnv = process.env['VANBLOG_WEBSITE_ISR_BASE'];

  afterAll(() => {
    if (oldEnv === undefined) {
      delete process.env['VANBLOG_WEBSITE_ISR_BASE'];
      return;
    }
    process.env['VANBLOG_WEBSITE_ISR_BASE'] = oldEnv;
  });

  it('reads the revalidate base URL from the environment', () => {
    process.env['VANBLOG_WEBSITE_ISR_BASE'] = 'http://website:3001/api/revalidate?path=';

    const provider = new ISRProvider({} as any, {} as any, {} as any, {} as any);

    expect(provider.base).toBe('http://website:3001/api/revalidate?path=');
  });
});

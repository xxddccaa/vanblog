import { PublicMaskController } from './public-mask.controller';
import { defaultPublicMaskSetting } from 'src/utils/publicMask';

const draft = {
  ...defaultPublicMaskSetting,
  enabled: false,
  replacements: { custom: 'X-CUSTOM-X', secret: 'X-SECRET-X', email: 'X-EMAIL-X', ip: 'X-IP-X' },
  rules: [{ id: 'kw', enabled: true, type: 'keyword', pattern: 'acmecore' }],
};

const createController = () => {
  const settingProvider = {
    getPublicMaskSetting: jest.fn().mockResolvedValue(draft),
    updatePublicMaskSetting: jest.fn(),
  };
  const publicMaskProvider = { invalidate: jest.fn() };
  const isrProvider = { refreshForPublicMaskChange: jest.fn().mockResolvedValue(undefined) };
  const scanService = {
    scan: jest.fn().mockResolvedValue({ items: [], totals: {}, warnings: {} }),
  };
  const controller = new PublicMaskController(
    settingProvider as any,
    publicMaskProvider as any,
    isrProvider as any,
    scanService as any,
  );
  return { controller, settingProvider, publicMaskProvider, isrProvider, scanService };
};

describe('PublicMaskController', () => {
  it('returns the setting with its compile status', async () => {
    const { controller } = createController();
    const result: any = await controller.getSetting();
    expect(result.data.setting).toEqual(draft);
    expect(result.data.status).toEqual(expect.objectContaining({ ok: true, active: false }));
  });

  it('saves valid settings, then invalidates the masker and refreshes public output', async () => {
    const { controller, settingProvider, publicMaskProvider, isrProvider } = createController();
    settingProvider.updatePublicMaskSetting.mockResolvedValue({
      value: { ...draft, enabled: true },
      errors: [],
    });

    const result: any = await controller.updateSetting({ ...draft, enabled: true });

    expect(result.statusCode).toBe(200);
    expect(result.data.status.active).toBe(true);
    expect(publicMaskProvider.invalidate).toHaveBeenCalled();
    expect(isrProvider.refreshForPublicMaskChange).toHaveBeenCalled();
  });

  it('reports validation errors without refreshing anything', async () => {
    const { controller, settingProvider, publicMaskProvider, isrProvider } = createController();
    settingProvider.updatePublicMaskSetting.mockResolvedValue({
      errors: [{ code: 'REGEX_INVALID', ruleId: 'r1' }],
    });

    const result: any = await controller.updateSetting({});

    expect(result.statusCode).toBe(400);
    expect(result.data.errors[0].code).toBe('REGEX_INVALID');
    expect(publicMaskProvider.invalidate).not.toHaveBeenCalled();
    expect(isrProvider.refreshForPublicMaskChange).not.toHaveBeenCalled();
  });

  it('previews a draft as if masking were enabled', async () => {
    const { controller } = createController();
    const result: any = await controller.preview({
      setting: draft,
      text: 'deploy acmecore to ops@example.org',
    });
    expect(result.data.masked).toBe('deploy X-CUSTOM-X to X-EMAIL-X');
    expect(result.data.hits.map((hit: any) => hit.kind)).toEqual(['custom', 'email']);
  });

  it('returns validation errors for an invalid preview draft', async () => {
    const { controller } = createController();
    const result: any = await controller.preview({
      setting: { rules: [{ type: 'regex', pattern: '(bad' }] },
      text: 'x',
    });
    expect(result.data.errors[0].code).toBe('REGEX_INVALID');
  });

  it('scans with an enabled masker built from the saved setting', async () => {
    const { controller, scanService } = createController();
    await controller.scan({});
    const masker = scanService.scan.mock.calls[0][0];
    expect(masker.active).toBe(true);
    expect(masker.mask('acmecore')).toBe('X-CUSTOM-X');
  });
});

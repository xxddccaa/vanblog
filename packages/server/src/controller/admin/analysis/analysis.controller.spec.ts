import { AnalysisController } from './analysis.controller';

describe('AnalysisController', () => {
  it('clamps invalid and oversized dashboard query sizes before hitting the provider', async () => {
    const analysisProvider = {
      getWelcomePageData: jest.fn().mockResolvedValue({ ok: true }),
    };

    const controller = new AnalysisController(analysisProvider as any);

    const result = await controller.getWelcomePageData(
      'viewer' as any,
      '9999' as any,
      '-3' as any,
      undefined as any,
    );

    expect(result).toEqual({
      statusCode: 200,
      data: { ok: true },
    });
    expect(analysisProvider.getWelcomePageData).toHaveBeenCalledWith('viewer', 5, 100, 5);
  });
});

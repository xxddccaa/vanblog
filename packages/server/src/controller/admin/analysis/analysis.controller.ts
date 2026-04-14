import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminGuard } from 'src/provider/auth/auth.guard';

import { AnalysisProvider, WelcomeTab } from 'src/provider/analysis/analysis.provider';
import { ApiToken } from 'src/provider/swagger/token';

@ApiTags('analysis')
@ApiToken
@UseGuards(...AdminGuard)
@Controller('/api/admin/analysis')
export class AnalysisController {
  constructor(private readonly analysisProvider: AnalysisProvider) {}

  private normalizePositiveInt(value: number | string | undefined, fallback: number, max: number) {
    const parsed = parseInt(String(value ?? ''), 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
      return fallback;
    }
    return Math.min(parsed, max);
  }

  @Get()
  async getWelcomePageData(
    @Query('tab') tab: WelcomeTab,
    @Query('viewerDataNum') viewerDataNum = 5,
    @Query('overviewDataNum') overviewDataNum = 5,
    @Query('articleTabDataNum') articleTabDataNum = 5,
  ) {
    const data = await this.analysisProvider.getWelcomePageData(
      tab,
      this.normalizePositiveInt(overviewDataNum, 5, 100),
      this.normalizePositiveInt(viewerDataNum, 5, 100),
      this.normalizePositiveInt(articleTabDataNum, 5, 100),
    );
    return {
      statusCode: 200,
      data,
    };
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AiQaProvider } from 'src/provider/ai-qa/ai-qa.provider';

@Injectable()
export class AiQaTask {
  private readonly logger = new Logger(AiQaTask.name);

  constructor(private readonly aiQaProvider: AiQaProvider) {}

  @Cron('0 0 3 * * *')
  async runNightlySync() {
    try {
      const summary = await this.aiQaProvider.runNightlyFullSync();
      if (summary) {
        this.logger.log(`AI 问答夜间全量同步完成: ${JSON.stringify(summary)}`);
      }
    } catch (error) {
      this.logger.error(
        'AI 问答夜间全量同步失败',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}

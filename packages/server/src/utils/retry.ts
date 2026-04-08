import { Logger } from '@nestjs/common';
import { sleep } from './sleep';

interface RetryOptions {
  attempts?: number;
  delayMs?: number;
  logger?: Logger;
  description: string;
}

export const withRetry = async <T>(
  fn: () => Promise<T>,
  { attempts = 10, delayMs = 3000, logger, description }: RetryOptions,
): Promise<T> => {
  let lastError: any;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt >= attempts) {
        break;
      }
      logger?.warn(
        `${description} 失败，第 ${attempt}/${attempts} 次重试，${delayMs}ms 后继续：${
          error?.message || error
        }`,
      );
      await sleep(delayMs);
    }
  }

  throw lastError;
};

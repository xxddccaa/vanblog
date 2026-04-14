import axios from 'axios';
import { BadRequestException } from '@nestjs/common';
import { AITaggingProvider } from './ai-tagging.provider';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AITaggingProvider', () => {
  beforeEach(() => {
    mockedAxios.post.mockReset();
  });

  const createProvider = () =>
    new AITaggingProvider(
      {
        findOne: jest.fn(),
        updateOne: jest.fn(),
      } as any,
      {} as any,
    );

  it('posts tag generation requests to normalized public AI endpoints', async () => {
    mockedAxios.post.mockResolvedValue({
      data: {
        choices: [{ message: { content: 'seo, cache, nextjs' } }],
      },
    } as any);
    const provider = createProvider();

    const result = await provider.generateTags({
      baseUrl: 'https://api.openai.com/v1/',
      apiKey: 'secret',
      conversations: [{ role: 'user', content: 'hello' }],
    });

    expect(result).toBe('seo, cache, nextjs');
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.any(Object),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer secret',
        }),
      }),
    );
  });

  it('rejects localhost and private network AI endpoints before any request is sent', async () => {
    const provider = createProvider();

    await expect(
      provider.generateTags({
        baseUrl: 'http://127.0.0.1:11434/v1',
        apiKey: 'secret',
        conversations: [],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      provider.generateTags({
        baseUrl: 'http://localhost:3000/v1',
        apiKey: 'secret',
        conversations: [],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('rejects non-http protocols and credentialed base urls', async () => {
    const provider = createProvider();

    await expect(
      provider.generateTags({
        baseUrl: 'ftp://example.com/v1',
        apiKey: 'secret',
        conversations: [],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      provider.generateTags({
        baseUrl: 'https://user:pass@example.com/v1',
        apiKey: 'secret',
        conversations: [],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('surfaces upstream AI API error messages', async () => {
    mockedAxios.post.mockRejectedValue({
      isAxiosError: true,
      response: {
        data: {
          error: {
            message: 'Incorrect API key provided',
          },
        },
      },
      message: 'Request failed with status code 401',
    });
    const provider = createProvider();

    await expect(
      provider.generateTags({
        baseUrl: 'https://api.stepfun.com/v1',
        apiKey: 'secret',
        model: 'step-3',
        conversations: [{ role: 'user', content: 'hello' }],
      }),
    ).rejects.toThrow('AI标签生成失败: Incorrect API key provided');
  });
});

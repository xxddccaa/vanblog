import { Controller, Get, Request } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AiQaTerminalProvider } from 'src/provider/ai-qa/ai-qa-terminal.provider';

@ApiTags('ai-qa-terminal')
@Controller('/api/admin/ai-qa/terminal')
export class AiQaTerminalAuthController {
  constructor(private readonly aiQaTerminalProvider: AiQaTerminalProvider) {}

  @Get('/auth')
  async auth(@Request() request: any) {
    const data = await this.aiQaTerminalProvider.authorizeRequest(request);
    return {
      statusCode: 200,
      data,
    };
  }
}

import { Controller, Delete, Get, Post, Request, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { AiQaTerminalProvider } from 'src/provider/ai-qa/ai-qa-terminal.provider';
import { AdminGuard } from 'src/provider/auth/auth.guard';
import { ApiToken } from 'src/provider/swagger/token';

@ApiTags('ai-qa-terminal')
@UseGuards(...AdminGuard)
@ApiToken
@Controller('/api/admin/ai-qa/terminal')
export class AiQaTerminalController {
  constructor(private readonly aiQaTerminalProvider: AiQaTerminalProvider) {}

  @Get('/status')
  getStatus() {
    return {
      statusCode: 200,
      data: this.aiQaTerminalProvider.getStatus(),
    };
  }

  @Post('/session')
  async openSession(@Request() request: any, @Res({ passthrough: true }) response: Response) {
    const data = await this.aiQaTerminalProvider.openSession(request?.user, request, response);
    return {
      statusCode: 200,
      data,
    };
  }

  @Delete('/session')
  clearSession(@Request() request: any, @Res({ passthrough: true }) response: Response) {
    return {
      statusCode: 200,
      data: this.aiQaTerminalProvider.clearSession(request, response),
    };
  }
}

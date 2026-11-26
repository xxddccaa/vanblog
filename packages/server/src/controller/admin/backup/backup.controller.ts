import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { AdminGuard } from 'src/provider/auth/auth.guard';
import { BackupProvider } from 'src/provider/backup/backup.provider';
import { ApiToken } from 'src/provider/swagger/token';

@ApiTags('backup')
@UseGuards(...AdminGuard)
@ApiToken
@Controller('/api/admin/backup')
export class BackupController {
  constructor(private readonly backupProvider: BackupProvider) {}

  @Get('export')
  async getAll(@Res() res: Response) {
    return await this.backupProvider.exportBackup(res);
  }

  @Post('/import')
  @UseInterceptors(FileInterceptor('file'))
  async importAll(@UploadedFile() file: Express.Multer.File, @Body() body: any) {
    return await this.backupProvider.importAll(file, body);
  }

  @Get('/import/status/:jobId')
  async getImportStatus(@Param('jobId') jobId: string) {
    return await this.backupProvider.getImportStatus(jobId);
  }

  async importAllSync(file: Express.Multer.File, includeAnalytics = false) {
    return await this.backupProvider.importAllSync(file, includeAnalytics);
  }

  @Post('/clear-all')
  async clearAllData() {
    return await this.backupProvider.clearAllData();
  }
}

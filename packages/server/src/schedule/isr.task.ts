import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ISRProvider } from 'src/provider/isr/isr.provider';
@Injectable()
export class ISRTask {
  constructor(private readonly isrProvider: ISRProvider) {}

  @Cron('0 0 2 * * *')
  async handleCron() {
    // 每天凌晨2点触发一次 ISR，减少频繁的全量渲染
    // 这样可以预防某些情况下，服务端渲染了默认黑色主题，可是客户端是白天导致的闪屏问题。
    this.isrProvider.activeAll('定时触发 ISR');
  }
}

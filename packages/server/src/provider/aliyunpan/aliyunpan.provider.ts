import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

@Injectable()
export class AliyunpanProvider {
  private readonly logger = new Logger(AliyunpanProvider.name);
  private readonly configDir = '/root/.config/aliyunpan';
  private readonly configFile = path.join(this.configDir, 'config.json');

  // 获取登录状态
  async getLoginStatus(): Promise<{ isLoggedIn: boolean; userInfo?: any }> {
    try {
      const { stdout } = await execAsync('aliyunpan who');
      
      if (stdout.includes('未登录账号')) {
        return { isLoggedIn: false };
      }
      
      // 解析用户信息
      const userInfo = this.parseUserInfo(stdout);
      return { isLoggedIn: true, userInfo };
    } catch (error) {
      this.logger.error('获取登录状态失败:', error.message);
      return { isLoggedIn: false };
    }
  }

  private loginProcess: any = null;

  // 生成登录链接并启动登录进程
  async generateLoginUrl(): Promise<{ loginUrl?: string; error?: string }> {
    try {
      // 如果已有登录进程在运行，先清理
      if (this.loginProcess) {
        this.loginProcess.kill();
        this.loginProcess = null;
      }

      const { spawn } = require('child_process');
      
      // 启动 aliyunpan login 进程
      this.loginProcess = spawn('aliyunpan', ['login'], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let loginUrl = '';
      let hasError = false;

             // 监听输出获取登录链接
       return new Promise((resolve) => {
         const timeout = setTimeout(() => {
           if (this.loginProcess) {
             this.loginProcess.kill();
             this.loginProcess = null;
           }
           resolve({ error: '获取登录链接超时' });
         }, 15000); // 15秒超时

         this.loginProcess.stdout.on('data', (data) => {
           const output = data.toString();
           this.logger.log('aliyunpan login 输出:', output);
           
           // 查找登录链接
           const urlMatch = output.match(/(https:\/\/openapi\.alipan\.com[^\s\n]+)/);
           if (urlMatch && !loginUrl) {
             loginUrl = urlMatch[1];
             clearTimeout(timeout);
             // 不要在这里结束进程，保持进程活跃等待用户完成登录
             resolve({ loginUrl });
           }
         });

         this.loginProcess.stderr.on('data', (data) => {
           const error = data.toString();
           this.logger.error('aliyunpan login 错误:', error);
           if (!hasError) {
             hasError = true;
             clearTimeout(timeout);
             if (this.loginProcess) {
               this.loginProcess.kill();
               this.loginProcess = null;
             }
             resolve({ error: `登录进程错误: ${error}` });
           }
         });

         this.loginProcess.on('exit', (code) => {
           this.logger.log(`aliyunpan login 进程退出，代码: ${code}`);
           // 进程退出时清理引用
           this.loginProcess = null;
           
           // 只有在没有获取到登录链接且没有其他错误时才报错
           if (!loginUrl && !hasError) {
             clearTimeout(timeout);
             resolve({ error: '登录进程异常退出' });
           }
         });
       });
    } catch (error) {
      this.logger.error('启动登录进程失败:', error.message);
      return { error: error.message };
    }
  }

    // 完成登录（向已存在的登录进程发送回车键）
  async completeLogin(): Promise<{ success: boolean; message: string }> {
    try {
      if (!this.loginProcess) {
        return { success: false, message: '没有活跃的登录进程，请先点击"登录阿里云盘"' };
      }

      // 检查进程是否还存在且stdin可用
      if (!this.loginProcess.stdin || this.loginProcess.stdin.destroyed) {
        this.loginProcess = null;
        return { success: false, message: '登录进程已失效，请重新开始登录' };
      }

      this.logger.log('向登录进程发送回车键');
      this.loginProcess.stdin.write('\n');
      
      // 等待一段时间让登录完成
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // 检查登录状态
      const status = await this.getLoginStatus();
      
      // 清理登录进程
      if (this.loginProcess) {
        this.loginProcess.kill();
        this.loginProcess = null;
      }

      if (status.isLoggedIn) {
        return { success: true, message: '登录成功' };
      } else {
        return { success: false, message: '登录未完成，请确保已在浏览器中完成扫码后再点击"完成登录"' };
      }
    } catch (error) {
      this.logger.error('完成登录失败:', error.message);
      if (this.loginProcess) {
        this.loginProcess.kill();
        this.loginProcess = null;
      }
      return { success: false, message: error.message };
    }
  }

  // 检查登录完成状态
  async checkLoginCompletion(): Promise<{ isCompleted: boolean; userInfo?: any }> {
    try {
      const status = await this.getLoginStatus();
      return {
        isCompleted: status.isLoggedIn,
        userInfo: status.userInfo
      };
    } catch (error) {
      this.logger.error('检查登录完成状态失败:', error.message);
      return { isCompleted: false };
    }
  }

  // 退出登录
  async logout(): Promise<{ success: boolean; message: string }> {
    try {
      const { spawn } = require('child_process');
      
      return new Promise((resolve) => {
        // 启动 aliyunpan logout 进程
        const logoutProcess = spawn('aliyunpan', ['logout'], {
          stdio: ['pipe', 'pipe', 'pipe']
        });

        let output = '';
        let hasError = false;

        const timeout = setTimeout(() => {
          logoutProcess.kill();
          resolve({ success: false, message: '退出登录超时' });
        }, 10000); // 10秒超时

        logoutProcess.stdout.on('data', (data) => {
          const text = data.toString();
          output += text;
          this.logger.log('aliyunpan logout 输出:', text);
          
          // 如果看到确认提示，自动发送 'y'
          if (text.includes('? (y/n)') || text.includes('(y/n) >')) {
            this.logger.log('发送确认退出指令');
            logoutProcess.stdin.write('y\n');
          }
        });

        logoutProcess.stderr.on('data', (data) => {
          const error = data.toString();
          this.logger.error('aliyunpan logout 错误:', error);
          if (!hasError) {
            hasError = true;
            clearTimeout(timeout);
            logoutProcess.kill();
            resolve({ success: false, message: `退出登录错误: ${error}` });
          }
        });

        logoutProcess.on('exit', (code) => {
          clearTimeout(timeout);
          this.logger.log(`aliyunpan logout 进程退出，代码: ${code}`);
          
          if (code === 0 || output.includes('退出用户成功')) {
            resolve({ success: true, message: '退出登录成功' });
          } else if (!hasError) {
            resolve({ success: false, message: '退出登录失败' });
          }
        });
      });
    } catch (error) {
      this.logger.error('退出登录失败:', error.message);
      return { success: false, message: error.message };
    }
  }

  // 执行同步备份
  async executeSync(localPath: string, panPath: string): Promise<{ success: boolean; message: string }> {
    try {
      // 确保本地路径存在
      if (!fs.existsSync(localPath)) {
        throw new Error(`本地路径不存在: ${localPath}`);
      }

      // 构建同步命令 - 使用onetime模式进行一次性备份
      const command = `aliyunpan sync start -ldir "${localPath}" -pdir "${panPath}" -mode "upload" -policy "increment" -cycle "onetime" -drive "backup" -log "true"`;
      
      this.logger.log(`执行阿里云盘同步: ${command}`);
      
      // 设置较长的超时时间，因为备份可能需要较长时间
      const { stdout, stderr } = await execAsync(command, { timeout: 30 * 60 * 1000 }); // 30分钟超时
      
      this.logger.log(`同步输出: ${stdout}`);
      if (stderr) {
        this.logger.warn(`同步警告: ${stderr}`);
      }

      return { success: true, message: '阿里云盘同步完成' };
    } catch (error) {
      this.logger.error('阿里云盘同步失败:', error.message);
      return { success: false, message: error.message };
    }
  }

  // 测试阿里云盘连接
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const { stdout } = await execAsync('aliyunpan ls /');
      return { success: true, message: '连接测试成功' };
    } catch (error) {
      this.logger.error('阿里云盘连接测试失败:', error.message);
      return { success: false, message: error.message };
    }
  }

  // 获取网盘空间信息
  async getQuotaInfo(): Promise<{ quota?: any; error?: string }> {
    try {
      const { stdout } = await execAsync('aliyunpan quota');
      const quotaInfo = this.parseQuotaInfo(stdout);
      return { quota: quotaInfo };
    } catch (error) {
      this.logger.error('获取网盘配额失败:', error.message);
      return { error: error.message };
    }
  }

  // 解析用户信息
  private parseUserInfo(output: string): any {
    try {
      const lines = output.split('\n').filter(line => line.trim());
      const userInfo: any = {};
      
      for (const line of lines) {
        if (line.includes('用户ID:')) {
          userInfo.userId = line.split(':')[1]?.trim();
        } else if (line.includes('用户名:')) {
          userInfo.userName = line.split(':')[1]?.trim();
        } else if (line.includes('昵称:')) {
          userInfo.nickName = line.split(':')[1]?.trim();
        }
      }
      
      return userInfo;
    } catch (error) {
      this.logger.warn('解析用户信息失败:', error.message);
      return null;
    }
  }

  // 解析配额信息
  private parseQuotaInfo(output: string): any {
    try {
      const lines = output.split('\n').filter(line => line.trim());
      const quotaInfo: any = {};
      
      for (const line of lines) {
        if (line.includes('总空间:')) {
          quotaInfo.totalSpace = line.split(':')[1]?.trim();
        } else if (line.includes('已使用:')) {
          quotaInfo.usedSpace = line.split(':')[1]?.trim();
        } else if (line.includes('可用空间:')) {
          quotaInfo.freeSpace = line.split(':')[1]?.trim();
        }
      }
      
      return quotaInfo;
    } catch (error) {
      this.logger.warn('解析配额信息失败:', error.message);
      return null;
    }
  }
} 
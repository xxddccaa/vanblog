import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CacheProvider } from '../cache/cache.provider';

export type BackupImportJobStatus = 'queued' | 'running' | 'completed' | 'failed';
export type BackupImportStageStatus = 'pending' | 'running' | 'completed' | 'skipped';

export interface BackupImportStage {
  key: string;
  label: string;
  total: number;
  completed: number;
  status: BackupImportStageStatus;
  detail?: string;
}

export interface BackupImportJob {
  id: string;
  status: BackupImportJobStatus;
  progress: number;
  message: string;
  currentStageKey?: string;
  currentStageLabel?: string;
  currentStageDetail?: string;
  createdAt: string;
  startedAt?: string;
  updatedAt: string;
  finishedAt?: string;
  stages: BackupImportStage[];
  summary?: Record<string, any>;
  result?: Record<string, any>;
  error?: string;
}

const JOB_PREFIX = 'vanblog:backup-import:job:';
const ACTIVE_JOB_KEY = 'vanblog:backup-import:active';
const JOB_TTL_SECONDS = 60 * 60 * 24;

@Injectable()
export class BackupImportJobProvider {
  constructor(private readonly cacheProvider: CacheProvider) {}

  private getJobKey(jobId: string) {
    return `${JOB_PREFIX}${jobId}`;
  }

  private normalizeStages(stages: Array<{ key: string; label: string; total?: number }>) {
    return stages.map((stage) => ({
      key: stage.key,
      label: stage.label,
      total: Math.max(1, Number(stage.total) || 1),
      completed: 0,
      status: 'pending' as BackupImportStageStatus,
    }));
  }

  private computeProgress(stages: BackupImportStage[]) {
    const totalUnits = stages.reduce((sum, stage) => sum + Math.max(1, stage.total || 1), 0);
    if (!totalUnits) {
      return 0;
    }
    const completedUnits = stages.reduce((sum, stage) => {
      const stageTotal = Math.max(1, stage.total || 1);
      if (stage.status === 'completed' || stage.status === 'skipped') {
        return sum + stageTotal;
      }
      return sum + Math.min(stage.completed || 0, stageTotal);
    }, 0);
    return Math.max(0, Math.min(100, Math.round((completedUnits / totalUnits) * 100)));
  }

  private async saveJob(job: BackupImportJob) {
    job.progress = this.computeProgress(job.stages);
    job.updatedAt = new Date().toISOString();
    await this.cacheProvider.set(this.getJobKey(job.id), job, JOB_TTL_SECONDS);
    return job;
  }

  async createJob(
    stages: Array<{ key: string; label: string; total?: number }>,
    summary?: Record<string, any>,
  ) {
    const existing = await this.getActiveJob();
    if (existing && (existing.status === 'queued' || existing.status === 'running')) {
      return {
        created: false,
        job: existing,
      };
    }

    const now = new Date().toISOString();
    const job: BackupImportJob = {
      id: randomUUID(),
      status: 'queued',
      progress: 0,
      message: '备份文件已接收，等待开始导入',
      createdAt: now,
      updatedAt: now,
      stages: this.normalizeStages(stages),
      summary,
    };
    await this.cacheProvider.set(ACTIVE_JOB_KEY, job.id, JOB_TTL_SECONDS);
    await this.saveJob(job);
    return {
      created: true,
      job,
    };
  }

  async getJob(jobId: string) {
    if (!jobId) {
      return null;
    }
    return (await this.cacheProvider.get(this.getJobKey(jobId))) as BackupImportJob | null;
  }

  async getActiveJob() {
    const activeJobId = await this.cacheProvider.get(ACTIVE_JOB_KEY);
    if (!activeJobId) {
      return null;
    }
    const job = await this.getJob(activeJobId);
    if (!job || (job.status !== 'queued' && job.status !== 'running')) {
      await this.cacheProvider.del(ACTIVE_JOB_KEY);
      return null;
    }
    return job;
  }

  private async updateJob(jobId: string, updater: (job: BackupImportJob) => BackupImportJob | void) {
    const job = await this.getJob(jobId);
    if (!job) {
      return null;
    }
    const next = updater(job) || job;
    await this.saveJob(next);
    return next;
  }

  async markRunning(jobId: string, message = '开始后台导入') {
    return await this.updateJob(jobId, (job) => {
      job.status = 'running';
      job.message = message;
      job.startedAt = job.startedAt || new Date().toISOString();
    });
  }

  async startStage(jobId: string, stageKey: string, detail?: string) {
    return await this.updateJob(jobId, (job) => {
      const stage = job.stages.find((item) => item.key === stageKey);
      if (!stage) {
        return;
      }
      stage.status = 'running';
      stage.detail = detail;
      job.currentStageKey = stage.key;
      job.currentStageLabel = stage.label;
      job.currentStageDetail = detail;
      job.message = `${stage.label}${detail ? `：${detail}` : ''}`;
    });
  }

  async advanceStage(jobId: string, stageKey: string, completed: number, detail?: string) {
    return await this.updateJob(jobId, (job) => {
      const stage = job.stages.find((item) => item.key === stageKey);
      if (!stage) {
        return;
      }
      stage.status = 'running';
      stage.completed = Math.max(0, Math.min(stage.total, completed));
      stage.detail = detail;
      job.currentStageKey = stage.key;
      job.currentStageLabel = stage.label;
      job.currentStageDetail = detail;
      job.message = `${stage.label} ${stage.completed}/${stage.total}${detail ? ` - ${detail}` : ''}`;
    });
  }

  async completeStage(jobId: string, stageKey: string, detail?: string) {
    return await this.updateJob(jobId, (job) => {
      const stage = job.stages.find((item) => item.key === stageKey);
      if (!stage) {
        return;
      }
      stage.status = 'completed';
      stage.completed = stage.total;
      stage.detail = detail;
      job.currentStageKey = stage.key;
      job.currentStageLabel = stage.label;
      job.currentStageDetail = detail;
      job.message = `${stage.label}完成${detail ? `：${detail}` : ''}`;
    });
  }

  async skipStage(jobId: string, stageKey: string, detail?: string) {
    return await this.updateJob(jobId, (job) => {
      const stage = job.stages.find((item) => item.key === stageKey);
      if (!stage) {
        return;
      }
      stage.status = 'skipped';
      stage.completed = stage.total;
      stage.detail = detail;
      job.message = detail || `${stage.label}已跳过`;
    });
  }

  async completeJob(jobId: string, result?: Record<string, any>, message = '导入完成') {
    const job = await this.updateJob(jobId, (current) => {
      if (current.status === 'completed' || current.status === 'failed') {
        return current;
      }
      current.status = 'completed';
      current.progress = 100;
      current.message = message;
      current.finishedAt = new Date().toISOString();
      current.result = result;
      current.currentStageDetail = undefined;
      current.stages = current.stages.map((stage) => ({
        ...stage,
        status: stage.status === 'pending' ? 'skipped' : stage.status,
        completed: stage.status === 'pending' ? stage.total : Math.max(stage.completed, stage.total),
      }));
    });
    await this.cacheProvider.del(ACTIVE_JOB_KEY);
    return job;
  }

  async failJob(jobId: string, error: string) {
    const job = await this.updateJob(jobId, (current) => {
      if (current.status === 'completed' || current.status === 'failed') {
        return current;
      }
      current.status = 'failed';
      current.message = `导入失败：${error}`;
      current.error = error;
      current.finishedAt = new Date().toISOString();
    });
    await this.cacheProvider.del(ACTIVE_JOB_KEY);
    return job;
  }
}

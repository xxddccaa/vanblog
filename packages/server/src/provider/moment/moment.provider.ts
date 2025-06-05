import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateMomentDto, SearchMomentOption, UpdateMomentDto } from 'src/types/moment.dto';
import { Moment, MomentDocument } from 'src/scheme/moment.schema';
import { sleep } from 'src/utils/sleep';

export type MomentView = 'admin' | 'public';

@Injectable()
export class MomentProvider {
  idLock = false;
  constructor(
    @InjectModel('Moment')
    private momentModel: Model<MomentDocument>,
  ) {}

  publicView = {
    id: 1,
    content: 1,
    createdAt: 1,
    updatedAt: 1,
    _id: 0,
  };

  adminView = {
    id: 1,
    content: 1,
    createdAt: 1,
    updatedAt: 1,
    deleted: 1,
    _id: 0,
  };

  async create(createMomentDto: CreateMomentDto): Promise<Moment> {
    const createdData = new this.momentModel(createMomentDto);
    const newId = await this.getNewId();
    createdData.id = newId;
    const res = await createdData.save();
    return res;
  }

  async getByOption(
    option: SearchMomentOption,
    isPublic: boolean,
  ): Promise<{ moments: Moment[]; total: number }> {
    const { page, pageSize, sortCreatedAt, startTime, endTime } = option;
    const view = isPublic ? this.publicView : this.adminView;

    // 两种视图都只显示未删除的动态
    let filter: any = {
      $or: [
        { deleted: false },
        { deleted: { $exists: false } },
      ],
    };

    // 时间过滤
    if (startTime || endTime) {
      filter.createdAt = {};
      if (startTime) {
        filter.createdAt.$gte = new Date(startTime);
      }
      if (endTime) {
        filter.createdAt.$lte = new Date(endTime);
      }
    }

    // 排序
    let sort: any = { createdAt: -1 }; // 默认按创建时间倒序
    if (sortCreatedAt) {
      sort.createdAt = sortCreatedAt === 'asc' ? 1 : -1;
    }

    const total = await this.momentModel.countDocuments(filter);
    
    const moments = await this.momentModel
      .find(filter, view)
      .sort(sort)
      .skip((page - 1) * pageSize)
      .limit(pageSize);

    return { moments, total };
  }

  async getById(id: number, view: MomentView): Promise<Moment> {
    const viewFields = view === 'admin' ? this.adminView : this.publicView;
    
    // 两种视图都只能获取未删除的动态
    let filter: any = {
      id,
      $or: [
        { deleted: false },
        { deleted: { $exists: false } },
      ],
    };

    const moment = await this.momentModel.findOne(filter, viewFields);
    
    if (!moment) {
      throw new NotFoundException('动态不存在');
    }
    
    return moment;
  }

  async updateById(id: number, updateMomentDto: UpdateMomentDto): Promise<Moment> {
    updateMomentDto.updatedAt = new Date();
    
    // 只能更新未删除的动态
    const updatedMoment = await this.momentModel.findOneAndUpdate(
      { 
        id,
        $or: [
          { deleted: false },
          { deleted: { $exists: false } },
        ],
      },
      updateMomentDto,
      { new: true, fields: this.adminView }
    );
    
    if (!updatedMoment) {
      throw new NotFoundException('动态不存在');
    }
    
    return updatedMoment;
  }

  async deleteById(id: number): Promise<void> {
    const result = await this.momentModel.updateOne(
      { 
        id,
        $or: [
          { deleted: false },
          { deleted: { $exists: false } },
        ],
      },
      { deleted: true, updatedAt: new Date() }
    );
    
    if (result.matchedCount === 0) {
      throw new NotFoundException('动态不存在');
    }
  }

  async getTotalNum(): Promise<number> {
    return await this.momentModel.countDocuments({
      $or: [
        { deleted: false },
        { deleted: { $exists: false } },
      ],
    });
  }

  async getNewId(): Promise<number> {
    while (this.idLock) {
      await sleep(10);
    }
    this.idLock = true;
    
    try {
      const lastMoment = await this.momentModel
        .findOne({}, { id: 1 })
        .sort({ id: -1 });
      
      const newId = lastMoment ? lastMoment.id + 1 : 1;
      this.idLock = false;
      return newId;
    } catch (error) {
      this.idLock = false;
      throw error;
    }
  }
} 
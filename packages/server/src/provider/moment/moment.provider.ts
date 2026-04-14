import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from 'src/storage/mongoose-compat';
import { Model } from 'src/storage/mongoose-compat';
import { CreateMomentDto, SearchMomentOption, UpdateMomentDto } from 'src/types/moment.dto';
import { Moment, MomentDocument } from 'src/scheme/moment.schema';
import { StructuredDataService } from 'src/storage/structured-data.service';
import { escapeRegExp } from 'src/utils/escapeRegExp';

export type MomentView = 'admin' | 'public';

@Injectable()
export class MomentProvider {
  constructor(
    @InjectModel('Moment')
    private momentModel: Model<MomentDocument>,
    private readonly structuredDataService: StructuredDataService,
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

  private projectMomentForView(moment: any, view: MomentView) {
    if (!moment) {
      return moment;
    }
    const payload = { ...(moment?._doc || moment) };
    if (view === 'public') {
      delete payload.deleted;
    }
    return payload;
  }

  async create(createMomentDto: CreateMomentDto): Promise<Moment> {
    const createdData = new this.momentModel(createMomentDto);
    const newId = await this.getNewId();
    createdData.id = newId;
    const res = await createdData.save();
    await this.structuredDataService.upsertMoment(res.toObject());
    return res;
  }

  async getByOption(
    option: SearchMomentOption,
    isPublic: boolean,
  ): Promise<{ moments: Moment[]; total: number }> {
    const pgResult = await this.structuredDataService.queryMoments(option);
    if (pgResult.moments.length || pgResult.total || this.structuredDataService.isInitialized()) {
      return {
        total: pgResult.total,
        moments: pgResult.moments.map((moment: any) =>
          this.projectMomentForView(moment, isPublic ? 'public' : 'admin'),
        ),
      } as any;
    }
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

    const query = this.momentModel.find(filter, view).sort(sort);
    const shouldPaginate = typeof pageSize === 'number' ? pageSize > 0 : true;

    if (shouldPaginate) {
      const safePage = page > 0 ? page : 1;
      query.skip((safePage - 1) * pageSize).limit(pageSize);
    }

    const moments = await query;

    return { moments, total };
  }

  async getById(id: number, view: MomentView): Promise<Moment> {
    const pgMoment = await this.structuredDataService.getMomentById(id);
    if (pgMoment) {
      return this.projectMomentForView(pgMoment, view) as any;
    }
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
    
    return moment as any;
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
    await this.structuredDataService.upsertMoment(updatedMoment.toObject());
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
    const latest = await this.momentModel.findOne({ id }).lean().exec();
    if (latest) {
      await this.structuredDataService.upsertMoment(latest);
    }
  }

  async getTotalNum(): Promise<number> {
    const total = await this.structuredDataService.getTotalMoments();
    if (total || this.structuredDataService.isInitialized()) {
      return total;
    }
    return await this.momentModel.countDocuments({
      $or: [
        { deleted: false },
        { deleted: { $exists: false } },
      ],
    });
  }

  async searchByString(str: string): Promise<Moment[]> {
    const normalizedSearch = String(str || '').trim();
    if (!normalizedSearch) {
      return [];
    }
    const pgMoments = await this.structuredDataService.searchMoments(str);
    if (pgMoments.length || this.structuredDataService.isInitialized()) {
      return pgMoments.map((moment: any) => this.projectMomentForView(moment, 'admin')) as any;
    }
    const safePattern = escapeRegExp(normalizedSearch);

    const moments = await this.momentModel
      .find({
        $and: [
          {
            $or: [
              { content: { $regex: safePattern, $options: 'i' } },
            ],
          },
          {
            $or: [{ deleted: false }, { deleted: { $exists: false } }],
          },
        ],
      }, this.adminView)
      .sort({ createdAt: -1 })
      .limit(50);

    return moments as any;
  }

  async getNewId(): Promise<number> {
    return await this.structuredDataService.nextMomentId();
  }
} 

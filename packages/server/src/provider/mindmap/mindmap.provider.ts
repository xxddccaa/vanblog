import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { InjectModel } from 'src/storage/mongoose-compat';
import { Model } from 'src/storage/mongoose-compat';
import { MindMap, MindMapDocument } from 'src/scheme/mindmap.schema';
import { CreateMindMapDto, UpdateMindMapDto, SearchMindMapOption } from 'src/types/mindmap.dto';
import { StructuredDataService } from 'src/storage/structured-data.service';
import { escapeRegExp } from 'src/utils/escapeRegExp';

export type MindMapView = 'admin' | 'public' | 'list';

@Injectable()
export class MindMapProvider {
  private readonly logger = new Logger(MindMapProvider.name);

  constructor(
    @InjectModel(MindMap.name)
    private mindMapModel: Model<MindMapDocument>,
    private readonly structuredDataService: StructuredDataService,
  ) {}

  publicView = {
    title: 1,
    content: 1,
    author: 1,
    description: 1,
    viewer: 1,
    updatedAt: 1,
    createdAt: 1,
    _id: 1,
  };

  adminView = {
    title: 1,
    content: 1,
    author: 1,
    description: 1,
    viewer: 1,
    updatedAt: 1,
    createdAt: 1,
    _id: 1,
  };

  listView = {
    title: 1,
    author: 1,
    description: 1,
    viewer: 1,
    updatedAt: 1,
    createdAt: 1,
    _id: 1,
  };

  getView(view: MindMapView) {
    let thisView: any = this.adminView;
    switch (view) {
      case 'admin':
        thisView = this.adminView;
        break;
      case 'list':
        thisView = this.listView;
        break;
      case 'public':
        thisView = this.publicView;
    }
    return thisView;
  }

  private projectMindMapForView(mindMap: any, view: MindMapView) {
    if (!mindMap) {
      return mindMap;
    }
    const payload = { ...(mindMap?._doc || mindMap) };
    if (view === 'list') {
      delete payload.content;
    }
    return payload;
  }

  async create(createMindMapDto: CreateMindMapDto): Promise<MindMap> {
    if (this.structuredDataService.isInitialized()) {
      const now = new Date();
      const created = {
        _id: randomUUID(),
        viewer: 0,
        deleted: false,
        ...createMindMapDto,
        createdAt: now,
        updatedAt: now,
      };
      await this.syncMindMapToStructuredStore(created);
      return created as any;
    }

    const createdData = new this.mindMapModel({
      ...createMindMapDto,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const saved = await createdData.save();
    await this.syncMindMapToStructuredStore(saved.toObject());
    return saved;
  }

  async getByOption(option: SearchMindMapOption): Promise<{ mindMaps: MindMap[]; total: number }> {
    const pgResult = await this.queryMindMapsFromStructuredStore(option);
    if (
      pgResult &&
      (pgResult.mindMaps.length || pgResult.total || this.structuredDataService.isInitialized())
    ) {
      return {
        total: pgResult.total,
        mindMaps: pgResult.mindMaps.map((mindMap: any) =>
          this.projectMindMapForView(mindMap, 'list'),
        ),
      } as any;
    }
    const query: any = {};
    const $and: any = [
      {
        $or: [{ deleted: false }, { deleted: { $exists: false } }],
      },
    ];

    if (option.title) {
      const safeTitlePattern = escapeRegExp(String(option.title).trim());
      $and.push({
        title: {
          $regex: new RegExp(safeTitlePattern, 'i'),
        },
      });
    }

    if (option.author) {
      query.author = option.author;
    }

    if (option.startTime) {
      const startTime = new Date(option.startTime);
      const key = option.sortCreatedAt ? 'createdAt' : 'updatedAt';
      $and.push({
        [key]: {
          $gte: startTime,
        },
      });
    }

    if (option.endTime) {
      const endTime = new Date(option.endTime);
      const key = option.sortCreatedAt ? 'createdAt' : 'updatedAt';
      $and.push({
        [key]: {
          $lte: endTime,
        },
      });
    }

    if ($and.length > 0) {
      query.$and = $and;
    }

    const total = await this.mindMapModel.countDocuments(query);

    const page = option.page || 1;
    const pageSize = option.pageSize || 10;
    const skip = (page - 1) * pageSize;

    let sort: any = { updatedAt: -1 };
    if (option.sortCreatedAt) {
      sort = { createdAt: option.sortCreatedAt === 'asc' ? 1 : -1 };
    }

    const mindMaps = await this.mindMapModel
      .find(query)
      .select(this.listView)
      .sort(sort)
      .skip(skip)
      .limit(pageSize);

    return { mindMaps, total };
  }

  async findById(id: string, view: MindMapView = 'admin'): Promise<MindMap> {
    const mindMap = await this.getMindMapFromStructuredStore(id);
    if (mindMap) {
      return this.projectMindMapForView(mindMap, view) as any;
    }
    const thisView = this.getView(view);
    return this.mindMapModel
      .findOne({ _id: id, $or: [{ deleted: false }, { deleted: { $exists: false } }] })
      .select(thisView);
  }

  async updateById(id: string, updateDto: UpdateMindMapDto): Promise<MindMap> {
    const updateData = {
      ...updateDto,
      updatedAt: new Date(),
    };

    const structuredMindMap = await this.getMindMapFromStructuredStore(id, true);
    if (structuredMindMap && this.structuredDataService.isInitialized()) {
      const baseMindMap: any = structuredMindMap as any;
      const updated = {
        ...(baseMindMap?._doc || baseMindMap),
        ...updateData,
      };
      await this.syncMindMapToStructuredStore(updated);
      return updated as any;
    }

    const updated = await this.mindMapModel.findByIdAndUpdate(id, updateData, { new: true });
    if (updated) {
      await this.syncMindMapToStructuredStore(updated.toObject ? updated.toObject() : updated);
    }
    return updated;
  }

  async deleteById(id: string): Promise<MindMap> {
    const structuredMindMap = await this.getMindMapFromStructuredStore(id, true);
    if (structuredMindMap && this.structuredDataService.isInitialized()) {
      const baseMindMap: any = structuredMindMap as any;
      const deleted = {
        ...(baseMindMap?._doc || baseMindMap),
        deleted: true,
        updatedAt: new Date(),
      };
      await this.syncMindMapToStructuredStore(deleted);
      return deleted as any;
    }

    const deleted = await this.mindMapModel.findByIdAndUpdate(
      id,
      { deleted: true, updatedAt: new Date() },
      { new: true },
    );
    if (deleted) {
      await this.syncMindMapToStructuredStore(deleted.toObject ? deleted.toObject() : deleted);
    }
    return deleted;
  }

  async searchByString(search: string): Promise<MindMap[]> {
    const normalizedSearch = String(search || '').trim();
    if (!normalizedSearch) {
      return [];
    }
    const pgResults = await this.searchMindMapsFromStructuredStore(search);
    if (pgResults && (pgResults.length || this.structuredDataService.isInitialized())) {
      return pgResults.map((mindMap: any) => this.projectMindMapForView(mindMap, 'list')) as any;
    }
    const safePattern = escapeRegExp(normalizedSearch);
    const query = {
      $and: [
        {
          $or: [{ deleted: false }, { deleted: { $exists: false } }],
        },
        {
          $or: [
            {
              title: {
                $regex: new RegExp(safePattern, 'i'),
              },
            },
            {
              description: {
                $regex: new RegExp(safePattern, 'i'),
              },
            },
          ],
        },
      ],
    };

    return this.mindMapModel.find(query).select(this.listView).sort({ updatedAt: -1 }).limit(50);
  }

  async incrementViewer(id: string): Promise<void> {
    const structuredMindMap = await this.getMindMapFromStructuredStore(id, true);
    if (structuredMindMap && this.structuredDataService.isInitialized()) {
      const baseMindMap: any = structuredMindMap as any;
      await this.syncMindMapToStructuredStore({
        ...(baseMindMap?._doc || baseMindMap),
        viewer: Number(structuredMindMap?.viewer || 0) + 1,
        updatedAt: new Date(),
      });
      return;
    }

    await this.mindMapModel.findByIdAndUpdate(id, { $inc: { viewer: 1 } });
    const latest = await this.mindMapModel.findById(id).lean().exec();
    if (latest) {
      await this.syncMindMapToStructuredStore(latest);
    }
  }

  async getAllForBackup() {
    const items = await this.listMindMapsFromStructuredStore(true);
    if (items && (items.length || this.structuredDataService.isInitialized())) {
      return items;
    }
    return await this.mindMapModel.find({}).lean().exec();
  }

  async importMindMaps(mindMaps: MindMap[]) {
    for (const mindMap of (mindMaps || []) as any[]) {
      if (!mindMap?._id && !mindMap?.title) {
        continue;
      }

      const payload: any = { ...mindMap };
      delete payload.__v;
      const query = mindMap._id ? { _id: mindMap._id } : { title: mindMap.title };
      await this.mindMapModel.updateOne(query, payload, { upsert: true });
      await this.syncMindMapToStructuredStore(payload);
    }
  }

  private async queryMindMapsFromStructuredStore(option: SearchMindMapOption) {
    try {
      return await this.structuredDataService.queryMindMaps(option);
    } catch (error) {
      this.logger.warn(
        `queryMindMaps failed, fallback to record store: ${error?.message || error}`,
      );
      return null;
    }
  }

  private async getMindMapFromStructuredStore(id: string, includeDeleted = false) {
    try {
      return await this.structuredDataService.getMindMapById(id, includeDeleted);
    } catch (error) {
      this.logger.warn(
        `getMindMapById failed, fallback to record store: ${error?.message || error}`,
      );
      return null;
    }
  }

  private async searchMindMapsFromStructuredStore(search: string) {
    try {
      return await this.structuredDataService.searchMindMaps(search);
    } catch (error) {
      this.logger.warn(
        `searchMindMaps failed, fallback to record store: ${error?.message || error}`,
      );
      return null;
    }
  }

  private async listMindMapsFromStructuredStore(includeDelete = false) {
    try {
      return await this.structuredDataService.listMindMaps(includeDelete);
    } catch (error) {
      this.logger.warn(`listMindMaps failed, fallback to record store: ${error?.message || error}`);
      return null;
    }
  }

  private async syncMindMapToStructuredStore(mindMap: any) {
    try {
      await this.structuredDataService.upsertMindMap(mindMap);
    } catch (error) {
      this.logger.warn(`upsertMindMap failed, skip structured sync: ${error?.message || error}`);
    }
  }
}

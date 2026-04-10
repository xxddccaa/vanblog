import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from 'src/storage/mongoose-compat';
import { Model } from 'src/storage/mongoose-compat';
import { CreateArticleDto } from 'src/types/article.dto';
import {
  CreateDraftDto,
  PublishDraftDto,
  SearchDraftOption,
  UpdateDraftDto,
} from 'src/types/draft.dto';
import { Draft, DraftDocument } from 'src/scheme/draft.schema';
import { ArticleProvider } from '../article/article.provider';
import { StructuredDataService } from 'src/storage/structured-data.service';

export type DraftView = 'admin' | 'public' | 'list';

@Injectable()
export class DraftProvider {
  constructor(
    @InjectModel('Draft') private draftModel: Model<DraftDocument>,
    private readonly articleProvider: ArticleProvider,
    private readonly structuredDataService: StructuredDataService,
  ) {}
  publicView = {
    title: 1,
    content: 1,
    tags: 1,
    category: 1,
    updatedAt: 1,
    createdAt: 1,
    author: 1,
    id: 1,
    _id: 0,
  };

  adminView = {
    title: 1,
    content: 1,
    tags: 1,
    category: 1,
    updatedAt: 1,
    createdAt: 1,
    author: 1,
    id: 1,
    _id: 0,
  };

  listView = {
    title: 1,
    tags: 1,
    category: 1,
    updatedAt: 1,
    createdAt: 1,
    author: 1,
    id: 1,
    _id: 0,
  };

  getView(view: DraftView) {
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

  private projectDraftForView(draft: any, view: DraftView) {
    if (!draft) {
      return draft;
    }
    const payload = { ...(draft?._doc || draft) };
    if (view === 'list') {
      delete payload.content;
    }
    return payload;
  }

  async create(createDraftDto: CreateDraftDto): Promise<Draft> {
    const createdData = new this.draftModel(createDraftDto);
    const newId = await this.getNewId();
    createdData.id = newId;
    const saved = await createdData.save();
    await this.structuredDataService.upsertDraft(saved.toObject());
    return saved;
  }

  async importDrafts(drafts: Draft[]) {
    // 题目相同就合并，以导入的优先
    // for (let i = 0; i < drafts.length; i++) {
    //   const newId = await this.getNewId();
    //   drafts[i].id = newId;
    // }
    for (const draft of drafts) {
      const { id, ...createDto } = draft;
      const title = draft.title;
      const oldDraft = await this.findOneByTitle(title);
      if (oldDraft) {
        await this.updateById(oldDraft.id, { ...createDto, deleted: false });
      } else {
        await this.create(createDto);
      }
    }
    await this.structuredDataService.refreshDraftsFromRecordStore();
  }

  async getByOption(option: SearchDraftOption): Promise<{ drafts: Draft[]; total: number }> {
    const pgResult = await this.structuredDataService.queryDrafts(option);
    if (pgResult.drafts.length || pgResult.total || this.structuredDataService.isInitialized()) {
      return {
        drafts: pgResult.drafts.map((draft: any) =>
          this.projectDraftForView(draft, option.toListView ? 'list' : 'admin'),
        ),
        total: pgResult.total,
      } as any;
    }
    const query: any = {};
    const $and: any = [
      {
        $or: [
          {
            deleted: false,
          },
          {
            deleted: { $exists: false },
          },
        ],
      },
    ];
    const and = [];
    const sort: any = { createdAt: -1 };
    if (option.sortCreatedAt) {
      if (option.sortCreatedAt == 'asc') {
        sort.createdAt = 1;
      }
    }
    if (option.tags) {
      const tags = option.tags.split(',');
      const or: any = [];
      tags.forEach((t) => {
        or.push({
          tags: { $regex: `${t}`, $options: 'i' },
        });
      });
      and.push({ $or: or });
    }
    if (option.category) {
      and.push({
        category: { $regex: `${option.category}`, $options: 'i' },
      });
    }
    if (option.title) {
      and.push({
        title: { $regex: `${option.title}`, $options: 'i' },
      });
    }
    if (option.startTime || option.endTime) {
      const obj: any = {};
      if (option.startTime) {
        obj['$gte'] = new Date(option.startTime);
      }
      if (option.endTime) {
        obj['$lte'] = new Date(option.endTime);
      }
      $and.push({ createdAt: obj });
    }

    if (and.length) {
      $and.push({ $and: and });
    }

    query.$and = $and;
    const view = option.toListView ? this.listView : this.adminView;
    const draftQuery = this.draftModel.find(query, view).sort(sort);
    const shouldPaginate = typeof option.pageSize === 'number' ? option.pageSize > 0 : true;
    if (shouldPaginate) {
      const page = option.page && option.page > 0 ? option.page : 1;
      draftQuery.skip(option.pageSize * page - option.pageSize).limit(option.pageSize);
    }
    const drafts = await draftQuery.exec();
    const total = await this.draftModel.countDocuments(query).exec();

    return {
      drafts,
      total,
    };
  }
  async publish(id: number, options: PublishDraftDto) {
    const draft = await this.getById(id);
    if (!draft.content.includes('<!-- more -->')) {
      throw new ForbiddenException('未包含 more 标记，请修改后再发布！');
    }
    const createArticleDto: CreateArticleDto = {
      title: draft.title,
      content: draft.content,
      tags: draft.tags,
      category: draft.category,
      author: draft.author,
    };
    for (const [k, v] of Object.entries(options || {})) {
      createArticleDto[k] = v;
    }
    const res = await this.articleProvider.create(createArticleDto);
    await this.deleteById(id);
    return res;
  }

  async getAll(): Promise<Draft[]> {
    const drafts = await this.structuredDataService.listDrafts();
    if (drafts.length || this.structuredDataService.isInitialized()) {
      return drafts as any;
    }
    return this.draftModel.find({ deleted: false }).exec();
  }

  async getById(id: number): Promise<Draft> {
    const draft = await this.structuredDataService.getDraftById(id);
    if (draft || this.structuredDataService.isInitialized()) {
      return draft as any;
    }
    return this.draftModel.findOne({ id, deleted: false }).exec();
  }

  async findById(id: number): Promise<Draft> {
    const draft = await this.structuredDataService.getDraftById(id, true);
    if (draft || this.structuredDataService.isInitialized()) {
      return draft as any;
    }
    return this.draftModel.findOne({ id }).exec();
  }

  async findOneByTitle(title: string): Promise<Draft> {
    const draft = await this.structuredDataService.findDraftByTitle(title);
    if (draft || this.structuredDataService.isInitialized()) {
      return draft as any;
    }
    return this.draftModel.findOne({ title }).exec();
  }

  async searchByString(str: string): Promise<Draft[]> {
    const drafts = await this.structuredDataService.searchDrafts(str);
    if (drafts.length || this.structuredDataService.isInitialized()) {
      return drafts as any;
    }
    const $and: any = [
      {
        $or: [
          { content: { $regex: `${str}`, $options: 'i' } },
          { title: { $regex: `${str}`, $options: 'i' } },
          { category: { $regex: `${str}`, $options: 'i' } },
          { tags: { $regex: `${str}`, $options: 'i' } },
        ],
      },
      {
        $or: [
          {
            deleted: false,
          },
          {
            deleted: { $exists: false },
          },
        ],
      },
    ];
    return this.draftModel
      .find({
        $and,
      })
      .exec();
  }

  async findAll(): Promise<Draft[]> {
    const drafts = await this.structuredDataService.listDrafts(true);
    if (drafts.length || this.structuredDataService.isInitialized()) {
      return drafts as any;
    }
    return this.draftModel.find().exec();
  }

  async deleteById(id: number) {
    const result = await this.draftModel.updateOne(
      { id },
      { deleted: true, updatedAt: new Date() },
    );
    const latest = await this.draftModel.findOne({ id }).lean().exec();
    if (latest) {
      await this.structuredDataService.upsertDraft(latest);
    }
    return result;
  }

  async updateById(id: number, updateDraftDto: UpdateDraftDto) {
    const result = await this.draftModel.updateOne(
      { id },
      { ...updateDraftDto, updatedAt: new Date() },
    );
    const latest = await this.draftModel.findOne({ id }).lean().exec();
    if (latest) {
      await this.structuredDataService.upsertDraft(latest);
    }
    return result;
  }

  async getNewId() {
    return await this.structuredDataService.nextDraftId();
  }
}

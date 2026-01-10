import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MindMap, MindMapDocument } from 'src/scheme/mindmap.schema';
import { CreateMindMapDto, UpdateMindMapDto, SearchMindMapOption } from 'src/types/mindmap.dto';

export type MindMapView = 'admin' | 'public' | 'list';

@Injectable()
export class MindMapProvider {
  constructor(
    @InjectModel(MindMap.name)
    private mindMapModel: Model<MindMapDocument>,
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

  async create(createMindMapDto: CreateMindMapDto): Promise<MindMap> {
    const createdData = new this.mindMapModel({
      ...createMindMapDto,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    
    return createdData.save();
  }

  async getByOption(option: SearchMindMapOption): Promise<{ mindMaps: MindMap[]; total: number }> {
    const query: any = {};
    const $and: any = [
      {
        $or: [
          { deleted: false },
          { deleted: { $exists: false } },
        ],
      },
    ];

    if (option.title) {
      $and.push({
        title: {
          $regex: new RegExp(option.title, 'i'),
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
    
    return this.mindMapModel.findByIdAndUpdate(id, updateData, { new: true });
  }

  async deleteById(id: string): Promise<MindMap> {
    return this.mindMapModel.findByIdAndUpdate(id, { deleted: true, updatedAt: new Date() }, { new: true });
  }

  async searchByString(search: string): Promise<MindMap[]> {
    const query = {
      $and: [
        {
          $or: [
            { deleted: false },
            { deleted: { $exists: false } },
          ],
        },
        {
          $or: [
            {
              title: {
                $regex: new RegExp(search, 'i'),
              },
            },
            {
              description: {
                $regex: new RegExp(search, 'i'),
              },
            },
          ],
        },
      ],
    };

    return this.mindMapModel.find(query).select(this.listView).sort({ updatedAt: -1 }).limit(50);
  }

  async incrementViewer(id: string): Promise<void> {
    await this.mindMapModel.findByIdAndUpdate(id, { $inc: { viewer: 1 } });
  }
}


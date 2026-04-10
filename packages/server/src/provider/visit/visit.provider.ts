import { Injectable } from '@nestjs/common';
import { InjectModel } from 'src/storage/mongoose-compat';
import dayjs from 'dayjs';
import { Model } from 'src/storage/mongoose-compat';
import { createVisitDto } from 'src/types/visit.dto';
import { Visit } from 'src/scheme/visit.schema';
import { VisitDocument } from 'src/scheme/visit.schema';
import { StructuredDataService } from 'src/storage/structured-data.service';

@Injectable()
export class VisitProvider {
  constructor(
    @InjectModel('Visit') private visitModel: Model<VisitDocument>,
    private readonly structuredDataService: StructuredDataService,
  ) {}

  async add(createViewerDto: createVisitDto): Promise<any> {
    // 先找一下有没有今天的，有的话就在今天的基础上加1。
    const { isNew, pathname } = createViewerDto;
    // 这里的 isNew 代表是对于这个文章来说有没有访问过。
    const today = dayjs().format('YYYY-MM-DD');
    const todayData = await this.findByDateAndPath(today, pathname);
    if (todayData) {
      // 有今天的，直接在今天的基础上 +1 就行了
      const lastVisitedTime = new Date();
      const payload = {
        ...(todayData?._doc || todayData),
        viewer: todayData.viewer + 1,
        visited: isNew ? todayData.visited + 1 : todayData.visited,
        lastVisitedTime,
      };
      const result = await this.visitModel.updateOne(
        { date: today, pathname },
        {
          viewer: payload.viewer,
          visited: payload.visited,
          lastVisitedTime,
        },
      );
      await this.structuredDataService.upsertVisit(payload);
      return result;
    } else {
      // 没有今天的，找到能找到的上一天，然后加一，并创建今天的。
      const lastData = await this.getLastData(pathname);
      const lastVisit = lastData?.visited || 0;
      const lastViewer = lastData?.viewer || 0;
      const createdData = new this.visitModel({
        date: today,
        viewer: lastViewer + 1,
        visited: isNew ? lastVisit + 1 : lastVisit,
        pathname: pathname,
        lastVisitedTime: new Date(),
      });
      const saved = await createdData.save();
      await this.structuredDataService.upsertVisit(saved.toObject());
      return saved;
    }
  }

  async rewriteToday(pathname: string, viewer: number, visited: number) {
    const today = dayjs().format('YYYY-MM-DD');
    const todayData = await this.findByDateAndPath(today, pathname);
    if (todayData) {
      const payload = {
        ...(todayData?._doc || todayData),
        viewer,
        visited,
      };
      await this.visitModel.updateOne({ date: today, pathname }, { viewer, visited });
      await this.structuredDataService.upsertVisit(payload);
    } else {
      const created = await this.visitModel.create({
        date: today,
        viewer,
        visited,
        pathname,
      });
      await this.structuredDataService.upsertVisit(created.toObject ? created.toObject() : created);
    }
  }

  async getLastData(pathname: string) {
    const pgVisit = await this.structuredDataService.getLastVisitByPath(pathname);
    if (pgVisit || this.structuredDataService.isInitialized()) {
      return pgVisit as any;
    }
    const lastData = await this.visitModel.find({ pathname }).sort({ date: -1 }).limit(1);
    if (lastData && lastData.length > 0) {
      return lastData[0];
    }
    return null;
  }

  async getAll(): Promise<Visit[]> {
    const visits = await this.structuredDataService.listVisits();
    if (visits.length || this.structuredDataService.isInitialized()) {
      return visits as any;
    }
    return this.visitModel.find({}).exec();
  }

  async findByDateAndPath(date: string, pathname: string): Promise<Visit> {
    const visit = await this.structuredDataService.getVisitByDateAndPath(date, pathname);
    if (visit || this.structuredDataService.isInitialized()) {
      return visit as any;
    }
    return this.visitModel.findOne({ date, pathname }).exec();
  }

  async getByArticleId(id: number | string) {
    const pathname = id == 0 ? `/about` : `/post/${id}`;
    const latest = await this.structuredDataService.getLastVisitByPath(pathname);
    if (latest || this.structuredDataService.isInitialized()) {
      return latest as any;
    }
    const result = await this.visitModel
      .find({
        pathname,
      })
      .sort({ date: -1 })
      .limit(1);
    if (result && result.length) {
      return result[0];
    }
    return null;
  }

  async getLastVisitItem() {
    const latest = await this.structuredDataService.getLastVisitItem();
    if (latest || this.structuredDataService.isInitialized()) {
      return latest as any;
    }
    const result = await this.visitModel
      .find({
        lastVisitedTime: { $exists: true },
      })
      .sort({ lastVisitedTime: -1 })
      .limit(1);
    if (result && result.length) {
      return result[0];
    }
    return null;
  }

  async import(data: Visit[]) {
    for (const each of data) {
      const oldData = await this.visitModel.findOne({
        pathname: each.pathname,
        date: each.date,
      });
      if (oldData) {
        await this.visitModel.updateOne({ _id: oldData._id }, each);
      } else {
        const newData = new this.visitModel(each);
        await newData.save();
      }
    }
    await this.structuredDataService.refreshVisitsFromRecordStore();
  }
}

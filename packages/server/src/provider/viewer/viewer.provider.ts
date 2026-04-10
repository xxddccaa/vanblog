import { Injectable } from '@nestjs/common';
import { InjectModel } from 'src/storage/mongoose-compat';
import { Model } from 'src/storage/mongoose-compat';
import { createViewerDto } from 'src/types/viewer.dto';
import { Viewer, ViewerDocument } from 'src/scheme/viewer.schema';
import dayjs from 'dayjs';
import { StructuredDataService } from 'src/storage/structured-data.service';

@Injectable()
export class ViewerProvider {
  constructor(
    @InjectModel('Viewer') private viewerModel: Model<ViewerDocument>,
    private readonly structuredDataService: StructuredDataService,
  ) {}

  async create(createViewerDto: createViewerDto): Promise<Viewer> {
    const createdData = new this.viewerModel(createViewerDto);
    const saved = await createdData.save();
    await this.structuredDataService.upsertViewer(saved.toObject());
    return saved;
  }

  async createOrUpdate(createViewerDto: createViewerDto) {
    const { date } = createViewerDto;
    const oldData = await this.findByDate(date);
    if (!oldData) {
      const createdData = new this.viewerModel(createViewerDto);
      const saved = await createdData.save();
      await this.structuredDataService.upsertViewer(saved.toObject());
      return saved;
    } else {
      const payload = {
        ...(oldData?._doc || oldData),
        ...createViewerDto,
        _id: oldData?._id,
      };
      const result = await this.viewerModel.updateOne({ date }, createViewerDto);
      await this.structuredDataService.upsertViewer(payload);
      return result;
    }
  }

  async getViewerGrid(num: number) {
    const curDate = dayjs();
    const startDate = curDate.add(-1 * num, 'day').format('YYYY-MM-DD');
    const endDate = curDate.format('YYYY-MM-DD');
    const pgViewers = await this.structuredDataService.getViewerSeries(startDate, endDate);
    const viewerMap = new Map(pgViewers.map((item: any) => [item.date, item]));
    const gridTotal = [];
    const tmpArr = [];
    const today = { viewer: 0, visited: 0 };
    const lastDay = { viewer: 0, visited: 0 };
    for (let i = num; i >= 0; i--) {
      const last = curDate.add(-1 * i, 'day').format('YYYY-MM-DD');
      const lastDayData: any =
        viewerMap.get(last) ||
        (!this.structuredDataService.isInitialized() ? await this.findByDate(last) : null);
      if (i == 0) {
        if (lastDayData) {
          today.viewer = lastDayData.viewer;
          today.visited = lastDayData.visited;
        }
      }
      if (i == 1) {
        if (lastDayData) {
          lastDay.viewer = lastDayData.viewer;
          lastDay.visited = lastDayData.visited;
        }
        if (today.viewer == 0) {
          // 如果今天没数据，那今天的就和昨天的一样吧。这样新增就都是 0
          today.viewer = lastDayData?.viewer || 0;
          today.visited = lastDayData?.visited || 0;
        }
      }
      if (lastDayData) {
        tmpArr.push({
          date: last,
          visited: lastDayData.visited,
          viewer: lastDayData.viewer,
        });
        if (i != num + 1) {
          gridTotal.push({
            date: last,
            visited: lastDayData.visited,
            viewer: lastDayData.viewer,
          });
        }
      }
    }

    const gridEachDay = [];
    let pre = tmpArr[0];
    for (let i = 1; i < tmpArr.length; i++) {
      const curObj = tmpArr[i];
      if (curObj) {
        if (pre) {
          gridEachDay.push({
            date: curObj.date,
            visited: curObj.visited - pre.visited,
            viewer: curObj.viewer - pre.viewer,
          });
        } else {
          gridEachDay.push({
            date: curObj.date,
            visited: curObj.visited,
            viewer: curObj.viewer,
          });
        }
      }
      pre = curObj;
    }
    return {
      grid: {
        total: gridTotal,
        each: gridEachDay,
      },
      add: {
        viewer: today.viewer - lastDay.viewer,
        visited: today.visited - lastDay.visited,
      },
      now: {
        viewer: today.viewer,
        visited: today.visited,
      },
    };
  }

  async getAll(): Promise<Viewer[]> {
    const viewers = await this.structuredDataService.listViewers();
    if (viewers.length || this.structuredDataService.isInitialized()) {
      return viewers as any;
    }
    return this.viewerModel.find({}).exec();
  }

  async findByDate(date: string): Promise<Viewer> {
    const viewer = await this.structuredDataService.getViewerByDate(date);
    if (viewer || this.structuredDataService.isInitialized()) {
      return viewer as any;
    }
    return this.viewerModel.findOne({ date }).exec();
  }

  async import(data: Viewer[]) {
    for (const each of data) {
      const oldData = await this.viewerModel.findOne({
        date: each.date,
      });
      if (oldData) {
        await this.viewerModel.updateOne({ _id: oldData._id }, each);
      } else {
        const newData = new this.viewerModel(each);
        await newData.save();
      }
    }
    await this.structuredDataService.refreshViewersFromRecordStore();
  }
}

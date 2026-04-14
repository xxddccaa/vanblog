import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from 'src/storage/mongoose-compat';
import { Model } from 'src/storage/mongoose-compat';
import { Document, DocumentDocument } from 'src/scheme/document.schema';
import { CreateDocumentDto, UpdateDocumentDto, SearchDocumentOption, MoveDocumentDto } from 'src/types/document.dto';
import { DraftProvider } from '../draft/draft.provider';
import { StructuredDataService } from 'src/storage/structured-data.service';
import { escapeRegExp } from 'src/utils/escapeRegExp';

export type DocumentView = 'admin' | 'public' | 'list';

@Injectable()
export class DocumentProvider {
  constructor(
    @InjectModel(Document.name)
    private documentModel: Model<DocumentDocument>,
    private readonly draftProvider: DraftProvider,
    private readonly structuredDataService: StructuredDataService,
  ) {}

  publicView = {
    title: 1,
    content: 1,
    author: 1,
    parent_id: 1,
    library_id: 1,
    type: 1,
    path: 1,
    sort_order: 1,
    updatedAt: 1,
    createdAt: 1,
    id: 1,
    _id: 0,
  };

  adminView = {
    title: 1,
    content: 1,
    author: 1,
    parent_id: 1,
    library_id: 1,
    type: 1,
    path: 1,
    sort_order: 1,
    updatedAt: 1,
    createdAt: 1,
    id: 1,
    _id: 0,
  };

  listView = {
    title: 1,
    author: 1,
    parent_id: 1,
    library_id: 1,
    type: 1,
    path: 1,
    sort_order: 1,
    updatedAt: 1,
    createdAt: 1,
    id: 1,
    _id: 0,
  };

  getView(view: DocumentView) {
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

  private projectDocumentForView(document: any, view: DocumentView) {
    if (!document) {
      return document;
    }
    const payload = { ...(document?._doc || document) };
    if (view === 'list') {
      delete payload.content;
    }
    return payload;
  }

  private isPathPrefixed(path: number[] = [], prefix: number[] = []) {
    if (prefix.length > path.length) {
      return false;
    }
    return prefix.every((item, index) => path[index] === item);
  }

  private replacePathPrefix(path: number[] = [], prefix: number[] = [], replacement: number[] = []) {
    if (!this.isPathPrefixed(path, prefix)) {
      return [...path];
    }
    return [...replacement, ...path.slice(prefix.length)];
  }

  private async getDocumentSubtree(id: number) {
    const pgDocuments = await this.structuredDataService.getDocumentSubtree(id, true);
    if (pgDocuments.length || this.structuredDataService.isInitialized()) {
      return pgDocuments as any[];
    }
    const documents = await this.documentModel.find({}).lean().exec();
    const byParent = new Map<number, any[]>();
    for (const document of documents) {
      if (document.parent_id === null || document.parent_id === undefined) {
        continue;
      }
      if (!byParent.has(document.parent_id)) {
        byParent.set(document.parent_id, []);
      }
      byParent.get(document.parent_id)?.push(document);
    }

    const subtree: any[] = [];
    const queue = documents.filter(
      (document) => document.id === id || (Array.isArray(document.path) && document.path.includes(id)),
    );
    const seen = new Set<number>();

    while (queue.length) {
      const current = queue.shift();
      if (!current || seen.has(current.id)) {
        continue;
      }
      seen.add(current.id);
      subtree.push(current);
      for (const child of byParent.get(current.id) || []) {
        queue.push(child);
      }
    }

    return subtree;
  }

  async create(createDocumentDto: CreateDocumentDto): Promise<Document> {
    const newId = await this.getNewId();
    const path = await this.calculatePath(createDocumentDto.parent_id, createDocumentDto.library_id);
    
    const createdData = new this.documentModel({
      ...createDocumentDto,
      id: newId,
      path: path,
    });
    
    const saved = await createdData.save();
    await this.structuredDataService.upsertDocument(saved.toObject());
    return saved;
  }

  async getByOption(option: SearchDocumentOption): Promise<{ documents: Document[]; total: number }> {
    const pgResult = await this.structuredDataService.queryDocuments(option);
    if (pgResult.documents.length || pgResult.total || this.structuredDataService.isInitialized()) {
      return {
        total: pgResult.total,
        documents: pgResult.documents.map((doc: any) =>
          this.projectDocumentForView(doc, option.toListView ? 'list' : 'admin'),
        ),
      } as any;
    }
    const query: any = {};
    const $and: any = [
      {
        $or: [
          { deleted: false },
          { deleted: { $exists: false } },
        ],
      },
    ];

    const sort: any = { sort_order: 1, createdAt: -1 };
    
    if (option.sortCreatedAt) {
      if (option.sortCreatedAt == 'asc') {
        sort.createdAt = 1;
      }
    }

    if (option.title) {
      const safeTitlePattern = escapeRegExp(option.title);
      $and.push({
        title: { $regex: safeTitlePattern, $options: 'i' },
      });
    }

    if (option.library_id !== undefined) {
      $and.push({ library_id: option.library_id });
    }

    if (option.parent_id !== undefined) {
      $and.push({ parent_id: option.parent_id });
    }

    if (option.type) {
      $and.push({ type: option.type });
    }

    if (option.author) {
      const safeAuthorPattern = escapeRegExp(option.author);
      $and.push({
        author: { $regex: safeAuthorPattern, $options: 'i' },
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

    query.$and = $and;
    const view = option.toListView ? this.listView : this.adminView;

    const documentQuery = this.documentModel.find(query, view).sort(sort);
    const shouldPaginate = typeof option.pageSize === 'number' ? option.pageSize > 0 : true;

    if (shouldPaginate) {
      const page = option.page && option.page > 0 ? option.page : 1;
      const pageSize = option.pageSize as number;
      documentQuery.skip(pageSize * page - pageSize).limit(pageSize);
    }

    const documents = await documentQuery.exec();

    const total = await this.documentModel.countDocuments(query).exec();

    return {
      documents,
      total,
    };
  }

  async getById(id: number): Promise<Document> {
    const document = await this.structuredDataService.getDocumentById(id);
    if (document) {
      return this.projectDocumentForView(document, 'admin') as any;
    }
    return this.documentModel.findOne({ id, deleted: false }).exec();
  }

  async findById(id: number): Promise<Document> {
    return this.getById(id);
  }

  async updateById(id: number, updateDocumentDto: UpdateDocumentDto) {
    if (
      updateDocumentDto.parent_id !== undefined ||
      updateDocumentDto.library_id !== undefined ||
      updateDocumentDto.path !== undefined
    ) {
      throw new BadRequestException('文档位置调整请使用移动接口，避免子文档路径不一致');
    }

    const result = await this.documentModel.updateOne(
      { id },
      { ...updateDocumentDto, updatedAt: new Date() }
    );
    const latest = await this.documentModel.findOne({ id }).lean().exec();
    if (latest) {
      await this.structuredDataService.upsertDocument(latest);
    }
    return result;
  }

  async deleteById(id: number) {
    const doc = await this.getById(id);
    if (doc) {
      const subtree = await this.getDocumentSubtree(id);
      const ids = subtree.map((item: any) => item.id);
      const updatedAt = new Date();
      if (ids.length) {
        await this.documentModel.updateMany(
          { id: { $in: ids } },
          { deleted: true, updatedAt },
        );
        await this.structuredDataService.markDocumentsDeleted(ids, updatedAt);
      }
    }
    return true;
  }

  async moveDocument(id: number, moveDto: MoveDocumentDto) {
    const currentDoc = await this.getById(id);
    if (!currentDoc) {
      throw new Error('文档不存在');
    }
    const subtree = await this.getDocumentSubtree(id);
    const subtreeIds = new Set(subtree.map((document: any) => document.id));
    if (moveDto.target_parent_id !== undefined && subtreeIds.has(moveDto.target_parent_id)) {
      throw new BadRequestException('不能将文档移动到自己或子文档下面');
    }

    const newPath = await this.calculatePath(moveDto.target_parent_id, moveDto.target_library_id);
    const updatedAt = new Date();
    const updateData: any = {
      updatedAt,
      path: newPath,
    };

    if (moveDto.target_parent_id !== undefined) {
      updateData.parent_id = moveDto.target_parent_id;
    }

    if (moveDto.target_library_id !== undefined) {
      updateData.library_id = moveDto.target_library_id;
    }

    if (moveDto.sort_order !== undefined) {
      updateData.sort_order = moveDto.sort_order;
    }

    const rootPrefix = [...(currentDoc.path || []), currentDoc.id];
    const nextPrefix = [...newPath, currentDoc.id];
    const updates = subtree.map((document: any) => {
      if (document.id === id) {
        return {
          ...(document?._doc || document),
          ...updateData,
          parent_id:
            moveDto.target_parent_id !== undefined ? moveDto.target_parent_id : document.parent_id,
          library_id:
            moveDto.target_library_id !== undefined ? moveDto.target_library_id : document.library_id,
          sort_order:
            moveDto.sort_order !== undefined ? moveDto.sort_order : document.sort_order,
          updatedAt,
        };
      }
      return {
        ...(document?._doc || document),
        path: this.replacePathPrefix(document.path || [], rootPrefix, nextPrefix),
        updatedAt,
      };
    });

    const bulkOps = updates.map((document: any) => ({
      updateOne: {
        filter: { id: document.id },
        update: {
          parent_id: document.parent_id,
          library_id: document.library_id,
          sort_order: document.sort_order,
          path: document.path,
          updatedAt,
        },
      },
    }));

    const result = await this.documentModel.bulkWrite(bulkOps);
    for (const document of updates) {
      await this.structuredDataService.upsertDocument(document);
    }
    return result;
  }

  async getDocumentTree(libraryId?: number): Promise<Document[]> {
    const documents = await this.structuredDataService.listDocuments({
      libraryId,
    });

    if (!documents.length && !this.structuredDataService.isInitialized()) {
      const query: any = { deleted: false };
      if (libraryId) {
        query.library_id = libraryId;
      }
      const fallbackDocuments = await this.documentModel
        .find(query, this.listView)
        .sort({ sort_order: 1, createdAt: -1 })
        .exec();
      return this.buildTree(fallbackDocuments);
    }

    return this.buildTree(documents.map((doc: any) => this.projectDocumentForView(doc, 'list')) as any);
  }

  async getLibraries(): Promise<Document[]> {
    const libraries = await this.structuredDataService.listDocuments({ type: 'library' });
    if (libraries.length || this.structuredDataService.isInitialized()) {
      return libraries.map((doc: any) => this.projectDocumentForView(doc, 'list')) as any;
    }
    return this.documentModel
      .find({ type: 'library', deleted: false }, this.listView)
      .sort({ sort_order: 1, createdAt: -1 })
      .exec();
  }

  async getDocumentsByLibrary(libraryId: number): Promise<Document[]> {
    const result = await this.structuredDataService.queryDocuments({
      page: 1,
      pageSize: -1,
      library_id: libraryId,
    });
    if (result.documents.length || this.structuredDataService.isInitialized()) {
      return result.documents.map((doc: any) => this.projectDocumentForView(doc, 'list')) as any;
    }
    return this.documentModel
      .find({ library_id: libraryId, deleted: false }, this.listView)
      .sort({ sort_order: 1, createdAt: -1 })
      .exec();
  }

  async exportLibraryDocuments(libraryId: number): Promise<any> {
    // 获取文档库信息
    const library = await this.documentModel.findOne({ id: libraryId, type: 'library', deleted: false });
    if (!library) {
      throw new Error('文档库不存在');
    }

    // 获取该文档库下的所有文档
    const documents = await this.documentModel
      .find({ library_id: libraryId, deleted: false }, this.adminView)
      .sort({ sort_order: 1, createdAt: -1 })
      .exec();

    // 处理文件名重复的问题
    const fileNameMap = new Map<string, number>();
    const processedDocuments = documents.map(doc => {
      let fileName = this.sanitizeFileName(doc.title);
      
      // 如果文件名已存在，添加序号
      if (fileNameMap.has(fileName)) {
        const count = fileNameMap.get(fileName) + 1;
        fileNameMap.set(fileName, count);
        fileName = `${fileName}-${count}`;
      } else {
        fileNameMap.set(fileName, 0);
      }
      
      return {
        fileName: `${fileName}.md`,
        content: this.generateMarkdownContent(doc, library),
        originalTitle: doc.title,
      };
    });

    return {
      libraryTitle: library.title,
      documents: processedDocuments,
    };
  }

  // 清理文件名，移除不合法的字符
  private sanitizeFileName(fileName: string): string {
    return fileName
      .replace(/[<>:"/\\|?*]/g, '') // 移除Windows不允许的字符
      .replace(/\s+/g, '_') // 将空格替换为下划线
      .substring(0, 100); // 限制长度
  }

  // 生成Markdown内容
  private generateMarkdownContent(doc: any, library: any): string {
    let content = '';
    
    // 添加文档标题
    content += `# ${doc.title}\n\n`;
    
    // 添加元信息
    content += `> **文档库**: ${library.title}\n`;
    content += `> **作者**: ${doc.author || '未知'}\n`;
    content += `> **创建时间**: ${doc.createdAt ? new Date(doc.createdAt).toLocaleString('zh-CN') : '未知'}\n`;
    content += `> **更新时间**: ${doc.updatedAt ? new Date(doc.updatedAt).toLocaleString('zh-CN') : '未知'}\n\n`;
    
    // 添加分隔线
    content += '---\n\n';
    
    // 添加文档内容
    content += doc.content || '';
    
    return content;
  }

  private async calculatePath(parentId: number, libraryId: number): Promise<number[]> {
    const path: number[] = [];
    
    if (libraryId) {
      path.push(libraryId);
    }
    
    if (parentId) {
      const parent = await this.getById(parentId);
      if (parent && parent.path) {
        path.push(...parent.path);
      }
      path.push(parentId);
    }
    
    return path;
  }

  private buildTree(documents: Document[]): any[] {
    const map = new Map<number, any>();
    const roots: any[] = [];

    // 创建映射
    documents.forEach(doc => {
      const plainDoc = JSON.parse(JSON.stringify(doc));
      map.set(plainDoc.id, { ...plainDoc, children: [] });
    });

    // 构建树形结构
    documents.forEach(doc => {
      const plainDoc = JSON.parse(JSON.stringify(doc));
      const node = map.get(plainDoc.id);
      
      if (plainDoc.type === 'library') {
        // 文档库总是在根级
        roots.push(node);
      } else if (plainDoc.type === 'document') {
        // 文档根据parent_id或library_id来确定父级
        if (plainDoc.parent_id && map.has(plainDoc.parent_id)) {
          // 如果有parent_id，挂载到父文档下
          const parent = map.get(plainDoc.parent_id);
          parent.children.push(node);
        } else if (plainDoc.library_id && map.has(plainDoc.library_id)) {
          // 如果没有parent_id但有library_id，挂载到文档库下
          const library = map.get(plainDoc.library_id);
          library.children.push(node);
        }
      }
    });

    // 按照sort_order和创建时间排序
    const sortNodes = (nodes: any[]) => {
      nodes.sort((a, b) => {
        if (a.sort_order !== b.sort_order) {
          return (a.sort_order || 0) - (b.sort_order || 0);
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      
      nodes.forEach(node => {
        if (node.children && node.children.length > 0) {
          sortNodes(node.children);
        }
      });
    };

    sortNodes(roots);
    return roots;
  }

  async getNewId(): Promise<number> {
    return await this.structuredDataService.nextDocumentId();
  }

  async convertToDraft(id: number, category: string): Promise<any> {
    // 获取要转换的文档
    const document = await this.getById(id);
    if (!document) {
      throw new Error('文档不存在');
    }

    // 检查是否有子文档
    const children = await this.documentModel.find({ parent_id: id, deleted: false });
    if (children.length > 0) {
      throw new Error('该文档有子文档，不能转换为草稿');
    }

    // 创建草稿
    const draftData = {
      title: document.title,
      content: document.content,
      author: document.author,
      category: category,
      tags: [], // 文档没有tags字段，设置为空数组
    };

    const draft = await this.draftProvider.create(draftData);

    // 删除原文档
    await this.deleteById(id);

    return draft;
  }

  async searchByString(str: string): Promise<Document[]> {
    const normalizedSearch = String(str || '').trim();
    if (!normalizedSearch) {
      return [];
    }
    const pgDocuments = await this.structuredDataService.searchDocuments(str);
    if (pgDocuments.length || this.structuredDataService.isInitialized()) {
      const relatedIds = new Set<number>();
      pgDocuments.forEach((doc: any) => {
        relatedIds.add(doc.id);
        if (doc.library_id) relatedIds.add(doc.library_id);
        if (doc.parent_id) relatedIds.add(doc.parent_id);
        if (doc.path && doc.path.length > 0) {
          doc.path.forEach((id: number) => relatedIds.add(id));
        }
      });
      const allRelatedDocs = await this.structuredDataService.getDocumentsByIds(Array.from(relatedIds));
      const searchResultIds = new Set(pgDocuments.map((doc: any) => doc.id));
      return allRelatedDocs.map((doc: any) => ({
        ...JSON.parse(JSON.stringify(doc)),
        isSearchResult: searchResultIds.has(doc.id),
      })) as any;
    }
    const safePattern = escapeRegExp(normalizedSearch);
    const $and: any = [
      {
        $or: [
          { content: { $regex: safePattern, $options: 'i' } },
          { title: { $regex: safePattern, $options: 'i' } },
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
    
    const documents = await this.documentModel
      .find({
        $and,
      }, this.adminView)
      .sort({ createdAt: -1 })
      .exec();

    // 获取所有相关的文档ID，包括父级路径
    const relatedIds = new Set<number>();
    
    documents.forEach(doc => {
      relatedIds.add(doc.id);
      if (doc.library_id) relatedIds.add(doc.library_id);
      if (doc.parent_id) relatedIds.add(doc.parent_id);
      // 添加路径中的所有父级
      if (doc.path && doc.path.length > 0) {
        doc.path.forEach(id => relatedIds.add(id));
      }
    });

    // 获取所有相关文档（包括父级和文档库）
    const allRelatedDocs = await this.documentModel
      .find({
        id: { $in: Array.from(relatedIds) },
        $or: [
          { deleted: false },
          { deleted: { $exists: false } },
        ],
      }, this.adminView)
      .sort({ sort_order: 1, createdAt: -1 })
      .exec();

    // 标记哪些是搜索结果
    const searchResultIds = new Set(documents.map(doc => doc.id));
    return allRelatedDocs.map(doc => ({
      ...JSON.parse(JSON.stringify(doc)),
      isSearchResult: searchResultIds.has(doc.id),
    }));
  }
} 

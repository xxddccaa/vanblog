import { Model } from 'src/storage/mongoose-compat';
import { ArticleDocument } from 'src/scheme/article.schema';

export type RefreshStructuredArticles = (reason: string) => Promise<void>;

export async function reorderArticleIds(
  articleModel: Model<ArticleDocument>,
  refreshStructuredArticles: RefreshStructuredArticles,
) {
  try {
    console.log('开始执行文章序号重排...');

    const articles = await articleModel
      .find({
        $or: [{ deleted: false }, { deleted: { $exists: false } }],
      })
      .sort({ createdAt: 1 })
      .exec();

    if (articles.length === 0) {
      return {
        totalArticles: 0,
        updatedReferences: 0,
        customPathArticles: 0,
        message: '没有找到需要重排的文章',
      };
    }

    const idMapping = new Map<number, number>();
    const reorderItems = [];

    let newId = 1;
    for (const article of articles) {
      idMapping.set(article.id, newId);
      reorderItems.push({
        oldId: article.id,
        newId: newId,
        hasCustomPath: !!article.pathname,
        pathname: article.pathname,
        article: article,
      });
      newId++;
    }

    const customPathCount = reorderItems.filter((item) => item.hasCustomPath).length;
    console.log(`准备重排 ${articles.length} 篇文章，其中 ${customPathCount} 篇有自定义路径`);

    console.log('预检查：验证目标ID范围...');
    const maxTargetId = articles.length;
    const conflictingArticles = await articleModel
      .find({
        id: { $lte: maxTargetId },
        _id: { $nin: articles.map((a) => a._id) },
      })
      .exec();

    if (conflictingArticles.length > 0) {
      console.log(`发现 ${conflictingArticles.length} 篇可能冲突的文章，先将它们移动到安全位置`);
      const SAFE_ID_START = 50000;
      for (let i = 0; i < conflictingArticles.length; i++) {
        await articleModel.updateOne(
          { id: conflictingArticles[i].id },
          {
            id: SAFE_ID_START + i,
            updatedAt: new Date(),
          },
        );
        console.log(`移动冲突文章: ${conflictingArticles[i].id} -> ${SAFE_ID_START + i}`);
      }
    }

    let updatedReferences = 0;
    const linkRegex = /\/post\/(\d+)/g;

    for (const article of articles) {
      let contentChanged = false;
      let newContent = article.content;

      newContent = newContent.replace(linkRegex, (match: string, oldIdStr: string) => {
        const oldReferencedId = parseInt(oldIdStr, 10);
        const newReferencedId = idMapping.get(oldReferencedId);

        if (newReferencedId && newReferencedId !== oldReferencedId) {
          contentChanged = true;
          updatedReferences++;
          console.log(
            `更新引用链接: ${match} -> /post/${newReferencedId} (在文章 ${article.id} 中)`,
          );
          return `/post/${newReferencedId}`;
        }
        return match;
      });

      if (contentChanged) {
        await articleModel.updateOne(
          { id: article.id },
          {
            content: newContent,
            updatedAt: new Date(),
          },
        );
      }
    }

    const TEMP_ID_OFFSET = 100000;

    console.log('第一阶段：将所有文章移动到临时ID范围...');
    for (let i = 0; i < reorderItems.length; i++) {
      const item = reorderItems[i];
      await articleModel.updateOne(
        { id: item.oldId },
        {
          id: TEMP_ID_OFFSET + i,
          updatedAt: new Date(),
        },
      );
      console.log(`移动到临时ID: ${item.oldId} -> ${TEMP_ID_OFFSET + i}`);
    }

    console.log('第二阶段：将文章移动到最终ID...');
    for (let i = 0; i < reorderItems.length; i++) {
      const item = reorderItems[i];
      await articleModel.updateOne(
        { id: TEMP_ID_OFFSET + i },
        {
          id: item.newId,
          updatedAt: new Date(),
        },
      );
      console.log(`移动到最终ID: ${TEMP_ID_OFFSET + i} -> ${item.newId}`);
    }

    console.log('清理冲突文章...');
    if (conflictingArticles.length > 0) {
      const SAFE_ID_START = 50000;
      for (let i = 0; i < conflictingArticles.length; i++) {
        const safeId = SAFE_ID_START + i;
        await articleModel.deleteOne({ id: safeId });
        console.log(`删除冲突文章: ID ${safeId}`);
      }
    }

    console.log('文章序号重排完成');
    console.log('提示: 文章ID变更后，可能需要手动清理浏览量统计缓存');

    await refreshStructuredArticles('article-reorder');

    return {
      totalArticles: articles.length,
      updatedReferences,
      customPathArticles: customPathCount,
      message: '文章序号重排成功完成',
    };
  } catch (error) {
    console.error('文章序号重排失败:', error);
    throw new Error(`文章序号重排失败: ${error.message}`);
  }
}

export async function fixNegativeIds(
  articleModel: Model<ArticleDocument>,
  refreshStructuredArticles: RefreshStructuredArticles,
) {
  try {
    console.log('开始修复负数ID...');

    const negativeIdArticles = await articleModel
      .find({ id: { $lt: 0 } })
      .sort({ id: 1 })
      .exec();

    if (negativeIdArticles.length === 0) {
      return {
        fixedCount: 0,
        message: '没有找到负数ID的文章',
      };
    }

    console.log(`找到 ${negativeIdArticles.length} 篇负数ID文章`);

    const maxPositiveIdResult = await articleModel
      .find({ id: { $gt: 0 } })
      .sort({ id: -1 })
      .limit(1);

    let nextId = maxPositiveIdResult.length > 0 ? maxPositiveIdResult[0].id + 1 : 1;

    for (const article of negativeIdArticles) {
      await articleModel.updateOne(
        { id: article.id },
        {
          id: nextId,
          updatedAt: new Date(),
        },
      );
      console.log(`修复文章ID: ${article.id} -> ${nextId} (${article.title})`);
      nextId++;
    }

    console.log('负数ID修复完成');
    await refreshStructuredArticles('article-fix-negative-ids');

    return {
      fixedCount: negativeIdArticles.length,
      message: '负数ID修复成功完成',
    };
  } catch (error) {
    console.error('修复负数ID失败:', error);
    throw new Error(`修复负数ID失败: ${error.message}`);
  }
}

export async function cleanupTempIds(
  articleModel: Model<ArticleDocument>,
  refreshStructuredArticles: RefreshStructuredArticles,
) {
  try {
    console.log('开始清理临时ID文章...');

    const tempIdArticles = await articleModel.find({ id: { $gte: 50000 } }).exec();

    if (tempIdArticles.length === 0) {
      return {
        cleanedCount: 0,
        message: '没有找到需要清理的临时ID文章',
      };
    }

    console.log(`找到 ${tempIdArticles.length} 篇临时ID文章`);

    let cleanedCount = 0;
    for (const article of tempIdArticles) {
      await articleModel.deleteOne({ id: article.id });
      console.log(`删除临时ID文章: ${article.id} - ${article.title}`);
      cleanedCount++;
    }

    await refreshStructuredArticles('article-cleanup-temp-ids');

    return {
      cleanedCount: cleanedCount,
      message: `成功清理 ${cleanedCount} 篇临时ID文章`,
    };
  } catch (error) {
    console.error('清理临时ID失败:', error);
    throw new Error(`清理临时ID失败: ${error.message}`);
  }
}

export async function cleanupDuplicatePathnames(
  articleModel: Model<ArticleDocument>,
  refreshStructuredArticles: RefreshStructuredArticles,
) {
  console.log('开始清理重复的自定义路径名...');

  const articlesWithPathname = await articleModel
    .find({
      pathname: { $exists: true, $ne: '' },
      $and: [
        {
          $or: [{ deleted: false }, { deleted: { $exists: false } }],
        },
      ],
    })
    .sort({ createdAt: 1 })
    .exec();

  if (articlesWithPathname.length === 0) {
    console.log('没有找到带有自定义路径名的文章');
    return { cleanedCount: 0 };
  }

  const pathnameGroups = new Map<string, any[]>();
  for (const article of articlesWithPathname) {
    const pathname = article.pathname.trim();
    if (!pathnameGroups.has(pathname)) {
      pathnameGroups.set(pathname, []);
    }
    pathnameGroups.get(pathname)!.push(article);
  }

  let cleanedCount = 0;

  for (const [pathname, articles] of pathnameGroups) {
    if (articles.length > 1) {
      console.log(`发现重复路径名 "${pathname}"，共 ${articles.length} 篇文章`);

      for (let i = 1; i < articles.length; i++) {
        const article = articles[i];
        await articleModel.updateOne({ id: article.id }, { $unset: { pathname: '' } });
        console.log(`  清除了文章 ID ${article.id} ("${article.title}") 的重复路径名`);
        cleanedCount++;
      }
    }
  }

  if (cleanedCount > 0) {
    await refreshStructuredArticles('article-cleanup-duplicate-pathnames');
  }
  console.log(`清理完成，共处理了 ${cleanedCount} 篇文章的重复路径名`);
  return { cleanedCount };
}

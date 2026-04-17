import { getPublicMeta } from "../api/getAllData";
import { getMoments } from "../api/getMoments";
import { Article } from "../types/article";
import { IndexPageProps } from "../page-modules/index";
import { TagPageProps } from "../page-modules/tag";
import { TimeLinePageProps } from "../page-modules/timeline";
import { CategoryPageProps } from "../page-modules/category";
import { getAuthorCardShellProps, getLayoutProps } from "./getLayoutProps";
import { AboutPageProps } from "../page-modules/about";
import { PostPagesProps } from "../page-modules/post/[id]";
import type { MomentPageProps } from "../page-components/moment";
import type { NavPageProps } from "../page-components/nav";
import {
  getArchiveMonthArticles,
  getArchiveSummary,
  getArticleByIdOrPathname,
  getArticlesByOption,
  getCategoryArchiveMonthArticles,
  getCategoryArchiveSummary,
  getCategorySummary,
  getTagArchiveMonthArticles,
  getTagArchiveSummary,
  getTimelineSummary,
} from "../api/getArticles";
import { LinkPageProps } from "../page-modules/link";
import { getServerBaseUrl, getServerFetchOptions } from "./loadConfig";
import { ArchivePageProps } from "../page-modules/archive";
import { ArchiveYearPageProps } from "../page-modules/archive/[year]";
import { ArchiveMonthRouteProps } from "../page-modules/archive/[year]/[month]";
import { CategoryArchivePageProps } from "../page-modules/category/[category]";
import { CategoryArchiveYearPageProps } from "../page-modules/category/[category]/archive/[year]";
import { CategoryArchiveMonthPageProps } from "../page-modules/category/[category]/archive/[year]/[month]";
import { TagArchivePageProps } from "../page-modules/tag/[tag]";
import { TagArchiveYearPageProps } from "../page-modules/tag/[tag]/archive/[year]";
import { TagArchiveMonthPageProps } from "../page-modules/tag/[tag]/archive/[year]/[month]";

const toStableArticleShell = (article: Partial<Article> | null | undefined): Article => ({
  id: Number(article?.id || 0),
  title: article?.title || "",
  pathname: article?.pathname,
  updatedAt: article?.updatedAt || "",
  createdAt: article?.createdAt || "",
  category: article?.category || "",
  content: article?.content || "",
  private: Boolean(article?.private),
  tags: Array.isArray(article?.tags) ? article.tags : [],
  author: article?.author,
  copyright: article?.copyright,
  top: article?.top,
});

const toStableArticleShellList = (articles: Array<Partial<Article>> = []): Article[] =>
  articles.map((article) => toStableArticleShell(article));

const getCommonLayoutPayload = async () => {
  const data = await getPublicMeta();
  return {
    data,
    layoutProps: getLayoutProps(data),
    authorCardProps: getAuthorCardShellProps(data),
  };
};

export async function getIndexPageProps(): Promise<IndexPageProps> {
  const { data, layoutProps, authorCardProps } = await getCommonLayoutPayload();
  const homePageSize = data?.meta?.siteInfo?.homePageSize || 5;
  const { articles } = await getArticlesByOption({
    page: 1,
    pageSize: homePageSize,
    withPreviewContent: true,
  });
  return {
    layoutProps,
    articles: toStableArticleShellList(articles),
    currPage: 1,
    totalPosts: data.totalArticles,
    authorCardProps,
  };
}

export async function getArchivePageProps(): Promise<ArchivePageProps> {
  const { layoutProps, authorCardProps } = await getCommonLayoutPayload();
  const summary = await getArchiveSummary();
  return {
    layoutProps,
    authorCardProps,
    summary,
  };
}

export async function getArchiveYearPageProps(year: string): Promise<ArchiveYearPageProps> {
  const { layoutProps, authorCardProps } = await getCommonLayoutPayload();
  const summary = await getArchiveSummary();
  return {
    layoutProps,
    authorCardProps,
    summary,
    year,
  };
}

export async function getArchiveMonthPageProps(
  year: string,
  month: string
): Promise<ArchiveMonthRouteProps> {
  const { layoutProps, authorCardProps } = await getCommonLayoutPayload();
  const articles = await getArchiveMonthArticles(year, month);
  return {
    layoutProps,
    authorCardProps,
    articles: toStableArticleShellList(articles),
    year,
    month,
  };
}

export async function getTimeLinePageProps(): Promise<TimeLinePageProps> {
  const { layoutProps, authorCardProps } = await getCommonLayoutPayload();
  const summaries = await getTimelineSummary();
  return {
    layoutProps,
    authorCardProps,
    summaries,
  };
}

export async function getTagPageProps(): Promise<TagPageProps> {
  const { data, layoutProps, authorCardProps } = await getCommonLayoutPayload();
  return {
    layoutProps,
    authorCardProps,
    tags: data.tags,
  };
}

export async function getCategoryPageProps(): Promise<CategoryPageProps> {
  const { layoutProps, authorCardProps } = await getCommonLayoutPayload();
  const summaries = await getCategorySummary();
  return {
    layoutProps,
    authorCardProps,
    summaries,
  };
}

export async function getLinkPageProps(): Promise<LinkPageProps> {
  const { data, layoutProps, authorCardProps } = await getCommonLayoutPayload();
  return {
    layoutProps,
    authorCardProps,
    links: data.meta.links,
  };
}

export async function getAboutPageProps(): Promise<AboutPageProps> {
  const { data, layoutProps, authorCardProps } = await getCommonLayoutPayload();
  const about = data.meta.about;
  let showDonateInfo: "true" | "false" = "true";
  if (data.meta.siteInfo?.showDonateInfo == "false") {
    showDonateInfo = "false";
  }
  let showDonateInAbout: "true" | "false" = "false";

  if (data.meta.siteInfo?.showDonateInAbout == "true") {
    showDonateInAbout = "true";
  }
  if (data.meta.siteInfo?.showDonateButton == "false") {
    showDonateInAbout = "false";
  }
  const payProps = {
    pay: [data.meta.siteInfo?.payAliPay || "", data.meta.siteInfo?.payWechat || ""],
    payDark: [
      data.meta.siteInfo?.payAliPayDark || "",
      data.meta.siteInfo?.payWechatDark || "",
    ],
  };
  return {
    showDonateInfo,
    layoutProps,
    authorCardProps,
    about,
    donates: data.meta?.rewards || [],
    showDonateInAbout,
    ...payProps,
  };
}

export async function getPostPagesProps(curId: string): Promise<PostPagesProps> {
  const { data, layoutProps } = await getCommonLayoutPayload();
  const payProps = {
    pay: [data.meta.siteInfo?.payAliPay || "", data.meta.siteInfo?.payWechat || ""],
    payDark: [
      data.meta.siteInfo?.payAliPayDark || "",
      data.meta.siteInfo?.payWechatDark || "",
    ],
  };
  const currArticleProps = await getArticleByIdOrPathname(curId);
  const rawArticle = currArticleProps.article;
  const hasValidArticle = Boolean(rawArticle?.id && rawArticle?.title);
  const article = hasValidArticle ? toStableArticleShell(rawArticle) : null;
  const author = article?.author || data.meta.siteInfo.author;
  return {
    layoutProps,
    article,
    ...payProps,
    author,
    showSubMenu: layoutProps.showSubMenu,
  };
}

export async function getCategoryArchivePageProps(
  category: string
): Promise<CategoryArchivePageProps> {
  const { layoutProps, authorCardProps } = await getCommonLayoutPayload();
  const summary = await getCategoryArchiveSummary(category);
  return {
    layoutProps,
    authorCardProps,
    category,
    summary,
  };
}

export async function getCategoryArchiveYearPageProps(
  category: string,
  year: string
): Promise<CategoryArchiveYearPageProps> {
  const { layoutProps, authorCardProps } = await getCommonLayoutPayload();
  const summary = await getCategoryArchiveSummary(category);
  return {
    layoutProps,
    authorCardProps,
    category,
    year,
    summary,
  };
}

export async function getCategoryArchiveMonthPageProps(
  category: string,
  year: string,
  month: string
): Promise<CategoryArchiveMonthPageProps> {
  const { layoutProps, authorCardProps } = await getCommonLayoutPayload();
  const articles = await getCategoryArchiveMonthArticles(category, year, month);
  return {
    layoutProps,
    authorCardProps,
    category,
    year,
    month,
    articles: toStableArticleShellList(articles),
  };
}

export async function getTagArchivePageProps(tag: string): Promise<TagArchivePageProps> {
  const { layoutProps, authorCardProps } = await getCommonLayoutPayload();
  const summary = await getTagArchiveSummary(tag);
  return {
    layoutProps,
    authorCardProps,
    tag,
    summary,
  };
}

export async function getTagArchiveYearPageProps(
  tag: string,
  year: string
): Promise<TagArchiveYearPageProps> {
  const { layoutProps, authorCardProps } = await getCommonLayoutPayload();
  const summary = await getTagArchiveSummary(tag);
  return {
    layoutProps,
    authorCardProps,
    tag,
    year,
    summary,
  };
}

export async function getTagArchiveMonthPageProps(
  tag: string,
  year: string,
  month: string
): Promise<TagArchiveMonthPageProps> {
  const { layoutProps, authorCardProps } = await getCommonLayoutPayload();
  const articles = await getTagArchiveMonthArticles(tag, year, month);
  return {
    layoutProps,
    authorCardProps,
    tag,
    year,
    month,
    articles: toStableArticleShellList(articles),
  };
}

export async function getMomentPageProps(): Promise<MomentPageProps> {
  try {
    const data = await getPublicMeta();
    const layoutProps = getLayoutProps(data);
    const authorCardProps = getAuthorCardShellProps(data);
    const momentData = await getMoments({
      page: 1,
      pageSize: 10,
      sortCreatedAt: "desc",
    });

    return {
      ...layoutProps,
      authorCardProps,
      initialMoments: momentData.moments || [],
      initialTotal: momentData.total || 0,
    };
  } catch (error) {
    console.error("Error in getMomentPageProps:", error);

    try {
      const data = await getPublicMeta();
      return {
        ...getLayoutProps(data),
        authorCardProps: getAuthorCardShellProps(data),
        initialMoments: [],
        initialTotal: 0,
      };
    } catch {
      return {
        initialMoments: [],
        initialTotal: 0,
        siteName: "VanBlog",
        description: "VanBlog",
        authorCardProps: {},
      } as MomentPageProps;
    }
  }
}

export async function getNavPageProps(): Promise<NavPageProps> {
  const data = await getPublicMeta();
  const layoutProps = getLayoutProps(data);
  const authorCardProps = getAuthorCardShellProps(data);
  let initialNavData = { categories: [], tools: [] };

  try {
    const navResponse = await fetch(`${getServerBaseUrl()}api/public/nav/data`, getServerFetchOptions());
    const navResult = await navResponse.json();
    if (navResult.statusCode === 200) {
      initialNavData = navResult.data;
    }
  } catch (error) {
    console.error("Failed to fetch nav data during build:", error);
  }

  return {
    layoutProps,
    initialNavData,
    authorCardProps,
  };
}

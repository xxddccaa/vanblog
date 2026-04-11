import { getPublicMeta } from "../api/getAllData";
import { Article } from "../types/article";
import { IndexPageProps } from "../pages/index";
import { TagPageProps } from "../pages/tag";
import { TimeLinePageProps } from "../pages/timeline";
import { CategoryPageProps } from "../pages/category";
import { getAuthorCardShellProps, getLayoutProps } from "./getLayoutProps";
import { AboutPageProps } from "../pages/about";
import { PostPagesProps } from "../pages/post/[id]";
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
import { LinkPageProps } from "../pages/link";
import { ArchivePageProps } from "../pages/archive";
import { ArchiveYearPageProps } from "../pages/archive/[year]";
import { ArchiveMonthRouteProps } from "../pages/archive/[year]/[month]";
import { CategoryArchivePageProps } from "../pages/category/[category]";
import { CategoryArchiveYearPageProps } from "../pages/category/[category]/archive/[year]";
import { CategoryArchiveMonthPageProps } from "../pages/category/[category]/archive/[year]/[month]";
import { TagArchivePageProps } from "../pages/tag/[tag]";
import { TagArchiveYearPageProps } from "../pages/tag/[tag]/archive/[year]";
import { TagArchiveMonthPageProps } from "../pages/tag/[tag]/archive/[year]/[month]";

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
  const { article } = currArticleProps;
  const author = article?.author || data.meta.siteInfo.author;
  return {
    layoutProps,
    article: toStableArticleShell(currArticleProps.article),
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

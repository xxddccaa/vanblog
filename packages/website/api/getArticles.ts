import { Article } from "../types/article";
import { encodeQuerystring } from "../utils/encode";
import { config } from "../utils/loadConfig";
export type SortOrder = "asc" | "desc";
export interface GetArticleOption {
  page: number;
  pageSize: number;
  toListView?: boolean;
  withPreviewContent?: boolean;
  category?: string;
  tags?: string;
  sortCreatedAt?: SortOrder;
  sortTop?: SortOrder;
  withWordCount?: boolean;
}

export interface CategorySummaryItem {
  name: string;
  articleCount: number;
}

export interface TimelineSummaryItem {
  year: string;
  articleCount: number;
}

export interface ArchiveSummaryMonth {
  month: string;
  articleCount: number;
}

export interface ArchiveSummaryYear {
  year: string;
  articleCount: number;
  months: ArchiveSummaryMonth[];
}

export interface ArchiveSummaryData {
  totalArticles: number;
  years: ArchiveSummaryYear[];
}

export interface ArticleNavItem {
  id: number;
  title: string;
  pathname?: string;
}

export interface ArticleFragments {
  commentCount: number;
  related: Article[];
  latest: Article[];
  hot: Article[];
}

export interface ArticleEngagement {
  viewer: number;
  visited: number;
  commentCount: number;
}

const ARTICLE_QUERY_KEYS: Array<keyof GetArticleOption> = [
  "page",
  "pageSize",
  "category",
  "tags",
  "sortCreatedAt",
  "sortTop",
  "withWordCount",
  "toListView",
  "withPreviewContent",
];

const buildArticleQueryString = (option: GetArticleOption) => {
  const params = new URLSearchParams();

  for (const key of ARTICLE_QUERY_KEYS) {
    const value = option[key];

    if (value === undefined || value === null) {
      continue;
    }

    if (typeof value === "boolean") {
      if (!value) {
        continue;
      }
      params.set(key, "true");
      continue;
    }

    if (typeof value === "string" && value.length === 0) {
      continue;
    }

    params.set(key, String(value));
  }

  return encodeQuerystring(params.toString());
};

const toArticleShell = (article: any): Article => ({
  id: article?.id,
  title: article?.title,
  pathname: article?.pathname,
  updatedAt: article?.updatedAt,
  createdAt: article?.createdAt,
  category: article?.category,
  content: article?.content,
  private: Boolean(article?.private),
  tags: Array.isArray(article?.tags) ? article.tags : [],
  author: article?.author,
  copyright: article?.copyright,
  top: article?.top,
});

const toArticleShellList = (articles: any[] = []): Article[] =>
  articles.map((article) => toArticleShell(article));

export const getArticlesByOption = async (
  option: GetArticleOption
): Promise<{ articles: Article[]; total: number; totalWordCount?: number }> => {
  const queryString = buildArticleQueryString(option);
  try {
    const url = `${config.baseUrl}api/public/article?${queryString}`;
    const res = await fetch(url);
    const { statusCode, data } = await res.json();
    if (statusCode == 233) {
      return { articles: [], total: 0, totalWordCount: 0 };
    }
    return {
      ...data,
      articles: toArticleShellList(data?.articles),
    };
  } catch (err) {
    if (process.env.isBuild == "t") {
      console.log("Failed to connect, using default values");
      return {
        articles: [],
        total: 0,
      };
    } else {
      throw err;
    }
  }
};
export const getArticlesByTimeLine = async () => {
  try {
    const url = `${config.baseUrl}api/public/timeline`;
    const res = await fetch(url);
    const { data } = await res.json();
    return data;
  } catch (err) {
    if (process.env.isBuild == "t") {
      console.log("Failed to connect, using default values");
      return {};
    } else {
      throw err;
    }
  }
};
export const getTimelineSummary = async (): Promise<TimelineSummaryItem[]> => {
  try {
    const url = `${config.baseUrl}api/public/timeline/summary`;
    const res = await fetch(url);
    const { data } = await res.json();
    return data || [];
  } catch (err) {
    if (process.env.isBuild == "t") {
      console.log("Failed to connect, using default values");
      return [];
    } else {
      throw err;
    }
  }
};
export const getTimelineArticlesByYear = async (year: string): Promise<Article[]> => {
  try {
    const url = `${config.baseUrl}api/public/timeline/${encodeQuerystring(year)}/articles`;
    const res = await fetch(url);
    const { data } = await res.json();
    return toArticleShellList(data || []);
  } catch (err) {
    if (process.env.isBuild == "t") {
      console.log("Failed to connect, using default values");
      return [];
    } else {
      throw err;
    }
  }
};
export const getArticlesByCategory = async () => {
  try {
    const url = `${config.baseUrl}api/public/category`;
    const res = await fetch(url);
    const { data } = await res.json();
    return data;
  } catch (err) {
    if (process.env.isBuild == "t") {
      console.log("Failed to connect, using default values");
      return {};
    } else {
      throw err;
    }
  }
};
export const getCategorySummary = async (): Promise<CategorySummaryItem[]> => {
  try {
    const url = `${config.baseUrl}api/public/category/summary`;
    const res = await fetch(url);
    const { data } = await res.json();
    return data || [];
  } catch (err) {
    if (process.env.isBuild == "t") {
      console.log("Failed to connect, using default values");
      return [];
    } else {
      throw err;
    }
  }
};

const getArchiveSummaryByUrl = async (url: string): Promise<ArchiveSummaryData> => {
  try {
    const res = await fetch(url);
    const { data } = await res.json();
    return {
      totalArticles: Number(data?.totalArticles || 0),
      years: Array.isArray(data?.years) ? data.years : [],
    };
  } catch (err) {
    if (process.env.isBuild == "t") {
      console.log("Failed to connect, using default values");
      return {
        totalArticles: 0,
        years: [],
      };
    } else {
      throw err;
    }
  }
};

export const getArchiveSummary = async (): Promise<ArchiveSummaryData> =>
  await getArchiveSummaryByUrl(`${config.baseUrl}api/public/archive/summary`);

export const getCategoryArchiveSummary = async (
  category: string
): Promise<ArchiveSummaryData> =>
  await getArchiveSummaryByUrl(
    `${config.baseUrl}api/public/category/${encodeQuerystring(category)}/archive/summary`
  );

export const getTagArchiveSummary = async (
  tag: string
): Promise<ArchiveSummaryData> =>
  await getArchiveSummaryByUrl(
    `${config.baseUrl}api/public/tag/${encodeQuerystring(tag)}/archive/summary`
  );

const getArchiveMonthArticlesByUrl = async (url: string): Promise<Article[]> => {
  try {
    const res = await fetch(url);
    const { data } = await res.json();
    return toArticleShellList(data || []);
  } catch (err) {
    if (process.env.isBuild == "t") {
      console.log("Failed to connect, using default values");
      return [];
    } else {
      throw err;
    }
  }
};

export const getArchiveMonthArticles = async (
  year: string,
  month: string
): Promise<Article[]> =>
  await getArchiveMonthArticlesByUrl(
    `${config.baseUrl}api/public/archive/${encodeQuerystring(year)}/${encodeQuerystring(month)}/articles`
  );

export const getCategoryArchiveMonthArticles = async (
  category: string,
  year: string,
  month: string
): Promise<Article[]> =>
  await getArchiveMonthArticlesByUrl(
    `${config.baseUrl}api/public/category/${encodeQuerystring(category)}/archive/${encodeQuerystring(year)}/${encodeQuerystring(month)}/articles`
  );

export const getTagArchiveMonthArticles = async (
  tag: string,
  year: string,
  month: string
): Promise<Article[]> =>
  await getArchiveMonthArticlesByUrl(
    `${config.baseUrl}api/public/tag/${encodeQuerystring(tag)}/archive/${encodeQuerystring(year)}/${encodeQuerystring(month)}/articles`
  );
export const getCategoryArticles = async (
  category: string
): Promise<Article[]> => {
  try {
    const url = `${config.baseUrl}api/public/category/${encodeQuerystring(category)}/articles`;
    const res = await fetch(url);
    const { data } = await res.json();
    return toArticleShellList(data || []);
  } catch (err) {
    if (process.env.isBuild == "t") {
      console.log("Failed to connect, using default values");
      return [];
    } else {
      throw err;
    }
  }
};
export const getArticlesByTag = async (tagName: string) => {
  try {
    const url = `${config.baseUrl}api/public/tags/all`;
    const res = await fetch(url);
    const { data } = await res.json();
    return data;
  } catch (err) {
    if (process.env.isBuild == "t") {
      console.log("Failed to connect, using default values");
      return {};
    } else {
      throw err;
    }
  }
};
export const getArticleByIdOrPathname = async (id: string) => {
  try {
    const url = `${config.baseUrl}api/public/article/${id}`;
    const res = await fetch(url);
    const { data } = await res.json();
    return { article: toArticleShell(data.article) };
  } catch (err) {
    if (process.env.isBuild == "t") {
      console.log("Failed to connect, using default values");
      return {};
    } else {
      // console.log(err);
      return {};
    }
  }
};
export const getArticleNavByIdOrPathname = async (
  id: string
): Promise<{ pre?: ArticleNavItem; next?: ArticleNavItem }> => {
  try {
    const url = `${config.baseUrl}api/public/article/${id}/nav`;
    const res = await fetch(url);
    const { data } = await res.json();
    const result: { pre?: ArticleNavItem; next?: ArticleNavItem } = {};
    if (data?.pre) {
      result.pre = {
        title: data.pre.title,
        id: data.pre.id,
        pathname: data.pre.pathname,
      };
    }
    if (data?.next) {
      result.next = {
        title: data.next.title,
        id: data.next.id,
        pathname: data.next.pathname,
      };
    }
    return result;
  } catch (err) {
    if (process.env.isBuild == "t") {
      console.log("Failed to connect, using default values");
      return {};
    } else {
      return {};
    }
  }
};

export const getArticleEngagementByIdOrPathname = async (
  id: string
): Promise<ArticleEngagement> => {
  try {
    const url = `/api/public/article/${id}/engagement`;
    const res = await fetch(url);
    const { data } = await res.json();
    return {
      viewer: Number(data?.viewer || 0),
      visited: Number(data?.visited || 0),
      commentCount: Number(data?.commentCount || 0),
    };
  } catch (err) {
    if (process.env.isBuild == "t") {
      console.log("Failed to connect, using default values");
    }
    return {
      viewer: 0,
      visited: 0,
      commentCount: 0,
    };
  }
};

export const getArticleFragmentsByIdOrPathname = async (
  id: string,
  limit: number = 4
): Promise<ArticleFragments> => {
  try {
    const url = `/api/public/article/${id}/fragments?limit=${limit}`;
    const res = await fetch(url);
    const { data } = await res.json();
    return {
      commentCount: Number(data?.commentCount || 0),
      related: toArticleShellList(data?.related || []),
      latest: toArticleShellList(data?.latest || []),
      hot: toArticleShellList(data?.hot || []),
    };
  } catch (err) {
    if (process.env.isBuild == "t") {
      console.log("Failed to connect, using default values");
    }
    return {
      commentCount: 0,
      related: [],
      latest: [],
      hot: [],
    };
  }
};
export const getArticleByIdOrPathnameWithPassword = async (
  id: number | string,
  password: string
) => {
  try {
    const url = `/api/public/article/${id}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password }),
    });
    const { data } = await res.json();
    return data;
  } catch (err) {
    if (process.env.isBuild == "t") {
      console.log("Failed to connect, using default values");
      return {};
    } else {
      throw err;
    }
  }
};
export const getArticleByIdOrPathnameWithAdminToken = async (
  id: number | string,
  token: string
) => {
  try {
    const url = `/api/public/article/${id}/admin`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token }),
    });
    const { statusCode, data } = await res.json();
    if (statusCode === 200) {
      return data;
    }
    return null;
  } catch (err) {
    if (process.env.isBuild == "t") {
      console.log("Failed to connect, using default values");
      return null;
    } else {
      return null;
    }
  }
};

export const verifyAdminToken = async (token: string) => {
  try {
    const url = `/api/public/verify-admin-token`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token }),
    });
    const { statusCode, data } = await res.json();
    return statusCode === 200 && data?.valid === true;
  } catch (err) {
    return false;
  }
};

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

export interface ArticleNavItem {
  id: number;
  title: string;
  pathname?: string;
}
export const getArticlesByOption = async (
  option: GetArticleOption
): Promise<{ articles: Article[]; total: number; totalWordCount?: number }> => {
  let queryString = "";
  for (const [k, v] of Object.entries(option)) {
    queryString += `${k}=${v}&`;
  }
  queryString = queryString.substring(0, queryString.length - 1);
  queryString = encodeQuerystring(queryString);
  try {
    const url = `${config.baseUrl}api/public/article?${queryString}`;
    const res = await fetch(url);
    const { statusCode, data } = await res.json();
    if (statusCode == 233) {
      return { articles: [], total: 0, totalWordCount: 0 };
    }
    return data;
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
export const getCategoryArticles = async (
  category: string
): Promise<Article[]> => {
  try {
    const url = `${config.baseUrl}api/public/category/${encodeQuerystring(category)}/articles`;
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
    return { article: data.article };
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

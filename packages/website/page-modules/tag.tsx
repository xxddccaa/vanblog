import React from "react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import AuthorCard, { AuthorCardProps } from "../components/AuthorCard";
import Layout from "../components/Layout";
import { getTarget } from "../components/Link/tools";
import { encodeQuerystring } from "../utils/encode";
import { LayoutProps } from "../utils/getLayoutProps";
import { getTagPageProps } from "../utils/getPageProps";
import { revalidate } from "../utils/loadConfig";

interface TagWithCount {
  name: string;
  articleCount: number;
}

export interface TagPageProps {
  layoutProps: LayoutProps;
  authorCardProps: AuthorCardProps;
  tags: string[];
}

const PAGE_SIZE = 120;
const toStaticTagShell = (tags: string[]): TagWithCount[] =>
  (tags || []).map((tag) => ({ name: tag, articleCount: 0 }));

const TagPage = (props: TagPageProps) => {
  const [tags, setTags] = useState<TagWithCount[]>(() => toStaticTagShell(props.tags));
  const [loading, setLoading] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "articleCount">("articleCount");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalTags, setTotalTags] = useState(props.tags.length);
  const [totalPages, setTotalPages] = useState(1);

  const loadTags = useCallback(
    async (
      page: number,
      nextSearch: string,
      nextSortBy: "name" | "articleCount",
      nextSortOrder: "asc" | "desc"
    ) => {
      setLoading(true);
      try {
        const search = nextSearch.trim();
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(PAGE_SIZE),
          sortBy: nextSortBy,
          sortOrder: nextSortOrder,
        });
        if (search) {
          params.set("search", search);
        }

        const response = await fetch(`/api/public/tags/paginated?${params.toString()}`);
        const result = await response.json();

        if (result.statusCode === 200 && result.data) {
          setTags(result.data.tags || []);
          setCurrentPage(result.data.page || page);
          setTotalTags(result.data.total || 0);
          setTotalPages(result.data.totalPages || 1);
          return;
        }

        throw new Error("Failed to load tags");
      } catch (error) {
        console.error("加载标签失败:", error);
        const fallback = toStaticTagShell(props.tags);
        setTags(fallback.slice(0, PAGE_SIZE));
        setCurrentPage(1);
        setTotalTags(fallback.length);
        setTotalPages(Math.max(1, Math.ceil(fallback.length / PAGE_SIZE)));
      } finally {
        setLoading(false);
      }
    },
    [props.tags]
  );

  useEffect(() => {
    void loadTags(1, "", "articleCount", "desc");
  }, [loadTags]);

  const handleSearch = async () => {
    const nextSearch = searchKeyword.trim();
    setAppliedSearch(nextSearch);
    await loadTags(1, nextSearch, sortBy, sortOrder);
  };

  const handleSortChange = async (
    nextSortBy: "name" | "articleCount",
    nextSortOrder: "asc" | "desc"
  ) => {
    setSortBy(nextSortBy);
    setSortOrder(nextSortOrder);
    await loadTags(1, appliedSearch, nextSortBy, nextSortOrder);
  };

  const handleReload = async () => {
    await loadTags(currentPage, appliedSearch, sortBy, sortOrder);
  };

  const handlePageChange = async (page: number) => {
    await loadTags(page, appliedSearch, sortBy, sortOrder);
  };

  return (
    <Layout
      option={props.layoutProps}
      contentWidthMode={props.layoutProps.articleWidthMode}
      title="标签"
      sideBar={<AuthorCard option={props.authorCardProps}></AuthorCard>}
    >
      <div className="bg-white card-shadow dark:bg-dark dark:card-shadow-dark py-4 px-8 md:py-6 md:px-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl md:text-3xl text-gray-700 dark:text-dark font-bold mb-4">
            标签
          </h1>
        </div>
        <div className="flex items-center justify-between mb-4">
          <div className="text-lg md:text-xl text-gray-700 dark:text-dark">
            标签列表
          </div>
          <button
            onClick={handleReload}
            disabled={loading}
            className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
          >
            {loading ? "加载中..." : "刷新"}
          </button>
        </div>

        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="搜索标签..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  void handleSearch();
                }
              }}
            />
          </div>
          <div className="flex gap-2">
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [nextSortBy, nextSortOrder] = e.target.value.split("-") as [
                  "name" | "articleCount",
                  "asc" | "desc"
                ];
                void handleSortChange(nextSortBy, nextSortOrder);
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
            >
              <option value="articleCount-desc" className="dark:bg-gray-800 dark:text-gray-100">按文章数量 (降序)</option>
              <option value="articleCount-asc" className="dark:bg-gray-800 dark:text-gray-100">按文章数量 (升序)</option>
              <option value="name-asc" className="dark:bg-gray-800 dark:text-gray-100">按名称 (A-Z)</option>
              <option value="name-desc" className="dark:bg-gray-800 dark:text-gray-100">按名称 (Z-A)</option>
            </select>
            <button
              onClick={() => {
                void handleSearch();
              }}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              搜索
            </button>
          </div>
        </div>

        {loading && (
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400">
            正在加载标签数据...
          </div>
        )}

        {!loading && tags.length > 0 && (
          <>
            <div className="flex flex-wrap gap-3">
              {tags.map((tag) => (
                <Link
                  href={`/tag/${encodeQuerystring(tag.name)}`}
                  key={`tag-${tag.name}`}
                  target={getTarget(
                    props.layoutProps.openArticleLinksInNewWindow == "true"
                  )}
                >
                  <div className="group flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-all transform hover:scale-105 cursor-pointer">
                    <span className="text-gray-700 dark:text-dark group-hover:text-gray-900 dark:group-hover:text-dark-hover">
                      {tag.name}
                    </span>
                    {tag.articleCount > 0 && (
                      <span className="text-xs bg-blue-500 text-white px-2 py-1 rounded-full text-[10px]">
                        {tag.articleCount}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>

            <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between text-sm text-gray-500 dark:text-gray-400">
              <div>
                {appliedSearch ? (
                  <>
                    找到 {totalTags} 个标签
                    <span className="ml-2">(搜索: "{appliedSearch}")</span>
                  </>
                ) : (
                  <>共 {totalTags} 个标签</>
                )}
              </div>
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      void handlePageChange(currentPage - 1);
                    }}
                    disabled={currentPage <= 1}
                    className="px-3 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50"
                  >
                    上一页
                  </button>
                  <span>
                    第 {currentPage} / {totalPages} 页
                  </span>
                  <button
                    onClick={() => {
                      void handlePageChange(currentPage + 1);
                    }}
                    disabled={currentPage >= totalPages}
                    className="px-3 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50"
                  >
                    下一页
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {!loading && tags.length === 0 && (
          <div className="text-center py-8">
            <div className="text-gray-500 dark:text-gray-400 mb-2">
              {appliedSearch ? `没有找到包含 "${appliedSearch}" 的标签` : "暂无标签数据"}
            </div>
            {appliedSearch && (
              <button
                onClick={() => {
                  setSearchKeyword("");
                  setAppliedSearch("");
                  void loadTags(1, "", sortBy, sortOrder);
                }}
                className="text-blue-500 hover:text-blue-600 transition-colors"
              >
                清除搜索条件
              </button>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default TagPage;

export async function getStaticProps(): Promise<{
  props: TagPageProps;
  revalidate?: number;
}> {
  return {
    props: {
      ...(await getTagPageProps()),
    },
    ...revalidate,
  };
}

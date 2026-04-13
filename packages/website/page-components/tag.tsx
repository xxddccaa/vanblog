'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import AuthorCard, { AuthorCardProps } from '../components/AuthorCard';
import Layout from '../components/Layout';
import { getTarget } from '../components/Link/tools';
import { encodeQuerystring } from '../utils/encode';
import { LayoutProps } from '../utils/getLayoutProps';

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

export default function TagPage(props: TagPageProps) {
  const [tags, setTags] = useState<TagWithCount[]>(() => toStaticTagShell(props.tags));
  const [loading, setLoading] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'articleCount'>('articleCount');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalTags, setTotalTags] = useState(props.tags.length);
  const [totalPages, setTotalPages] = useState(1);

  const loadTags = useCallback(
    async (
      page: number,
      nextSearch: string,
      nextSortBy: 'name' | 'articleCount',
      nextSortOrder: 'asc' | 'desc'
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
          params.set('search', search);
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

        throw new Error('Failed to load tags');
      } catch (error) {
        console.error('加载标签失败:', error);
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
    void loadTags(1, '', 'articleCount', 'desc');
  }, [loadTags]);

  const handleSearch = async () => {
    const nextSearch = searchKeyword.trim();
    setAppliedSearch(nextSearch);
    await loadTags(1, nextSearch, sortBy, sortOrder);
  };

  const handleSortChange = async (
    nextSortBy: 'name' | 'articleCount',
    nextSortOrder: 'asc' | 'desc'
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
      title="标签"
      sideBar={<AuthorCard option={props.authorCardProps}></AuthorCard>}
    >
      <div className="bg-white card-shadow dark:bg-dark dark:card-shadow-dark py-4 px-8 md:py-6 md:px-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl md:text-3xl text-gray-700 dark:text-dark font-bold mb-4">
            标签
          </h1>
          <div className="text-center text-gray-600 text-sm font-light dark:text-dark mb-6">
            共有 {totalTags} 个标签
          </div>
        </div>
        <div className="mb-8 rounded-xl border border-dashed border-gray-300 p-4 dark:border-dark-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex-1">
              <label className="mb-2 block text-sm font-medium text-gray-600 dark:text-dark-light">搜索标签</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchKeyword}
                  onChange={(event) => setSearchKeyword(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      void handleSearch();
                    }
                  }}
                  placeholder="输入标签名关键字"
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-gray-500 dark:border-dark-3 dark:bg-dark-2 dark:text-dark"
                />
                <button
                  type="button"
                  onClick={() => void handleSearch()}
                  className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-700 dark:bg-dark-hover dark:hover:bg-dark-light"
                >
                  搜索
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleSortChange('articleCount', sortBy === 'articleCount' && sortOrder === 'desc' ? 'asc' : 'desc')}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm transition hover:border-gray-500 dark:border-dark-3"
              >
                按文章数{sortBy === 'articleCount' ? (sortOrder === 'desc' ? '↓' : '↑') : ''}
              </button>
              <button
                type="button"
                onClick={() => void handleSortChange('name', sortBy === 'name' && sortOrder === 'asc' ? 'desc' : 'asc')}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm transition hover:border-gray-500 dark:border-dark-3"
              >
                按名称{sortBy === 'name' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
              </button>
              <button
                type="button"
                onClick={() => void handleReload()}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm transition hover:border-gray-500 dark:border-dark-3"
              >
                刷新
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-gray-500 dark:text-dark-light">加载中...</div>
        ) : tags.length === 0 ? (
          <div className="py-12 text-center text-gray-500 dark:text-dark-light">未找到匹配标签</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tags.map((tag) => (
              <Link
                href={`/tag/${encodeQuerystring(tag.name)}`}
                key={tag.name}
                target={getTarget(props.layoutProps.openArticleLinksInNewWindow == 'true')}
                className="group rounded-xl border border-gray-200 px-4 py-3 transition hover:border-gray-400 hover:bg-gray-50 dark:border-dark-3 dark:hover:bg-dark-2"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate font-medium text-gray-700 dark:text-dark">#{tag.name}</span>
                  <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-500 dark:bg-dark-3 dark:text-dark-light">
                    {tag.articleCount}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2 text-sm">
            <button
              type="button"
              disabled={currentPage <= 1 || loading}
              onClick={() => void handlePageChange(currentPage - 1)}
              className="rounded-lg border border-gray-300 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-dark-3"
            >
              上一页
            </button>
            <span className="px-3 py-2 text-gray-500 dark:text-dark-light">
              第 {currentPage} / {totalPages} 页
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages || loading}
              onClick={() => void handlePageChange(currentPage + 1)}
              className="rounded-lg border border-gray-300 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-dark-3"
            >
              下一页
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}

import Link from "next/link";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import AuthorCard, { AuthorCardProps } from "../components/AuthorCard";
import Layout from "../components/Layout";
import { encodeQuerystring } from "../utils/encode";
import { LayoutProps } from "../utils/getLayoutProps";
import { getTagPageProps } from "../utils/getPageProps";
import { revalidate } from "../utils/loadConfig";
import { getTarget } from "../components/Link/tools";

interface TagWithCount {
  name: string;
  articleCount: number;
}

export interface TagPageProps {
  layoutProps: LayoutProps;
  authorCardProps: AuthorCardProps;
  tags: string[];
  hotTags?: TagWithCount[];
}

const TagPage = (props: TagPageProps) => {
  const [allTags, setAllTags] = useState<TagWithCount[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [sortBy, setSortBy] = useState<'name' | 'articleCount'>('articleCount');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [loadProgress, setLoadProgress] = useState({ current: 0, total: 0 });
  const [hasStartedLoading, setHasStartedLoading] = useState(false);

  // 分批加载所有标签
  const loadAllTags = useCallback(async () => {
    if (hasStartedLoading) return;
    
    setHasStartedLoading(true);
    setLoading(true);
    setLoadProgress({ current: 0, total: 0 });

    try {
      let allLoadedTags: TagWithCount[] = [];
      let currentPage = 1;
      const pageSize = 1000; // 每页1000个标签
      let hasMore = true;
      let totalTags = 0;

      while (hasMore) {
        try {
          const response = await fetch(`/api/public/tags/paginated?page=${currentPage}&pageSize=${pageSize}&sortBy=articleCount&sortOrder=desc`);
          const result = await response.json();
          
          if (result.statusCode === 200 && result.data?.tags) {
            const newTags = result.data.tags || [];
            allLoadedTags = [...allLoadedTags, ...newTags];
            
            // 更新进度
            if (result.data.total) {
              totalTags = result.data.total;
              setLoadProgress({ current: allLoadedTags.length, total: totalTags });
            }
            
            // 如果返回的标签数量少于pageSize，说明已经是最后一页
            hasMore = newTags.length === pageSize;
            currentPage++;
            
            // 避免无限循环，最多加载100页
            if (currentPage > 100) {
              console.warn('已达到最大页数限制，停止加载');
              break;
            }
          } else {
            // API调用失败，使用备用数据
            console.log('分页API调用失败，使用备用数据');
            hasMore = false;
            break;
          }
        } catch (error) {
          console.error(`加载第${currentPage}页标签失败:`, error);
          hasMore = false;
          break;
        }
      }

      if (allLoadedTags.length > 0) {
        setAllTags(allLoadedTags);
      } else {
        // 如果分页API完全失败，使用备用数据
        if (props.hotTags && props.hotTags.length > 0) {
          setAllTags(props.hotTags);
        } else {
          const tagsWithCount = props.tags.map(tag => ({ name: tag, articleCount: 0 }));
          setAllTags(tagsWithCount);
        }
      }
    } catch (error) {
      console.error('加载标签失败:', error);
      // 使用备用数据
      if (props.hotTags && props.hotTags.length > 0) {
        setAllTags(props.hotTags);
      } else {
        const tagsWithCount = props.tags.map(tag => ({ name: tag, articleCount: 0 }));
        setAllTags(tagsWithCount);
      }
    } finally {
      setLoading(false);
    }
  }, [props.hotTags, props.tags, hasStartedLoading]);

  // 初始化加载
  useEffect(() => {
    loadAllTags();
  }, [loadAllTags]);

  // 搜索和排序处理
  const filteredAndSortedTags = useMemo(() => {
    let filtered = allTags;

    // 搜索过滤
    if (searchKeyword.trim()) {
      filtered = allTags.filter(tag => 
        tag.name.toLowerCase().includes(searchKeyword.toLowerCase())
      );
    }

    // 排序
    filtered.sort((a, b) => {
      let compareValue = 0;
      
      if (sortBy === 'name') {
        compareValue = a.name.localeCompare(b.name, 'zh-CN');
      } else if (sortBy === 'articleCount') {
        compareValue = a.articleCount - b.articleCount;
      }
      
      return sortOrder === 'asc' ? compareValue : -compareValue;
    });

    return filtered;
  }, [allTags, searchKeyword, sortBy, sortOrder]);

  // 处理搜索
  const handleSearch = () => {
    // 搜索逻辑已经在 useMemo 中处理，这里不需要额外操作
  };

  // 处理排序变化
  const handleSortChange = (newSortBy: 'name' | 'articleCount', newSortOrder: 'asc' | 'desc') => {
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
  };

  // 重新加载标签
  const handleReload = () => {
    setHasStartedLoading(false);
    setAllTags([]);
    loadAllTags();
  };

  return (
    <Layout
      option={props.layoutProps}
      title="标签"
      sideBar={<AuthorCard option={props.authorCardProps}></AuthorCard>}
    >
      <div className="bg-white card-shadow dark:bg-dark dark:card-shadow-dark py-4 px-8 md:py-6 md:px-8">
        <div className="flex items-center justify-between mb-4">
          <div className="text-lg md:text-xl text-gray-700 dark:text-dark">
            标签
          </div>
          <button
            onClick={handleReload}
            disabled={loading}
            className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
          >
            {loading ? '加载中...' : '刷新'}
          </button>
        </div>
        
        {/* 搜索和排序控件 */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="搜索标签..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleSearch();
                }
              }}
            />
          </div>
          <div className="flex gap-2">
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [newSortBy, newSortOrder] = e.target.value.split('-') as ['name' | 'articleCount', 'asc' | 'desc'];
                handleSortChange(newSortBy, newSortOrder);
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
            >
              <option value="articleCount-desc" className="dark:bg-gray-800 dark:text-gray-100">按文章数量 (降序)</option>
              <option value="articleCount-asc" className="dark:bg-gray-800 dark:text-gray-100">按文章数量 (升序)</option>
              <option value="name-asc" className="dark:bg-gray-800 dark:text-gray-100">按名称 (A-Z)</option>
              <option value="name-desc" className="dark:bg-gray-800 dark:text-gray-100">按名称 (Z-A)</option>
            </select>
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              搜索
            </button>
          </div>
        </div>

        {/* 加载状态和进度 */}
        {loading && (
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="text-blue-600 dark:text-blue-400 font-medium">
                正在加载标签数据...
              </div>
              {loadProgress.total > 0 && (
                <div className="text-sm text-blue-500 dark:text-blue-300">
                  {loadProgress.current} / {loadProgress.total}
                </div>
              )}
            </div>
            {loadProgress.total > 0 && (
              <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(loadProgress.current / loadProgress.total) * 100}%` }}
                ></div>
              </div>
            )}
            <div className="text-xs text-blue-500 dark:text-blue-300 mt-1">
              由于标签数量较多，初次加载可能需要一些时间，请耐心等待...
            </div>
          </div>
        )}

        {/* 标签列表 */}
        {!loading && (
          <>
            <div className="flex flex-wrap gap-3">
              {filteredAndSortedTags.map((tag) => (
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
                      <span className="text-xs bg-blue-500 text-white px-2 py-1 rounded-full">
                        {tag.articleCount}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>

            {/* 显示统计信息 */}
            <div className="mt-6 text-center text-gray-500 dark:text-gray-400 text-sm">
              {searchKeyword ? (
                <>
                  找到 {filteredAndSortedTags.length} 个标签
                  <span className="ml-2">(搜索: "{searchKeyword}")</span>
                  <span className="ml-2">• 总计 {allTags.length} 个标签</span>
                </>
              ) : (
                <>共 {allTags.length} 个标签</>
              )}
            </div>

            {/* 如果没有找到标签 */}
            {filteredAndSortedTags.length === 0 && searchKeyword && (
              <div className="text-center py-8">
                <div className="text-gray-500 dark:text-gray-400 mb-2">
                  没有找到包含 "{searchKeyword}" 的标签
                </div>
                <button
                  onClick={() => setSearchKeyword("")}
                  className="text-blue-500 hover:text-blue-600 transition-colors"
                >
                  清除搜索条件
                </button>
              </div>
            )}

            {/* 如果完全没有标签 */}
            {allTags.length === 0 && !loading && (
              <div className="text-center py-8">
                <div className="text-gray-500 dark:text-gray-400 mb-2">
                  暂无标签数据
                </div>
                <button
                  onClick={handleReload}
                  className="text-blue-500 hover:text-blue-600 transition-colors"
                >
                  重新加载
                </button>
              </div>
            )}
          </>
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
  const baseProps = await getTagPageProps();
  
  // 尝试获取少量热门标签作为备用数据
  let hotTags: TagWithCount[] = [];
  try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/public/tags/hot?limit=100`);
    const result = await response.json();
    if (result.statusCode === 200) {
      hotTags = result.data || [];
    }
  } catch (error) {
    console.log('获取热门标签失败，使用原有数据');
  }

  return {
    props: {
      ...baseProps,
      hotTags,
    },
    ...revalidate,
  };
}

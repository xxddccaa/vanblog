import React from 'react';
import { GetStaticProps } from 'next';
import { useEffect, useState, useMemo, useCallback } from 'react';
import Layout from '../components/Layout';
import { getPublicMeta } from '../api/getAllData';
import { getLayoutProps, getAuthorCardProps, LayoutProps } from '../utils/getLayoutProps';
import AuthorCard, { AuthorCardProps } from '../components/AuthorCard';
import Head from 'next/head';
import styles from '../styles/nav.module.css';

interface NavTool {
  _id: string;
  name: string;
  url: string;
  logo?: string;
  categoryId: string;
  categoryName?: string;
  description?: string;
  sort: number;
  hide: boolean;
  useCustomIcon: boolean;
  customIcon?: string;
  createdAt: string;
  updatedAt: string;
}

interface NavCategory {
  _id: string;
  name: string;
  description?: string;
  sort: number;
  hide: boolean;
  createdAt: string;
  updatedAt: string;
  toolCount?: number;
}

interface NavData {
  categories: NavCategory[];
  tools: NavTool[];
}

interface NavPageProps {
  layoutProps: LayoutProps;
  initialNavData: NavData;
  authorCardProps: AuthorCardProps;
}

// 多重搜索函数（支持中文拼音搜索）
const multiSearch = (source: string, target: string): boolean => {
  if (!source || !target) return false;
  const sourceLower = source.toLowerCase();
  const targetLower = target.toLowerCase();
  return sourceLower.includes(targetLower);
};

export default function NavPage({ 
  initialNavData, 
  authorCardProps,
  layoutProps 
}: NavPageProps) {
  const { siteName, description } = layoutProps;
  const [searchString, setSearchString] = useState('');
  const [currentCategory, setCurrentCategory] = useState('全部工具');
  const [clientNavData, setClientNavData] = useState<NavData>(initialNavData);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Ensure navigation menu exists (added debugging)
  useEffect(() => {
    console.log('Nav menus:', layoutProps.menus);
    // Make sure this page is included in the navigation
    if (!layoutProps.menus.some(menu => menu.value === '/nav')) {
      console.log('Adding nav menu item');
      const menusCopy = [...layoutProps.menus];
      menusCopy.splice(6, 0, {
        id: typeof menusCopy[0].id === 'number' ? 100 : Date.now(),
        name: '导航',
        value: '/nav',
        level: 0
      });
      layoutProps.menus = menusCopy;
    }
  }, [layoutProps]);

  // Ensure author card props are correct
  useEffect(() => {
    console.log('Author card props:', authorCardProps);
    // Make sure the author card has all required data
    if (!authorCardProps.author || authorCardProps.author === '作者名字') {
      console.log('Fixing author card props');
      const updatedProps = { ...authorCardProps };
      
      // Try to use default values if needed
      if (authorCardProps.author === '作者名字') {
        updatedProps.author = '站长';
      }
      if (authorCardProps.desc === '作者描述') {
        updatedProps.desc = '网站管理员';
      }
      if (!authorCardProps.logo || authorCardProps.logo === '/logo.svg') {
        updatedProps.logo = layoutProps.logo || '/logo.svg';
      }
      
      // Set the updated props
      Object.assign(authorCardProps, updatedProps);
    }
  }, [authorCardProps, layoutProps]);

  // 构建分类列表
  const categories = useMemo(() => {
    const allCategories = ['全部工具'];
    if (clientNavData.categories) {
      clientNavData.categories
        .filter(cat => !cat.hide)
        .sort((a, b) => a.sort - b.sort)
        .forEach(cat => allCategories.push(cat.name));
    }
    return allCategories;
  }, [clientNavData.categories]);

  // 过滤工具
  const filteredTools = useMemo(() => {
    if (!clientNavData.tools) return [];
    
    return clientNavData.tools
      .filter(tool => !tool.hide)
      .filter(tool => {
        if (currentCategory === '全部工具') return true;
        return tool.categoryName === currentCategory;
      })
      .filter(tool => {
        if (!searchString.trim()) return true;
        return (
          multiSearch(tool.name, searchString) ||
          multiSearch(tool.description || '', searchString) ||
          multiSearch(tool.url, searchString)
        );
      })
      .sort((a, b) => a.sort - b.sort);
  }, [clientNavData.tools, currentCategory, searchString]);

  // 处理分类变化
  const handleCategoryChange = useCallback((category: string) => {
    setCurrentCategory(category);
    setSearchString('');
  }, []);

  // 处理搜索
  const handleSearch = useCallback((value: string) => {
    if (value.trim()) {
      setCurrentCategory('全部工具');
    }
  }, []);

  // 客户端数据更新
  useEffect(() => {
    const fetchNavData = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/public/nav/data');
        const result = await response.json();
        if (result.statusCode === 200) {
          setClientNavData(result.data);
        }
      } catch (error) {
        console.error('Failed to fetch nav data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchNavData();
  }, []);

  // 恢复上次选择的分类
  useEffect(() => {
    // 只有在页面首次加载且未初始化时才尝试恢复分类
    if (!initialized) {
      // 确保默认选中"全部工具"
      setCurrentCategory('全部工具');
      setInitialized(true);
    }
  }, [categories, initialized]);

  // 键盘事件处理
  useEffect(() => {
    const handleKeyDown = (ev: KeyboardEvent) => {
      // 任意字符键聚焦搜索框
      const reg = /[a-zA-Z0-9]|[\u4e00-\u9fa5]/g;
      if (reg.test(ev.key)) {
        const searchInput = document.getElementById('nav-search-bar');
        if (searchInput && document.activeElement !== searchInput) {
          searchInput.focus();
        }
      }

      // Enter键打开第一个工具
      if (ev.key === 'Enter' && filteredTools.length > 0) {
        window.open(filteredTools[0].url, '_blank');
      }

      // Ctrl/Cmd + 数字键打开对应工具
      if ((ev.ctrlKey || ev.metaKey) && /^[1-9]$/.test(ev.key)) {
        ev.preventDefault();
        const index = parseInt(ev.key) - 1;
        if (index < filteredTools.length) {
          window.open(filteredTools[index].url, '_blank');
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [filteredTools]);

  return (
    <>
      <Head>
        <title>{`导航 - ${siteName}`}</title>
        <meta name="description" content={description} />
        <meta property="og:title" content={`导航 - ${siteName}`} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="website" />
      </Head>

      <Layout
        option={layoutProps}
        title={`导航 - ${siteName}`}
        sideBar={<AuthorCard option={authorCardProps} />}
      >
        <div className="bg-white dark:text-dark card-shadow dark:bg-dark dark:card-shadow-dark py-4 px-8 md:py-6 md:px-8 max-w-4xl mx-auto">
          <div className={styles.navSearchSection}>
            <input
              id="nav-search-bar"
              type="search"
              placeholder="按任意键直接开始搜索"
              className={styles.navSearchInput}
              value={searchString}
              onChange={(e) => {
                setSearchString(e.target.value);
                handleSearch(e.target.value);
              }}
            />
          </div>

          <div className={styles.navCategoriesSection}>
            {categories.map((category) => (
              <button
                key={category}
                className={`${styles.navCategoryBtn} ${currentCategory === category ? styles.navCategoryBtnActive : ''}`}
                onClick={() => handleCategoryChange(category)}
              >
                {category}
              </button>
            ))}
          </div>

          <div className={styles.navToolsSection}>
            {loading ? (
              <div className={styles.navLoading}>
                <div className={styles.navSpinner}></div>
                <p>加载中...</p>
              </div>
            ) : filteredTools.length > 0 ? (
              <div className="grid gap-2 sm:gap-4 grid-cols-2 lg:grid-cols-3">
                {filteredTools.map((tool, index) => (
                  <div
                    key={tool._id}
                    className={styles.navToolCard}
                    onClick={() => window.open(tool.url, '_blank')}
                  >
                    {/* 搜索时显示序号 */}
                    {searchString && (
                      <div className={styles.navToolIndex}>
                        {index + 1}
                      </div>
                    )}
                    <div className={styles.cardContent}>
                      <div className={styles.cardLeft}>
                        {tool.useCustomIcon && tool.customIcon ? (
                          <img src={tool.customIcon} alt={tool.name} onError={(e) => {
                            e.currentTarget.src = '/yly_tools_logo.png';
                          }} />
                        ) : tool.logo ? (
                          <img src={tool.logo} alt={tool.name} onError={(e) => {
                            e.currentTarget.src = '/yly_tools_logo.png';
                          }} />
                        ) : (
                          <img src="/yly_tools_logo.png" alt={tool.name} />
                        )}
                      </div>
                      <div className={styles.cardRight}>
                        <div className={styles.cardRightTop}>
                          <span className={styles.cardRightTitle} title={tool.name}>{tool.name}</span>
                          {tool.categoryName && (
                            <span className={styles.cardTag} title={tool.categoryName}>{tool.categoryName}</span>
                          )}
                        </div>
                        {tool.description && (
                          <div className={styles.cardRightBottom} title={tool.description}>{tool.description}</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.navEmpty}>
                <h3>暂无工具</h3>
                <p>
                  {searchString 
                    ? `没有找到包含"${searchString}"的工具` 
                    : '该分类下暂无可用工具'
                  }
                </p>
              </div>
            )}
          </div>
        </div>
      </Layout>
    </>
  );
}

export const getStaticProps: GetStaticProps = async () => {
  try {
    // 获取页面基础数据
    const data = await getPublicMeta();
    const layoutProps = getLayoutProps(data);
    const authorCardProps = getAuthorCardProps(data);

    // 获取导航数据
    let initialNavData: NavData = { categories: [], tools: [] };
    
    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.VAN_BLOG_SERVER_URL || 'http://localhost:3000';
      const navResponse = await fetch(`${baseUrl}/api/public/nav/data`);
      const navResult = await navResponse.json();
      if (navResult.statusCode === 200) {
        initialNavData = navResult.data;
      }
    } catch (navError) {
      console.error('Failed to fetch nav data during build:', navError);
      // 使用默认空数据，客户端会重新加载
    }

    return {
      props: {
        layoutProps,
        initialNavData,
        authorCardProps,
      },
      revalidate: 10, // 10秒后重新生成静态页面
    };
  } catch (error) {
    console.error('Error in getStaticProps for nav page:', error);
    
    // 返回默认数据
    const data = await getPublicMeta();
    const layoutProps = getLayoutProps(data);
    const authorCardProps = getAuthorCardProps(data);

    return {
      props: {
        layoutProps,
        initialNavData: { categories: [], tools: [] },
        authorCardProps,
      },
      revalidate: 60,
    };
  }
}; 
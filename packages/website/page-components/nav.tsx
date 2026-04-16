'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Layout from '../components/Layout';
import { LayoutProps } from '../utils/getLayoutProps';
import AuthorCard, { AuthorCardProps } from '../components/AuthorCard';
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

export interface NavPageProps {
  layoutProps: LayoutProps;
  initialNavData: NavData;
  authorCardProps: AuthorCardProps;
}

const multiSearch = (source: string, target: string): boolean => {
  if (!source || !target) return false;
  return source.toLowerCase().includes(target.toLowerCase());
};

export default function NavPage({ initialNavData, authorCardProps, layoutProps }: NavPageProps) {
  const { siteName, description } = layoutProps;
  const [searchString, setSearchString] = useState('');
  const [currentCategory, setCurrentCategory] = useState('全部工具');
  const [clientNavData, setClientNavData] = useState<NavData>(initialNavData);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!layoutProps.menus.some((menu) => menu.value === '/nav')) {
      const menusCopy = [...layoutProps.menus];
      menusCopy.splice(6, 0, {
        id: typeof menusCopy[0]?.id === 'number' ? 100 : Date.now(),
        name: '导航',
        value: '/nav',
        level: 0,
      });
      layoutProps.menus = menusCopy;
    }
  }, [layoutProps]);

  useEffect(() => {
    if (!authorCardProps.author || authorCardProps.author === '作者名字') {
      const updatedProps = { ...authorCardProps };
      if (authorCardProps.author === '作者名字') updatedProps.author = '站长';
      if (authorCardProps.desc === '作者描述') updatedProps.desc = '网站管理员';
      if (!authorCardProps.logo || authorCardProps.logo === '/logo.svg') {
        updatedProps.logo = layoutProps.logo || '/logo.svg';
      }
      Object.assign(authorCardProps, updatedProps);
    }
  }, [authorCardProps, layoutProps]);

  const categories = useMemo(() => {
    const allCategories = ['全部工具'];
    (clientNavData.categories || [])
      .filter((category) => !category.hide)
      .sort((a, b) => a.sort - b.sort)
      .forEach((category) => allCategories.push(category.name));
    return allCategories;
  }, [clientNavData.categories]);

  const filteredTools = useMemo(() => {
    return (clientNavData.tools || [])
      .filter((tool) => !tool.hide)
      .filter((tool) => currentCategory === '全部工具' || tool.categoryName === currentCategory)
      .filter((tool) => {
        if (!searchString.trim()) return true;
        return (
          multiSearch(tool.name, searchString) ||
          multiSearch(tool.description || '', searchString) ||
          multiSearch(tool.url, searchString)
        );
      })
      .sort((a, b) => a.sort - b.sort);
  }, [clientNavData.tools, currentCategory, searchString]);

  const handleCategoryChange = useCallback((category: string) => {
    setCurrentCategory(category);
    setSearchString('');
  }, []);

  const handleSearch = useCallback((value: string) => {
    if (value.trim()) {
      setCurrentCategory('全部工具');
    }
  }, []);

  useEffect(() => {
    if (initialNavData.tools && initialNavData.tools.length > 0) {
      return;
    }

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
        setClientNavData(initialNavData);
      } finally {
        setLoading(false);
      }
    };

    void fetchNavData();
  }, [initialNavData]);

  useEffect(() => {
    if (!initialized) {
      setCurrentCategory('全部工具');
      setInitialized(true);
    }
  }, [initialized]);

  useEffect(() => {
    const handleKeyDown = (ev: KeyboardEvent) => {
      const reg = /[a-zA-Z0-9]|[\u4e00-\u9fa5]/g;
      if (reg.test(ev.key)) {
        const searchInput = document.getElementById('nav-search-bar');
        if (searchInput && document.activeElement !== searchInput) {
          searchInput.focus();
        }
      }

      if (ev.key === 'Enter' && filteredTools.length > 0) {
        window.open(filteredTools[0].url, '_blank');
      }

      if ((ev.ctrlKey || ev.metaKey) && /^[1-9]$/.test(ev.key)) {
        ev.preventDefault();
        const index = Number.parseInt(ev.key, 10) - 1;
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

      <Layout option={layoutProps}
      contentWidthMode={layoutProps.articleWidthMode} title={`导航 - ${siteName}`} sideBar={<AuthorCard option={authorCardProps} />}>
        <div className="vb-surface-card dark:text-dark card-shadow dark:card-shadow-dark py-4 px-8 md:py-6 md:px-8 max-w-4xl mx-auto">
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
                  <div key={tool._id} className={styles.navToolCard} onClick={() => window.open(tool.url, '_blank')}>
                    {searchString && <div className={styles.navToolIndex}>{index + 1}</div>}
                    <div className={styles.cardContent}>
                      <div className={styles.cardLeft}>
                        {tool.useCustomIcon && tool.customIcon ? (
                          <img src={tool.customIcon} alt={tool.name} onError={(e) => { e.currentTarget.src = '/yly_tools_logo.png'; }} />
                        ) : tool.logo ? (
                          <img src={tool.logo} alt={tool.name} onError={(e) => { e.currentTarget.src = '/yly_tools_logo.png'; }} />
                        ) : (
                          <img src="/yly_tools_logo.png" alt={tool.name} />
                        )}
                      </div>
                      <div className={styles.cardRight}>
                        <div className={styles.cardRightTop}>
                          <span className={styles.cardRightTitle} title={tool.name}>{tool.name}</span>
                          {tool.categoryName && <span className={styles.cardTag} title={tool.categoryName}>{tool.categoryName}</span>}
                        </div>
                        {tool.description && <div className={styles.cardRightBottom} title={tool.description}>{tool.description}</div>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.navEmpty}>
                <h3>暂无工具</h3>
                <p>{searchString ? `没有找到包含"${searchString}"的工具` : '该分类下暂无可用工具'}</p>
              </div>
            )}
          </div>
        </div>
      </Layout>
    </>
  );
}

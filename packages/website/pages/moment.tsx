import React, { useEffect, useState } from 'react';
import { GetStaticProps } from 'next';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import { getLayoutProps, getAuthorCardProps, LayoutProps } from '../utils/getLayoutProps';
import { getPublicMeta } from '../api/getAllData';
import Layout from '../components/Layout';
import { getMoments, createMoment } from '../api/getMoments';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import zhCN from 'dayjs/locale/zh-cn';
import Loading from '../components/Loading';
import AuthorCard from '../components/AuthorCard';
import Markdown from '../components/Markdown';

// 配置 dayjs
dayjs.extend(relativeTime);
dayjs.locale(zhCN);

interface Moment {
  id: number;
  content: string;
  createdAt: string;
  updatedAt: string;
}

interface MomentPageProps extends LayoutProps {
  initialMoments: Moment[];
  initialTotal: number;
  authorCardProps: any;
}

export default function MomentPage({ 
  initialMoments, 
  initialTotal,
  authorCardProps,
  ...layoutProps 
}: MomentPageProps) {
  const [moments, setMoments] = useState<Moment[]>(initialMoments || []);
  const [total, setTotal] = useState(initialTotal || 0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [newMoment, setNewMoment] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const pageSize = 10;

  // 检查是否为admin用户
  useEffect(() => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    setIsAdmin(!!token);
  }, []);

  // 如果初始数据为空，在客户端重新加载
  useEffect(() => {
    if (initialMoments.length === 0 && initialTotal === 0) {
      loadMoments(1, true);
    }
  }, [initialMoments.length, initialTotal]);

  const loadMoments = async (currentPage: number, replace = false) => {
    setLoading(true);
    try {
      const data = await getMoments({
        page: currentPage,
        pageSize,
        sortCreatedAt: 'desc',
      });
      
      if (replace) {
        setMoments(data.moments);
      } else {
        setMoments(prev => [...prev, ...data.moments]);
      }
      setTotal(data.total);
    } catch (error) {
      // 只有在首次加载时才显示错误提示
      if (currentPage === 1 && replace) {
        toast.error('加载动态失败');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadMoments(nextPage);
  };

  const handleSubmitMoment = async () => {
    if (!newMoment.trim()) {
      toast.error('动态内容不能为空');
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const response = await createMoment({ content: newMoment.trim() }, token!);
      
      toast.success('发布成功');
      setNewMoment('');
      
      // 直接在前端添加新动态，而不是重新加载
      const newMomentItem = {
        id: response.id || Date.now(), // 使用返回的ID或时间戳
        content: newMoment.trim(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      // 将新动态添加到列表开头
      setMoments(prev => [newMomentItem, ...prev]);
      setTotal(prev => prev + 1);
      
    } catch (error) {
      toast.error('发布失败');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (dateString: string) => {
    try {
      const now = dayjs();
      const target = dayjs(dateString);
      const diffInMinutes = now.diff(target, 'minute');
      const diffInHours = now.diff(target, 'hour');
      const diffInDays = now.diff(target, 'day');
      
      if (diffInMinutes < 1) {
        return '刚刚';
      } else if (diffInMinutes < 60) {
        return `${diffInMinutes}分钟前`;
      } else if (diffInHours < 24) {
        return `${diffInHours}小时前`;
      } else if (diffInDays < 30) {
        return `${diffInDays}天前`;
      } else {
        return target.format('YYYY-MM-DD');
      }
    } catch {
      return dateString;
    }
  };

  const hasMore = moments.length < total;

  return (
    <Layout
      option={layoutProps}
      title={"个人动态 - " + layoutProps.siteName}
      sideBar={<AuthorCard option={authorCardProps} />}
    >
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-dark mb-2">
            个人动态
          </h1>
          <p className="text-gray-600 dark:text-dark-light">
            分享日常生活的点滴
          </p>
        </div>

        {/* 发布动态区域 - 仅管理员可见 */}
        {isAdmin && (
          <div className="bg-white dark:bg-dark-1 rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-dark mb-4">
              发布动态
            </h2>
            <textarea
              value={newMoment}
              onChange={(e) => setNewMoment(e.target.value)}
              placeholder="分享一下你的想法..."
              className="w-full p-3 border border-gray-300 dark:border-dark-3 rounded-lg 
                         bg-white dark:bg-dark-2 text-gray-900 dark:text-dark
                         placeholder-gray-500 dark:placeholder-dark-light
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         resize-vertical min-h-[100px]"
              rows={4}
            />
            <div className="mt-4 flex justify-end">
              <button
                onClick={handleSubmitMoment}
                disabled={submitting || !newMoment.trim()}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400
                           text-white rounded-lg font-medium transition-colors
                           disabled:cursor-not-allowed"
              >
                {submitting ? '发布中...' : '发布动态'}
              </button>
            </div>
          </div>
        )}

        {/* 动态列表 */}
        <div className="space-y-6">
          {moments.map((moment) => (
            <div
              key={moment.id}
              className="bg-white dark:bg-dark-1 rounded-lg shadow-md p-6
                         border border-gray-200 dark:border-dark-3"
            >
              <div className="text-gray-900 dark:text-dark mb-4">
                <Markdown content={moment.content} codeMaxLines={layoutProps.codeMaxLines} />
              </div>
              <div className="text-sm text-gray-500 dark:text-dark-light">
                {formatTime(moment.createdAt)}
              </div>
            </div>
          ))}
        </div>

        {/* 空状态 */}
        {moments.length === 0 && !loading && (
          <div className="text-center py-12">
            <div className="text-gray-500 dark:text-dark-light">
              还没有任何动态
            </div>
          </div>
        )}

        {/* 加载更多 */}
        {hasMore && (
          <div className="text-center mt-8">
            <button
              onClick={handleLoadMore}
              disabled={loading}
              className="px-6 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-dark-2 dark:hover:bg-dark-3
                         text-gray-700 dark:text-dark rounded-lg font-medium transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '加载中...' : '加载更多'}
            </button>
          </div>
        )}

        {/* 全局加载状态 */}
        {loading && page === 1 && (
          <div className="flex justify-center py-4">
            <div className="text-gray-500 dark:text-dark-light">加载中...</div>
          </div>
        )}
      </div>
    </Layout>
  );
}

export const getStaticProps: GetStaticProps = async () => {
  try {
    const data = await getPublicMeta();
    const layoutProps = getLayoutProps(data);
    const authorCardProps = getAuthorCardProps(data);
    
    // 获取初始动态数据
    const momentData = await getMoments({
      page: 1,
      pageSize: 10,
      sortCreatedAt: 'desc',
    });

    return {
      props: {
        ...layoutProps,
        authorCardProps,
        initialMoments: momentData.moments || [],
        initialTotal: momentData.total || 0,
      },
      revalidate: 1, // 1秒重新验证，确保快速更新
    };
  } catch (error) {
    console.error('Error in getStaticProps:', error);
    
    // 获取基本的布局数据，即使动态数据失败
    try {
      const data = await getPublicMeta();
      const layoutProps = getLayoutProps(data);
      const authorCardProps = getAuthorCardProps(data);
      
      return {
        props: {
          ...layoutProps,
          authorCardProps,
          initialMoments: [],
          initialTotal: 0,
        },
        revalidate: 1, // 快速重试
      };
    } catch (layoutError) {
      // 最后的备选方案
      return {
        props: {
          initialMoments: [],
          initialTotal: 0,
          siteName: 'VanBlog',
          description: 'VanBlog',
          authorCardProps: {},
        },
        revalidate: 1,
      };
    }
  }
}; 
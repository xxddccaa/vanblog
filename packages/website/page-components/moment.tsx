'use client';

import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import zhCN from 'dayjs/locale/zh-cn';
import Layout from '../components/Layout';
import { LayoutProps } from '../utils/getLayoutProps';
import { getMoments, createMoment } from '../api/getMoments';
import AuthorCard from '../components/AuthorCard';
import Markdown from '../components/Markdown';
import ImageUpload from '../components/ImageUpload';

dayjs.extend(relativeTime);
dayjs.locale(zhCN);

interface Moment {
  id: number;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface MomentPageProps extends LayoutProps {
  initialMoments: Moment[];
  initialTotal: number;
  authorCardProps: any;
}

export default function MomentPage({ initialMoments, initialTotal, authorCardProps, ...layoutProps }: MomentPageProps) {
  const [moments, setMoments] = useState<Moment[]>(initialMoments || []);
  const [total, setTotal] = useState(initialTotal || 0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [newMoment, setNewMoment] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [justPublished, setJustPublished] = useState(false);
  const pageSize = 10;

  useEffect(() => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    setIsAdmin(!!token);
  }, []);

  useEffect(() => {
    if (initialMoments.length === 0 && initialTotal === 0) {
      void loadMoments(1, true);
    }
  }, [initialMoments.length, initialTotal]);

  const loadMoments = async (currentPage: number, replace = false) => {
    setLoading(true);
    try {
      const data = await getMoments({ page: currentPage, pageSize, sortCreatedAt: 'desc' });
      if (replace) {
        setMoments(data.moments);
      } else {
        setMoments((prev) => [...prev, ...data.moments]);
      }
      setTotal(data.total);
    } catch (error) {
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
    void loadMoments(nextPage);
  };

  const handleImageInsert = (markdown: string) => {
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement | null;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = newMoment;
      const before = text.substring(0, start);
      const after = text.substring(end);
      const newText = before + markdown + after;
      setNewMoment(newText);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + markdown.length, start + markdown.length);
      }, 0);
      return;
    }

    setNewMoment((prev) => prev + markdown);
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
      const currentContent = newMoment.trim();
      setNewMoment('');
      const newMomentItem = {
        id: response.id || Date.now(),
        content: currentContent,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setMoments((prev) => [newMomentItem, ...prev]);
      setTotal((prev) => prev + 1);
      setJustPublished(true);
      setTimeout(() => setJustPublished(false), 3000);
    } catch (error) {
      console.error('发布动态失败:', error);
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
      if (diffInMinutes < 1) return '刚刚';
      if (diffInMinutes < 60) return `${diffInMinutes}分钟前`;
      if (diffInHours < 24) return `${diffInHours}小时前`;
      if (diffInDays < 30) return `${diffInDays}天前`;
      return target.format('YYYY-MM-DD');
    } catch {
      return dateString;
    }
  };

  const hasMore = moments.length < total;

  return (
    <Layout option={layoutProps} title={`动态 - ${layoutProps.siteName}`} sideBar={<AuthorCard option={authorCardProps} />}>
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-dark mb-2">动态</h1>
          <p className="text-gray-600 dark:text-dark-light">分享日常生活的点滴</p>
        </div>

        {isAdmin && (
          <div className="bg-white dark:bg-dark-1 rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-dark mb-4">发布动态</h2>
            <textarea
              value={newMoment}
              onChange={(e) => setNewMoment(e.target.value)}
              placeholder="分享一下你的想法..."
              className="w-full p-3 border border-gray-300 dark:border-dark-3 rounded-lg bg-white dark:bg-dark-2 text-gray-900 dark:text-dark placeholder-gray-500 dark:placeholder-dark-light focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical min-h-[100px]"
              rows={4}
            />
            <div className="mt-4 flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <ImageUpload onImageInsert={handleImageInsert} disabled={submitting} />
              </div>
              <button
                onClick={handleSubmitMoment}
                disabled={submitting || !newMoment.trim()}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed"
              >
                {submitting ? '发布中...' : '发布动态'}
              </button>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {moments.map((moment, index) => (
            <div key={moment.id} className="bg-white dark:bg-dark rounded-lg shadow-md p-6">
              <div className="prose dark:prose-invert max-w-none">
                <Markdown content={moment.content} />
              </div>
              <div className="mt-4 flex items-center justify-between text-sm text-gray-500 dark:text-dark-light">
                <span>{formatTime(moment.createdAt)}</span>
                {justPublished && index === 0 && (
                  <div className="flex items-center text-sm text-green-600 dark:text-green-400">
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    刚刚发布
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {moments.length === 0 && !loading && (
          <div className="text-center py-12">
            <div className="text-gray-500 dark:text-dark-light">还没有任何动态</div>
          </div>
        )}

        {hasMore && (
          <div className="text-center mt-8">
            <button
              onClick={handleLoadMore}
              disabled={loading}
              className="px-6 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-dark-2 dark:hover:bg-dark-3 text-gray-700 dark:text-dark rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '加载中...' : '加载更多'}
            </button>
          </div>
        )}

        {loading && page === 1 && (
          <div className="flex justify-center py-4">
            <div className="text-gray-500 dark:text-dark-light">加载中...</div>
          </div>
        )}
      </div>
    </Layout>
  );
}

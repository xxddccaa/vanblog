import { Article } from "../../types/article";
import { useState } from "react";
import Link from "next/link";
import { getTarget } from "../Link/tools";
import { getArticlePath } from "../../utils/getArticlePath";
import dayjs from "dayjs";

interface TimelinePageProps {
  sortedArticles: Record<string, Article[]>;
  authorCardProps: {
    catelogNum: number;
    postNum: number;
    tagNum: number;
  };
  wordTotal: number;
  openArticleLinksInNewWindow: boolean;
  pageTitle: string;
  pageSubtitle?: string;
}

export default function TimelinePage(props: TimelinePageProps) {
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  const toggleDate = (date: string) => {
    const newExpanded = new Set(expandedDates);
    if (newExpanded.has(date)) {
      newExpanded.delete(date);
    } else {
      newExpanded.add(date);
    }
    setExpandedDates(newExpanded);
  };

  const sortedDates = Object.keys(props.sortedArticles).sort((a, b) => parseInt(b) - parseInt(a));

  return (
    <div className="bg-white card-shadow dark:bg-dark dark:card-shadow-dark py-4 px-8 md:py-6 md:px-8">
      {/* 页面头部 */}
      <div className="text-center mb-8">
        <h1 className="text-2xl md:text-3xl text-gray-700 dark:text-dark font-bold mb-4">
          {props.pageTitle}
        </h1>
        {props.pageSubtitle && (
          <div className="text-center text-gray-600 text-sm font-light dark:text-dark mb-6">
            {props.pageSubtitle}
          </div>
        )}
      </div>

      {/* 时间线列表 */}
      <div className="space-y-6">
        {sortedDates.map((date, index) => {
          const articles = props.sortedArticles[date];
          const isExpanded = expandedDates.has(date);
          const year = date.substring(0, 4);
          const month = date.substring(4, 6);
          const day = date.substring(6, 8);
          const formattedDate = `${year}-${month}-${day}`;
          
          return (
            <div
              key={date}
              className="relative"
            >
              {/* 时间线连接线 */}
              {index < sortedDates.length - 1 && (
                <div className="absolute left-6 top-12 w-0.5 h-full bg-gray-200 dark:bg-dark-2"></div>
              )}
              
              {/* 时间节点 */}
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 relative">
                  <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center shadow-lg">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-blue-500 rounded-full border-2 border-white dark:border-dark"></div>
                </div>

                {/* 日期卡片 */}
                <div className="flex-1 min-w-0">
                  <div 
                    className="bg-white dark:bg-dark-1 border border-gray-200 dark:border-dark-2 rounded-lg overflow-hidden hover:shadow-md transition-all duration-300 cursor-pointer"
                    onClick={() => toggleDate(date)}
                  >
                    {/* 日期头部 */}
                    <div className="p-4 hover:bg-gray-50 dark:hover:bg-dark-2 transition-colors duration-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-dark">
                              {formattedDate}
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-dark-400">
                              {articles.length} 篇文章
                            </p>
                          </div>
                        </div>
                        <button className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-dark-2 transition-colors duration-200">
                          <svg 
                            className={`w-5 h-5 text-gray-500 dark:text-dark-400 transition-transform duration-300 ${
                              isExpanded ? 'rotate-180' : ''
                            }`} 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* 文章列表 */}
                    <div className={`transition-all duration-300 ease-in-out ${
                      isExpanded ? 'max-h-[600px] opacity-100 overflow-y-auto' : 'max-h-0 opacity-0'
                    }`}>
                      <div className="border-t border-gray-200 dark:border-dark-2">
                        <div className="p-4 space-y-3">
                          {articles.map((article, articleIndex) => (
                            <Link
                              key={article.id}
                              href={`/post/${getArticlePath(article)}`}
                              target={getTarget(props.openArticleLinksInNewWindow)}
                              className="block group"
                            >
                              <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-2 transition-colors duration-200">
                                <div className="flex-shrink-0 w-6 h-6 bg-gray-100 dark:bg-dark-2 rounded-full flex items-center justify-center text-xs font-medium text-gray-600 dark:text-dark-400">
                                  {articleIndex + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-sm font-medium text-gray-900 dark:text-dark truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200">
                                    {article.title}
                                  </h4>
                                  <div className="flex items-center space-x-2 mt-1">
                                    <p className="text-xs text-gray-500 dark:text-dark-400">
                                      {dayjs(article.createdAt).format('HH:mm')}
                                    </p>
                                    {article.category && (
                                      <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded-full">
                                        {article.category}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex-shrink-0">
                                  <svg className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                  </svg>
                                </div>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

import { Article } from "../../types/article";
import { useState } from "react";
import Link from "next/link";
import { getTarget } from "../Link/tools";
import { getArticlePath } from "../../utils/getArticlePath";
import dayjs from "dayjs";

interface CategoryPageProps {
  sortedArticles: Record<string, Article[]>;
  authorCardProps: {
    catelogNum: number;
    postNum: number;
    tagNum: number;
  };
  wordTotal: number;
  openArticleLinksInNewWindow: boolean;
  showTags?: boolean;
}

export default function CategoryPage(props: CategoryPageProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  return (
    <div className="bg-white card-shadow dark:bg-dark dark:card-shadow-dark py-4 px-8 md:py-6 md:px-8">
      {/* 页面头部 */}
      <div className="text-center mb-8">
        <h1 className="text-2xl md:text-3xl text-gray-700 dark:text-dark font-bold mb-4">
          分类
        </h1>
        <div className="text-center text-gray-600 text-sm font-light dark:text-dark mb-6">
          {`${props.authorCardProps.catelogNum} 分类 × ${props.authorCardProps.postNum} 文章 × ${props.authorCardProps.tagNum} 标签 × ${props.wordTotal} 字`}
        </div>
      </div>

      {/* 分类列表 */}
      <div className="space-y-4">
        {Object.keys(props.sortedArticles).map((category) => {
          const articles = props.sortedArticles[category];
          const isExpanded = expandedCategories.has(category);
          
          return (
            <div
              key={category}
              className="bg-white dark:bg-dark-1 border border-gray-200 dark:border-dark-2 rounded-lg overflow-hidden hover:shadow-md transition-all duration-300"
            >
              {/* 分类头部 */}
              <div 
                className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-dark-2 transition-colors duration-200"
                onClick={() => toggleCategory(category)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-dark">
                        {category}
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
                  <div className="p-4 space-y-2">
                    {articles.map((article, index) => (
                      <Link
                        key={article.id}
                        href={`/post/${getArticlePath(article)}`}
                        target={getTarget(props.openArticleLinksInNewWindow)}
                        className="block group"
                      >
                        <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-2 transition-colors duration-200">
                          <div className="flex-shrink-0 w-6 h-6 bg-gray-100 dark:bg-dark-2 rounded-full flex items-center justify-center text-xs font-medium text-gray-600 dark:text-dark-400">
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-medium text-gray-900 dark:text-dark truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200">
                              {article.title}
                            </h4>
                            <div className="flex items-center space-x-2 mt-1">
                              <p className="text-xs text-gray-500 dark:text-dark-400">
                                {dayjs(article.createdAt).format('YYYY-MM-DD')}
                              </p>
                              {props.showTags && article.tags && article.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {article.tags.slice(0, 2).map((tag, tagIndex) => (
                                    <span
                                      key={tagIndex}
                                      className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded-full"
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                  {article.tags.length > 2 && (
                                    <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded-full">
                                      +{article.tags.length - 2}
                                    </span>
                                  )}
                                </div>
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
          );
        })}
      </div>
    </div>
  );
}

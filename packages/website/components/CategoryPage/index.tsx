"use client";

import React, { useState } from "react";
import { CategorySummaryItem, getCategoryArticles } from "../../api/getArticles";
import SiteStatsSummary from "../SiteStatsSummary";
import { Article } from "../../types/article";
import ArticleList from "../ArticleList";

interface CategoryPageProps {
  summaries: CategorySummaryItem[];
  openArticleLinksInNewWindow: boolean;
  showTags?: boolean;
}

export default function CategoryPage(props: CategoryPageProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [articlesByCategory, setArticlesByCategory] = useState<Record<string, Article[]>>({});
  const [loadingCategories, setLoadingCategories] = useState<Set<string>>(new Set());

  const loadCategoryArticles = async (category: string) => {
    if (articlesByCategory[category] || loadingCategories.has(category)) {
      return;
    }

    setLoadingCategories((prev) => new Set(prev).add(category));
    try {
      const articles = await getCategoryArticles(category);
      setArticlesByCategory((prev) => ({
        ...prev,
        [category]: articles,
      }));
    } finally {
      setLoadingCategories((prev) => {
        const next = new Set(prev);
        next.delete(category);
        return next;
      });
    }
  };

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
      void loadCategoryArticles(category);
    }
    setExpandedCategories(newExpanded);
  };

  return (
    <div className="bg-white card-shadow dark:bg-dark dark:card-shadow-dark py-4 px-8 md:py-6 md:px-8">
      <div className="text-center mb-8">
        <h1 className="text-2xl md:text-3xl text-gray-700 dark:text-dark font-bold mb-4">
          分类
        </h1>
        <SiteStatsSummary
          className="text-center text-gray-600 text-sm font-light dark:text-dark mb-6"
        />
      </div>

      <div className="space-y-4">
        {props.summaries.map((summary) => {
          const category = summary.name;
          const isExpanded = expandedCategories.has(category);
          const isLoading = loadingCategories.has(category);
          const articles = articlesByCategory[category] || [];

          return (
            <div
              key={category}
              className="bg-white dark:bg-dark-1 border border-gray-200 dark:border-dark-2 rounded-lg overflow-hidden hover:shadow-md transition-all duration-300"
            >
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
                        {summary.articleCount} 篇文章
                      </p>
                    </div>
                  </div>
                  <button className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-dark-2 transition-colors duration-200">
                    <svg
                      className={`w-5 h-5 text-gray-500 dark:text-dark-400 transition-transform duration-300 ${
                        isExpanded ? "rotate-180" : ""
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

              <div className={`transition-all duration-300 ease-in-out ${isExpanded ? "max-h-[600px] opacity-100 overflow-y-auto" : "max-h-0 opacity-0"}`}>
                <div className="border-t border-gray-200 dark:border-dark-2">
                  <div className="p-4">
                    {isLoading ? (
                      <div className="text-sm text-gray-500 dark:text-dark-light">正在加载文章列表...</div>
                    ) : (
                      <ArticleList
                        articles={articles}
                        showYear={false}
                        openArticleLinksInNewWindow={props.openArticleLinksInNewWindow}
                        showTags={props.showTags}
                      />
                    )}
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

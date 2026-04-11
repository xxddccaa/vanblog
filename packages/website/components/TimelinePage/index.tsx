import React, { useState } from "react";
import { getTimelineArticlesByYear, TimelineSummaryItem } from "../../api/getArticles";
import SiteStatsSummary from "../SiteStatsSummary";
import { Article } from "../../types/article";
import ArticleList from "../ArticleList";

interface TimelinePageProps {
  summaries: TimelineSummaryItem[];
  openArticleLinksInNewWindow: boolean;
  pageTitle: string;
  defaultExpanded?: boolean;
}

export default function TimelinePage(props: TimelinePageProps) {
  const [expandedYears, setExpandedYears] = useState<Set<string>>(
    () => (props.defaultExpanded ? new Set(props.summaries.map((item) => item.year)) : new Set())
  );
  const [articlesByYear, setArticlesByYear] = useState<Record<string, Article[]>>({});
  const [loadingYears, setLoadingYears] = useState<Set<string>>(new Set());

  const loadYearArticles = async (year: string) => {
    if (articlesByYear[year] || loadingYears.has(year)) {
      return;
    }

    setLoadingYears((prev) => new Set(prev).add(year));
    try {
      const articles = await getTimelineArticlesByYear(year);
      setArticlesByYear((prev) => ({
        ...prev,
        [year]: articles,
      }));
    } finally {
      setLoadingYears((prev) => {
        const next = new Set(prev);
        next.delete(year);
        return next;
      });
    }
  };

  const toggleYear = (year: string) => {
    const nextExpanded = new Set(expandedYears);
    if (nextExpanded.has(year)) {
      nextExpanded.delete(year);
    } else {
      nextExpanded.add(year);
      void loadYearArticles(year);
    }
    setExpandedYears(nextExpanded);
  };

  return (
    <div className="bg-white card-shadow dark:bg-dark dark:card-shadow-dark py-4 px-8 md:py-6 md:px-8">
      <div className="text-center mb-8">
        <h1 className="text-2xl md:text-3xl text-gray-700 dark:text-dark font-bold mb-4">
          {props.pageTitle}
        </h1>
        <SiteStatsSummary
          className="text-center text-gray-600 text-sm font-light dark:text-dark mb-6"
        />
      </div>

      <div className="space-y-6">
        {props.summaries.map((summary, index) => {
          const year = summary.year;
          const isExpanded = expandedYears.has(year);
          const isLoading = loadingYears.has(year);
          const articles = articlesByYear[year] || [];

          return (
            <div key={year} className="relative">
              {index < props.summaries.length - 1 && (
                <div className="absolute left-6 top-12 w-0.5 h-full bg-gray-200 dark:bg-dark-2"></div>
              )}

              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 relative">
                  <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center shadow-lg">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-blue-500 rounded-full border-2 border-white dark:border-dark"></div>
                </div>

                <div className="flex-1 min-w-0">
                  <div
                    className="bg-white dark:bg-dark-1 border border-gray-200 dark:border-dark-2 rounded-lg overflow-hidden hover:shadow-md transition-all duration-300 cursor-pointer"
                    onClick={() => toggleYear(year)}
                  >
                    <div className="p-4 hover:bg-gray-50 dark:hover:bg-dark-2 transition-colors duration-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-dark">
                            {year}
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-dark-400">
                            {summary.articleCount} 篇文章
                          </p>
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
                              showTags={true}
                            />
                          )}
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

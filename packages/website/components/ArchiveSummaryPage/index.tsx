"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { ArchiveSummaryData } from "../../api/getArticles";
import { getTarget } from "../Link/tools";

export default function ArchiveSummaryPage(props: {
  title: string;
  description: string;
  summary: ArchiveSummaryData;
  basePath: string;
  openArticleLinksInNewWindow: boolean;
  selectedYear?: string;
}) {
  const years = useMemo(() => {
    if (!props.selectedYear) {
      return props.summary.years || [];
    }
    return (props.summary.years || []).filter((item) => item.year === props.selectedYear);
  }, [props.selectedYear, props.summary.years]);

  const totalArticles = years.reduce((sum, year) => sum + Number(year.articleCount || 0), 0);

  return (
    <div className="vb-surface-card card-shadow dark:card-shadow-dark py-4 px-8 md:py-6 md:px-8">
      <div className="text-center mb-8">
        <h1 className="text-2xl md:text-3xl text-gray-700 dark:text-dark font-bold mb-3">
          {props.title}
        </h1>
        <div className="text-center text-gray-600 text-sm font-light dark:text-dark mb-2">
          {props.description}
        </div>
        <div className="text-center text-gray-500 text-sm dark:text-dark-light">
          共 {totalArticles} 篇文章，按月份稳定归档
        </div>
      </div>

      <div className="space-y-6">
        {years.map((year) => (
          <section key={year.year} className="rounded-xl border border-gray-200 px-5 py-5 dark:border-dark-2">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-xl font-semibold text-gray-800 dark:text-dark">{year.year} 年</div>
                <div className="text-sm text-gray-500 dark:text-dark-light">{year.articleCount} 篇文章</div>
              </div>
              <Link
                href={`${props.basePath}/${year.year}`}
                target={getTarget(props.openArticleLinksInNewWindow)}
                className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                查看年份目录
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {year.months.map((month) => (
                <Link
                  key={`${year.year}-${month.month}`}
                  href={`${props.basePath}/${year.year}/${month.month}`}
                  target={getTarget(props.openArticleLinksInNewWindow)}
                  className="group rounded-lg border border-gray-200 px-4 py-3 transition hover:border-blue-400 hover:bg-blue-50 dark:border-dark-2 dark:hover:border-blue-400 dark:hover:bg-dark-1"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-base font-medium text-gray-700 group-hover:text-blue-700 dark:text-dark dark:group-hover:text-blue-300">
                        {year.year} / {month.month}
                      </div>
                      <div className="mt-1 text-sm text-gray-500 dark:text-dark-light">
                        {month.articleCount} 篇文章
                      </div>
                    </div>
                    <div className="text-gray-400 group-hover:text-blue-600 dark:text-dark-light dark:group-hover:text-blue-300">
                      ›
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

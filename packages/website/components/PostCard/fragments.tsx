import React, { useEffect, useState } from "react";
import { ArticleFragments, getArticleFragmentsByIdOrPathname } from "../../api/getArticles";
import ArticleList from "../ArticleList";

export default function PostFragments(props: {
  id: number | string;
  openArticleLinksInNewWindow: boolean;
}) {
  const [data, setData] = useState<ArticleFragments | null>(null);

  useEffect(() => {
    let active = true;

    void getArticleFragmentsByIdOrPathname(String(props.id), 4).then((result) => {
      if (active) {
        setData(result);
      }
    });

    return () => {
      active = false;
    };
  }, [props.id]);

  const sections = [
    { key: "related", title: "相关文章", articles: data?.related || [] },
    { key: "latest", title: "最新文章", articles: data?.latest || [] },
    { key: "hot", title: "热门文章", articles: data?.hot || [] },
  ].filter((section) => section.articles.length > 0);

  if (!data && sections.length === 0) {
    return (
      <div className="mt-6 border-t border-dashed border-gray-200 pt-4 text-sm text-gray-400 dark:border-dark-2 dark:text-dark-light">
        正在加载文章碎片...
      </div>
    );
  }

  if (!sections.length) {
    return null;
  }

  return (
    <div className="mt-6 border-t border-dashed border-gray-200 pt-4 dark:border-dark-2">
      <div className="mb-3 text-sm text-gray-500 dark:text-dark-light">
        当前文章评论数：{data?.commentCount ?? 0}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {sections.map((section) => (
          <div
            key={section.key}
            className="rounded border border-gray-200 px-3 py-3 dark:border-dark-2"
          >
            <div className="mb-3 text-sm font-semibold text-gray-700 dark:text-dark">
              {section.title}
            </div>
            <ArticleList
              articles={section.articles}
              showYear={false}
              openArticleLinksInNewWindow={props.openArticleLinksInNewWindow}
              showTags={false}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

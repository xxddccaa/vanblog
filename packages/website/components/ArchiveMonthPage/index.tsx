import React from "react";
import ArticleList from "../ArticleList";
import { Article } from "../../types/article";

export default function ArchiveMonthPage(props: {
  title: string;
  description: string;
  articles: Article[];
  openArticleLinksInNewWindow: boolean;
}) {
  return (
    <div className="bg-white card-shadow dark:bg-dark dark:card-shadow-dark py-4 px-8 md:py-6 md:px-8">
      <div className="text-center mb-6">
        <h1 className="text-2xl md:text-3xl text-gray-700 dark:text-dark font-bold mb-2">
          {props.title}
        </h1>
        <div className="text-center text-gray-600 text-sm font-light dark:text-dark mb-2">
          {props.description}
        </div>
        <div className="text-center text-gray-500 text-sm dark:text-dark-light">
          共 {props.articles.length} 篇文章
        </div>
      </div>

      <ArticleList
        articles={props.articles}
        showYear={false}
        openArticleLinksInNewWindow={props.openArticleLinksInNewWindow}
        showTags={true}
      />
    </div>
  );
}

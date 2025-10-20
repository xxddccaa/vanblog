import dayjs from "dayjs";
import Link from "next/link";

import { getTarget } from "../Link/tools";
import { type Article } from "../../types/article";
import { getArticlePath } from "../../utils/getArticlePath";

export default (props: {
  articles: Article[];
  showYear?: boolean;
  openArticleLinksInNewWindow: boolean;
  onClick?: () => void;
  showTags?: boolean;
}) => (
  <div className="space-y-2" onClick={props.onClick}>
    {props.articles.map((article) => (
      <Link
        href={`/post/${getArticlePath(article)}`}
        key={article.id}
        target={getTarget(props.openArticleLinksInNewWindow)}
      >
        <div className="dark:border-dark-2 dark:hover:border-nav-dark-light flex items-center border-b pb-1 border-dashed cursor-pointer group border-gray-200 hover:border-gray-400 ">
          <div className="text-gray-400 flex-grow-0 flex-shrink-0 text-sm  group-hover:text-gray-600 dark:text-dark-400 dark:group-hover:text-dark-light">
            {dayjs(article.createdAt).format("YYYY-MM-DD")}
          </div>
          <div className="ml-2 md:ml-4 text-base flex-grow flex-shrink overflow-hidden text-gray-600 group-hover:text-gray-800 dark:text-dark dark:group-hover:text-dark">
            {article.title}
          </div>
          {props.showTags && article.tags && article.tags.length > 0 && (
            <div className="ml-2 flex flex-wrap gap-1">
              {article.tags.slice(0, 3).map((tag, index) => (
                <span
                  key={index}
                  className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full"
                >
                  {tag}
                </span>
              ))}
              {article.tags.length > 3 && (
                <span className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full">
                  +{article.tags.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      </Link>
    ))}
  </div>
);

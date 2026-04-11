import React from "react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getArticleNavByIdOrPathname } from "../../api/getArticles";
import { getTarget } from "../Link/tools";
import { getArticlePath } from "../../utils/getArticlePath";

interface ArticleNavItem {
  id: number;
  title: string;
  pathname?: string;
}

export function PostBottom(props: {
  type: "overview" | "article" | "about";
  id: number | string;
  lock: boolean;
  tags?: string[];
  openArticleLinksInNewWindow: boolean;
}) {
  const [nav, setNav] = useState<{ pre?: ArticleNavItem; next?: ArticleNavItem }>({});

  const show = useMemo(() => {
    if (props.type == "article" && !props.lock) {
      return true;
    }
    return false;
  }, [props]);

  useEffect(() => {
    let active = true;

    if (!show) {
      setNav({});
      return;
    }

    void getArticleNavByIdOrPathname(String(props.id)).then((result) => {
      if (active) {
        setNav(result);
      }
    });

    return () => {
      active = false;
    };
  }, [props.id, show]);

  return show ? (
    <div className="mt-4">
      <div className="flex justify-between text-sm mt-2 whitespace-nowrap overflow-hidden ">
        <div className="" style={{ maxWidth: "50%" }}>
          {nav.pre?.id && (
            <Link
              href={`/post/${getArticlePath(nav.pre)}`}
              target={getTarget(props.openArticleLinksInNewWindow)}
            >
              <div
                style={{ whiteSpace: "break-spaces" }}
                className="dark:text-dark dark:border-dark dark-border-hover border-b pb border-dashed hover:border-gray-800 border-white hover:text-gray-800"
              >{`< ${nav.pre?.title}`}</div>
            </Link>
          )}
        </div>
        <div className="" style={{ maxWidth: "50%" }}>
          {nav.next?.id && (
            <Link
              href={`/post/${getArticlePath(nav.next)}`}
              target={getTarget(props.openArticleLinksInNewWindow)}
            >
              <div
                style={{ whiteSpace: "break-spaces" }}
                className="dark:text-dark dark:border-dark  dark-border-hover border-b pb border-dashed hover:border-gray-800 border-white hover:text-gray-800"
              >{`${nav.next?.title} >`}</div>
            </Link>
          )}
        </div>
      </div>
    </div>
  ) : null;
}

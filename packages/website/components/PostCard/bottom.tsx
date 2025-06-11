import Link from "next/link";
import { useMemo } from "react";
import { encodeQuerystring } from "../../utils/encode";
import { getTarget } from "../Link/tools";
import { getArticlePath } from "../../utils/getArticlePath";

export function PostBottom(props: {
  type: "overview" | "article" | "about";
  lock: boolean;
  tags?: string[];
  next?: { id: number; title: string; pathname?: string };
  pre?: { id: number; title: string; pathname?: string };
  openArticleLinksInNewWindow: boolean;
}) {
  const show = useMemo(() => {
    if (props.type == "article" && !props.lock) {
      return true;
    }
    return false;
  }, [props]);
  return show ? (
    <div className="mt-4">
      <div className="flex justify-between text-sm mt-2 whitespace-nowrap overflow-hidden ">
        <div className="" style={{ maxWidth: "50%" }}>
          {props.pre?.id && (
            <Link
              href={`/post/${getArticlePath(props.pre)}`}
              target={getTarget(props.openArticleLinksInNewWindow)}
            >
              <div
                style={{ whiteSpace: "break-spaces" }}
                className="dark:text-dark dark:border-dark dark-border-hover border-b pb border-dashed hover:border-gray-800 border-white hover:text-gray-800"
              >{`< ${props.pre?.title}`}</div>
            </Link>
          )}
        </div>
        <div className="" style={{ maxWidth: "50%" }}>
          {props.next?.id && (
            <Link
              href={`/post/${getArticlePath(props.next)}`}
              target={getTarget(props.openArticleLinksInNewWindow)}
            >
              <div
                style={{ whiteSpace: "break-spaces" }}
                className="dark:text-dark dark:border-dark  dark-border-hover border-b pb border-dashed hover:border-gray-800 border-white hover:text-gray-800"
              >{`${props.next?.title} >`}</div>
            </Link>
          )}
        </div>
      </div>
    </div>
  ) : null;
}

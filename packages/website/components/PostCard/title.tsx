import React from "react";
import dayjs from "dayjs";
import Link from "next/link";
import { useMemo } from "react";
import { encodeQuerystring } from "../../utils/encode";
import PostViewerStats from "../PostViewerStats";
import { getTarget } from "../Link/tools";
import { checkLogin } from "../../utils/auth";

export function Title(props: {
  type: "article" | "about" | "overview";
  id: number | string;
  title: string;
  openArticleLinksInNewWindow: boolean;
  showEditButton: boolean;
}) {
  const showEditButton = props.showEditButton && checkLogin();
  const newTab = useMemo(() => {
    if (props.type == "overview" && props.openArticleLinksInNewWindow) {
      return true;
    }
    return false;
  }, [props]);

  // 处理点击事件，允许文本选择
  const handleTitleClick = (e: React.MouseEvent) => {
    // 如果用户正在选择文本，阻止导航
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) {
      e.preventDefault();
      return;
    }
    
    // 如果是正在进行文本选择操作，也阻止导航
    if (e.detail > 1) { // 双击或多次点击
      e.preventDefault();
      return;
    }
  };

  return (
    <div className="flex justify-center post-card-title ">
      {props.type === "about" ? (
        <div
          className={`text-2xl md:text-3xl text-gray-700 text-center dark:text-dark font-bold mb-4 ${
            showEditButton ? "ml-12 mr-4" : ""
          }`}
        >
          {props.title}
        </div>
      ) : props.type === "article" ? (
        // 文章详情页：标题不应该是链接，直接显示为可选择文本
        <div style={{width:"90%"}} className="flex justify-center">
          <div
            className={`text-lg block font-medium whitespace-normal break-words select-text cursor-text px-5 text-center mb-2 mt-2 dark:text-dark text-gray-700 ${
              showEditButton ? "ml-8" : ""
            } md:text-2xl`}
          >
            {props.title}
          </div>
        </div>
      ) : (
        // 文章列表页：保持链接功能
        <Link href={`/post/${props.id}`} target={getTarget(newTab)} style={{width:"90%"}} title={props.title}>
          <div
            className={`text-lg block font-medium whitespace-normal break-words cursor-pointer px-5 text-center mb-2 mt-2 dark:text-dark text-gray-700 ${
              showEditButton ? "ml-8" : ""
            } md:text-xl ua ua-link`}
            onClick={handleTitleClick}
          >
            <span 
              className="cursor-text select-text"
              onMouseDown={(e) => e.stopPropagation()}
              onMouseUp={(e) => e.stopPropagation()}
            >
              {props.title}
            </span>
          </div>
        </Link>
      )}
      {showEditButton && (
        <a
          className="flex items-center"
          href={
            props.type === "about"
              ? "/admin/editor?type=about"
              : `/admin/editor?type=article&id=${props.id}`
          }
          target="_blank"
        >
          <div className=" text-dark dark:text-gray-700">
            <div>编辑</div>
          </div>
        </a>
      )}
    </div>
  );
}
export function SubTitle(props: {
  type: "article" | "about" | "overview";
  updatedAt: Date;
  createdAt: Date;
  catelog: string;
  enableComment: "true" | "false";
  id: number | string;
  openArticleLinksInNewWindow: boolean;
}) {
  const iconSize = "16";
  const iconClass =
    "mr-1 fill-gray-400 dark:text-dark dark:group-hover:text-dark-hover group-hover:text-gray-900 ";
  const showDynamicFragments = props.type === "article";
  return (
    <div className="text-center text-xs md:text-sm divide-x divide-gray-400 text-gray-400 dark:text-dark post-card-sub-title">
      <span className="inline-flex px-2 items-center">
        <span className={iconClass}>
          <svg
            viewBox="0 0 1024 1024"
            version="1.1"
            xmlns="http://www.w3.org/2000/svg"
            p-id="11557"
            width={iconSize}
            height={iconSize}
          >
            <path
              d="M853.333333 501.333333c-17.066667 0-32 14.933333-32 32v320c0 6.4-4.266667 10.666667-10.666666 10.666667H170.666667c-6.4 0-10.666667-4.266667-10.666667-10.666667V213.333333c0-6.4 4.266667-10.666667 10.666667-10.666666h320c17.066667 0 32-14.933333 32-32s-14.933333-32-32-32H170.666667c-40.533333 0-74.666667 34.133333-74.666667 74.666666v640c0 40.533333 34.133333 74.666667 74.666667 74.666667h640c40.533333 0 74.666667-34.133333 74.666666-74.666667V533.333333c0-17.066667-14.933333-32-32-32z"
              p-id="11558"
            ></path>
            <path
              d="M405.333333 484.266667l-32 125.866666c-2.133333 10.666667 0 23.466667 8.533334 29.866667 6.4 6.4 14.933333 8.533333 23.466666 8.533333h8.533334l125.866666-32c6.4-2.133333 10.666667-4.266667 14.933334-8.533333l300.8-300.8c38.4-38.4 38.4-102.4 0-140.8-38.4-38.4-102.4-38.4-140.8 0L413.866667 469.333333c-4.266667 4.266667-6.4 8.533333-8.533334 14.933334z m59.733334 23.466666L761.6 213.333333c12.8-12.8 36.266667-12.8 49.066667 0 12.8 12.8 12.8 36.266667 0 49.066667L516.266667 558.933333l-66.133334 17.066667 14.933334-68.266667z"
              p-id="11559"
            ></path>
          </svg>
        </span>
        {props.type != "about"
          ? `${dayjs(props.createdAt).format("YYYY-MM-DD")}`
          : ` ${dayjs(props.updatedAt).format("YYYY-MM-DD")}`}
      </span>

      {props.type != "about" && (
        <span className="inline-flex px-2 items-center group dark:group cursor-pointer">
          <span className={iconClass}>
            <svg
              viewBox="0 0 1024 1024"
              version="1.1"
              xmlns="http://www.w3.org/2000/svg"
              p-id="12516"
              fill="currentColor"
              width={iconSize}
              height={iconSize}
            >
              <path
                d="M810.666667 85.333333a85.333333 85.333333 0 0 1 85.333333 85.333334v152.021333c36.821333 9.493333 64 42.88 64 82.645333v405.333334a128 128 0 0 1-128 128H192a128 128 0 0 1-128-128V298.666667a85.376 85.376 0 0 1 64-82.645334V170.666667a85.333333 85.333333 0 0 1 85.333333-85.333334h597.333334zM128.149333 296.170667L128 298.666667v512a64 64 0 0 0 60.245333 63.893333L192 874.666667h640a64 64 0 0 0 63.893333-60.245334L896 810.666667V405.333333a21.333333 21.333333 0 0 0-18.837333-21.184L874.666667 384H638.165333l-122.069333-101.717333a21.333333 21.333333 0 0 0-10.688-4.736l-2.986667-0.213334H149.333333a21.333333 21.333333 0 0 0-21.184 18.837334zM535.189333 213.333333l127.978667 106.666667H832V170.666667a21.333333 21.333333 0 0 0-18.837333-21.184L810.666667 149.333333H213.333333a21.333333 21.333333 0 0 0-21.184 18.837334L192 170.666667v42.666666h343.168z"
                p-id="12517"
              ></path>
            </svg>
          </span>
          <Link
            href={`/category/${encodeQuerystring(props.catelog)}`}
            target={getTarget(props.openArticleLinksInNewWindow)}
          >
            <div className="cursor-pointer group-hover:text-gray-900 dark:group-hover:text-dark-hover hover:font-medium ">{`${props.catelog}`}</div>
          </Link>
        </span>
      )}
      {showDynamicFragments && (
        <PostViewerStats
          shouldAddViewer={true}
          id={props.id}
          iconSize={iconSize}
          iconClass={iconClass}
          showCommentCount={props.enableComment != "false"}
        />
      )}
    </div>
  );
}

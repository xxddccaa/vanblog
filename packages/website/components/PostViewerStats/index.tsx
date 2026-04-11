import React, { useCallback, useEffect, useRef, useState } from "react";
import { getArticleEngagementByIdOrPathname } from "../../api/getArticles";

export default function PostViewerStats(props: {
  shouldAddViewer: boolean;
  id: number | string;
  iconSize?: string;
  iconClass?: string;
  showCommentCount?: boolean;
}) {
  const [viewer, setViewer] = useState(0);
  const [visited, setVisited] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const { current } = useRef({ hasInit: false });

  const iconSize = props.iconSize || "16";
  const iconClass =
    props.iconClass ||
    "mr-1 fill-gray-400 dark:text-dark dark:group-hover:text-dark-hover group-hover:text-gray-900";

  const fetchViewer = useCallback(async () => {
    const res = await getArticleEngagementByIdOrPathname(String(props.id));
    if (!res) {
      if (localStorage?.getItem("noViewer") === "true") {
        setViewer(0);
        setVisited(0);
        setCommentCount(0);
        return;
      }
      if (props.shouldAddViewer) {
        setViewer(1);
        setVisited(1);
      } else {
        setViewer(0);
        setVisited(0);
      }
      setCommentCount(0);
      return;
    }

    const currentViewer = res.viewer || 0;
    const currentVisited = res.visited || 0;
    const currentCommentCount = res.commentCount || 0;

    if (localStorage?.getItem("noViewer") === "true") {
      setViewer(currentViewer);
      setVisited(currentVisited);
      setCommentCount(currentCommentCount);
      return;
    }

    if (props.shouldAddViewer) {
      setViewer(currentViewer + 1);
      setVisited(currentVisited + 1);
    } else {
      setViewer(currentViewer);
      setVisited(currentVisited);
    }
    setCommentCount(currentCommentCount);
  }, [props]);

  useEffect(() => {
    if (!current.hasInit) {
      current.hasInit = true;
      void fetchViewer();
    }
  }, [fetchViewer, current]);

  return (
    <>
      <span className="inline-flex px-2 items-center">
        <span className={iconClass}>
          <svg
            viewBox="0 0 1024 1024"
            version="1.1"
            xmlns="http://www.w3.org/2000/svg"
            p-id="7211"
            width={iconSize}
            height={iconSize}
          >
            <path
              d="M565.2 521.9c76.2-23 132.1-97.6 132.1-186.2 0-106.9-81.3-193.5-181.6-193.5s-181.6 86.6-181.6 193.5c0 87.6 54.6 161.6 129.5 185.4-142.2 23.1-250.8 146.5-250.8 295.3 0 2.9 0 5.8 0.1 8.7 0.9 31.5 26.5 56.7 58.1 56.7h482.1c31.2 0 57-24.6 58-55.8 0.1-3.2 0.2-6.4 0.2-9.6-0.1-147.1-106.2-269.4-246.1-294.5z"
              p-id="7212"
            ></path>
          </svg>
        </span>
        <span>{visited}</span>
      </span>

      <span className="inline-flex px-2 items-center">
        <span className={iconClass}>
          <svg
            viewBox="0 0 1024 1024"
            version="1.1"
            xmlns="http://www.w3.org/2000/svg"
            p-id="15825"
            width={iconSize}
            height={iconSize}
          >
            <path
              d="M942.2 486.2C847.4 286.5 704.1 186 512 186c-192.2 0-335.4 100.5-430.2 300.3-7.7 16.2-7.7 35.2 0 51.5C176.6 737.5 319.9 838 512 838c192.2 0 335.4-100.5 430.2-300.3 7.7-16.2 7.7-35 0-51.5zM512 766c-161.3 0-279.4-81.8-362.7-254C232.6 339.8 350.7 258 512 258c161.3 0 279.4 81.8 362.7 254C791.5 684.2 673.4 766 512 766z"
              p-id="15826"
            ></path>
            <path
              d="M508 336c-97.2 0-176 78.8-176 176s78.8 176 176 176 176-78.8 176-176-78-176-176-176z m0 288c-61.9 0-112-50.1-112-112s50.1-112 112-112 112 50.1 112 112-50.1 112-112 112z"
              p-id="15827"
            ></path>
          </svg>
        </span>
        <span>{viewer}</span>
      </span>

      {props.showCommentCount && (
        <span className="inline-flex px-2 items-center">
          <span className={iconClass}>
            <svg
              viewBox="0 0 1024 1024"
              version="1.1"
              xmlns="http://www.w3.org/2000/svg"
              p-id="13953"
              width={iconSize}
              height={iconSize}
            >
              <path
                d="M873.559 97.82h-723.12c-45.886 0-83.436 37.627-83.436 83.611v542.098c0 45.984 37.55 69.685 83.437 69.685h333.747c45.888 0 109.987 34.242 142.43 66.767l48.888 52.12c12.589 12.615 24.309 20.262 33.91 20.262 15.143 0 25.083-20.55 25.083-48.675 0-45.983 37.548-90.474 83.436-90.474h55.625c45.887 0 83.438-23.701 83.438-69.685V181.431c0-45.984-37.55-83.61-83.438-83.61z m27.813 625.71c0 15.105-12.738 15.307-27.813 15.307h-55.625c-61.382 0-113.612 46.353-132 101.74l-19.989-23.15c-42.914-43.016-121.055-78.59-181.758-78.59H150.44c-15.074 0-27.813-0.204-27.813-15.308V181.431c0-15.106 12.739-27.87 27.813-27.87h723.119c15.075 0 27.813 12.766 27.813 27.87v542.098zM261.689 348.652h278.124c15.358 0 27.812-12.48 27.812-27.87s-12.454-27.87-27.812-27.87H261.689c-15.357 0-27.812 12.48-27.812 27.87s12.455 27.87 27.812 27.87z m472.81 83.613H261.69c-15.357 0-27.812 12.48-27.812 27.87s12.455 27.871 27.812 27.871H734.5c15.357 0 27.812-12.48 27.812-27.87 0-15.392-12.455-27.87-27.812-27.87z m0 111.48H261.69c-15.357 0-27.812 12.48-27.812 27.87s12.455 27.871 27.812 27.871H734.5c15.357 0 27.812-12.48 27.812-27.87s-12.455-27.87-27.812-27.87z"
                p-id="13954"
              ></path>
            </svg>
          </span>
          <span>{commentCount}</span>
        </span>
      )}
    </>
  );
}

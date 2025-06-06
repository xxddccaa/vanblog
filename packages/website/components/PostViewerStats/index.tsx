import { useCallback, useEffect, useRef, useState } from "react";
import { getArticleViewer } from "../../api/getArticleViewer";

export default function PostViewerStats(props: {
  shouldAddViewer: boolean;
  id: number | string;
  iconSize?: string;
  iconClass?: string;
}) {
  const [viewer, setViewer] = useState(0);
  const [visited, setVisited] = useState(0);
  const { current } = useRef({ hasInit: false });
  
  const iconSize = props.iconSize || "16";
  const iconClass = props.iconClass || "mr-1 fill-gray-400 dark:text-dark dark:group-hover:text-dark-hover group-hover:text-gray-900";
  
  const fetchViewer = useCallback(async () => {
    const res = await getArticleViewer(props.id);
    if (!res) {
      if (localStorage?.getItem("noViewer") === "true") {
        setViewer(0);
        setVisited(0);
        return;
      }
      if (props.shouldAddViewer) {
        setViewer(1);
        setVisited(1);
      } else {
        setViewer(0);
        setVisited(0);
      }
    }
    if (res) {
      const currentViewer = res.viewer || 0;
      const currentVisited = res.visited || 0;
      
      if (localStorage?.getItem("noViewer") === "true") {
        setViewer(currentViewer);
        setVisited(currentVisited);
        return;
      }
      
      if (props.shouldAddViewer) {
        setViewer(currentViewer + 1);
        setVisited(currentVisited + 1);
      } else {
        setViewer(currentViewer);
        setVisited(currentVisited);
      }
    }
  }, [setViewer, setVisited, props]);
  
  useEffect(() => {
    if (!current.hasInit) {
      current.hasInit = true;
      fetchViewer();
    }
  }, [fetchViewer, current]);

  return (
    <>
      {/* 访客数 */}
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
      
      {/* 访问量 */}
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
    </>
  );
} 
import { useCallback, useEffect, useRef, useState } from "react";
import { getArticleViewer } from "../../api/getArticleViewer";

export default function (props: {
  shouldAddViewer: boolean;
  id: number | string;
  showVisited?: boolean;
}) {
  const [viewer, setViewer] = useState(0);
  const [visited, setVisited] = useState(0);
  const { current } = useRef({ hasInit: false });
  
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

  if (props.showVisited) {
    return <span>{visited}</span>;
  }
  return <span>{viewer}</span>;
}

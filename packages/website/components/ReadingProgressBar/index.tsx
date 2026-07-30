'use client';

import React, { useEffect, useRef } from 'react';
import styles from '../../styles/reading-progress.module.css';

// 顶部阅读进度条：滚动计算方式与 Butterfly 主题一致
// （scrollTop / (文档高度 - 视口高度)），用 rAF 节流避免高频 scroll 回调掉帧。
export default function ReadingProgressBar() {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let ticking = false;

    const update = () => {
      ticking = false;
      const el = document.documentElement;
      const max = el.scrollHeight - el.clientHeight;
      const percent =
        max > 0 ? Math.min(100, Math.max(0, (window.scrollY / max) * 100)) : 0;
      if (barRef.current) {
        barRef.current.style.width = `${percent}%`;
      }
    };

    const requestUpdate = () => {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    };

    update();
    // 用 document 捕获阶段监听：视口滚动事件的 target 是 document，
    // 捕获阶段最先收到，不受页面上其他监听器 stopPropagation 的影响。
    document.addEventListener('scroll', requestUpdate, {
      passive: true,
      capture: true,
    });
    window.addEventListener('resize', requestUpdate, { passive: true });
    return () => {
      document.removeEventListener('scroll', requestUpdate, { capture: true });
      window.removeEventListener('resize', requestUpdate);
    };
  }, []);

  return (
    <div className={styles.track} aria-hidden="true">
      <div ref={barRef} className={styles.bar} />
    </div>
  );
}

import { decode } from "js-base64";
import Head from "next/head";
import Script from "next/script";
import { createElement } from "react";

import { type HeadTag } from "../../utils/getLayoutProps";

const buildResponsiveCustomScript = (script: string) => {
  const serializedScript = JSON.stringify(script);

  return `
(() => {
  const rawScript = ${serializedScript};

  const shouldReduceHeavyEffects = () => {
    try {
      const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
      const coarsePointer = window.matchMedia?.('(pointer: coarse)')?.matches;
      const noHover = window.matchMedia?.('(hover: none)')?.matches;
      const hasTouchPoints = (navigator.maxTouchPoints || 0) > 0;
      const isMobileViewport = window.innerWidth <= 768;
      const isMobileUserAgent = /Android|iPhone|iPad|iPod|Mobile/i.test(
        navigator.userAgent || ''
      );

      return Boolean(
        reduceMotion ||
        coarsePointer ||
        noHover ||
        hasTouchPoints ||
        isMobileViewport ||
        isMobileUserAgent
      );
    } catch (error) {
      return false;
    }
  };

  const stripSection = (source, startMarker, endMarker) => {
    const start = source.indexOf(startMarker);
    if (start === -1) {
      return source;
    }

    const end = source.indexOf(endMarker, start);
    if (end === -1) {
      return source;
    }

    return source.slice(0, start) + '\\n' + source.slice(end + endMarker.length);
  };

  const stripMotionClassSection = (source, className, endMarker) => {
    const anchor = source.indexOf(className);
    if (anchor === -1) {
      return source;
    }

    const helperStart = source.lastIndexOf(
      'const shouldDisableVanblogMotionEffects = () => {',
      anchor
    );
    const start = helperStart === -1 ? anchor : helperStart;
    const end = source.indexOf(endMarker, anchor);

    if (end === -1) {
      return source;
    }

    return source.slice(0, start) + '\\n' + source.slice(end + endMarker.length);
  };

  const stripMobileHeavyEffects = (source) => {
    let nextSource = source;

    nextSource = stripSection(
      nextSource,
      '// Canvas-nest.js 粒子连线动画 - 修复版本',
      'window.CANVAS_NEST_CLEANUP = cleanup;\\n})();'
    );
    nextSource = stripSection(
      nextSource,
      '// 心形点击爆炸效果系统 - 增强版粒子爆炸',
      '})(window, document);'
    );
    nextSource = stripMotionClassSection(
      nextSource,
      'class SnowflakeSystem {',
      "document.addEventListener('visibilitychange', () => {\\n    if (snowSystem) {\\n      document.hidden ? snowSystem.stop() : snowSystem.start();\\n    }\\n  });\\n}"
    );
    nextSource = stripMotionClassSection(
      nextSource,
      'class MouseDragSystem {',
      "window.mouseDragSystem = new MouseDragSystem();\\n  });\\n  }"
    );

    return nextSource;
  };

  const executableScript = shouldReduceHeavyEffects()
    ? stripMobileHeavyEffects(rawScript)
    : rawScript;

  if (executableScript.trim()) {
    (0, eval)(executableScript);
  }
})();
`;
};

export default function (props: {
  customCss?: string;
  customHtml?: string;
  customScript?: string;
  customHead?: HeadTag[];
}) {
  const renderHeadTags = () => {
    if (props.customHead?.length) {
      return (
        <>
          {props.customHead.map(({ content, props, name }, index) =>
            createElement(name, { ...props, key: `head-tag-${index}` }, content)
          )}
        </>
      );
    }

    return <></>;
  };

  return (
    <>
      <Head>
        {props.customCss ? <style>{decode(props.customCss)}</style> : null}
        {renderHeadTags()}
      </Head>
      {props.customHtml ? (
        <div
          dangerouslySetInnerHTML={{ __html: decode(props.customHtml) }}
        ></div>
      ) : null}
      {props.customScript ? (
        <Script strategy="beforeInteractive">
          {buildResponsiveCustomScript(decode(props.customScript))}
        </Script>
      ) : null}
    </>
  );
}

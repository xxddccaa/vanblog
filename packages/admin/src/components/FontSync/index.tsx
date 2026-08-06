import { useEffect } from 'react';
import { getFontSetting } from '@/services/van-blog/api';
import { buildScopedFontCss, getPresetHrefs, type AdminFontSetting } from '@/utils/fontInject';

// 编辑器预览容器（ByteMD Editor/Viewer、DocumentViewer、milkdown 预览）最终都渲染 .markdown-body，
// 所以后台字体只需作用于 .markdown-body（预览即正文渲染，与前台 scope 无关）。
const PREVIEW_SELECTOR = 'html .markdown-body';
const LINK_ATTR = 'data-vanblog-admin-font-link';
const STYLE_ATTR = 'data-vanblog-admin-font-style';

const clearInjected = () => {
  document.head
    .querySelectorAll(`link[${LINK_ATTR}], style[${STYLE_ATTR}]`)
    .forEach((el) => el.remove());
};

const syncFont = (font: AdminFontSetting) => {
  if (typeof document === 'undefined') return;
  clearInjected();
  if (!font || font.mode === 'off') return;

  // 预设字体表 <link>（system 不产生 href）
  for (const href of getPresetHrefs(font)) {
    const link = document.createElement('link');
    link.setAttribute('rel', 'stylesheet');
    link.setAttribute('href', href);
    link.setAttribute(LINK_ATTR, 'true');
    document.head.appendChild(link);
  }

  // @font-face(custom) + font-family 规则 + 表单控件还原，作用于 .markdown-body
  const css = buildScopedFontCss(font, PREVIEW_SELECTOR);
  if (css) {
    const style = document.createElement('style');
    style.setAttribute(STYLE_ATTR, 'true');
    style.textContent = css;
    document.head.appendChild(style);
  }
};

// 全局字体同步器：进后台时拉一次字体设置，把与前台一致的字体注入到编辑器 markdown 预览。
// 挂在 app.jsx 的 childrenRender，与 ThemeSync 等并列。渲染 null。
export default function FontSync() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getFontSetting();
        if (cancelled) return;
        syncFont((res?.data || {}) as AdminFontSetting);
      } catch (err) {
        // 拉取失败不影响后台其余功能，静默即可
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}

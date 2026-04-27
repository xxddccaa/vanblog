import React from "react";
import type { ArticleWidthMode } from "../../utils/getLayoutProps";

const MAIN_WIDTH_CLASS_MAP: Record<ArticleWidthMode, string> = {
  standard: "md:max-w-3xl xl:max-w-4xl",
  wide: "md:max-w-4xl xl:max-w-5xl",
  ultraWide: "md:max-w-4xl xl:max-w-6xl",
  full: "max-w-none",
};

export default function (props: {
  children: any;
  sideBar: any;
  contentWidthMode?: ArticleWidthMode;
}) {
  const hasSidebar = Boolean(props.sideBar);
  const mainWidthClass = MAIN_WIDTH_CLASS_MAP[props.contentWidthMode || "standard"];
  const widthModeClass = `vanblog-width-mode-${props.contentWidthMode || "standard"}`;
  const sidebarClass = hasSidebar ? "vanblog-main-has-sidebar" : "vanblog-main-no-sidebar";

  return (
    <>
      <div className="flex mx-auto justify-center">
        <main
          id="main-content"
          className={`flex-shrink flex-grow w-full vanblog-main ${mainWidthClass} ${widthModeClass} ${sidebarClass}`}
        >
          {props.children}
        </main>
        <aside
          className={`hidden lg:block flex-shrink-0 flex-grow-0 vanblog-sider ${hasSidebar ? "w-52" : ""}`}
        >
          {props.sideBar}
        </aside>
      </div>
    </>
  );
}

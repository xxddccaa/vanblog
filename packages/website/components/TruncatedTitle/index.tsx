"use client";
import { useContext, useMemo, useState } from "react";
import { Popover, ArrowContainer } from "react-tiny-popover";
import { ThemeContext } from "../../utils/themeContext";

// 单行省略的标题：仅当文本被截断时，悬停浮出完整标题气泡。
// 气泡通过 react-tiny-popover 挂到 body（portal），不会被外层卡片的 overflow-hidden 裁剪。
export default function TruncatedTitle(props: { title: string }) {
  const { theme } = useContext(ThemeContext);
  const [open, setOpen] = useState(false);

  const arrowColor = useMemo(
    () => (theme.includes("dark") ? "#1a1d21" : "white"),
    [theme],
  );

  return (
    <Popover
      isOpen={open}
      onClickOutside={() => setOpen(false)}
      positions={["top", "bottom"]}
      padding={6}
      content={({ position, childRect, popoverRect }) => (
        <ArrowContainer
          position={position}
          childRect={childRect}
          popoverRect={popoverRect}
          arrowColor={arrowColor}
          arrowSize={8}
          arrowStyle={{ opacity: 0.9 }}
          className=" "
          arrowClassName="popover-arrow "
        >
          <div
            className="card-shadow vb-surface-card-deep dark:card-shadow-dark pointer-events-none rounded-lg px-3 py-2 text-sm break-words text-gray-700 dark:text-dark"
            style={{ maxWidth: 320 }}
          >
            {props.title}
          </div>
        </ArrowContainer>
      )}
    >
      <span
        className="block w-full truncate"
        onMouseEnter={(e) => {
          const el = e.currentTarget;
          // 只有真的被省略（内容宽度超出可视宽度）才弹气泡
          if (el.scrollWidth > el.clientWidth) {
            setOpen(true);
          }
        }}
        onMouseLeave={() => setOpen(false)}
      >
        {props.title}
      </span>
    </Popover>
  );
}

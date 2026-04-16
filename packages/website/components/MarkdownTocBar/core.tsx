import { useEffect, useMemo, useRef, useState } from "react";
import throttle from "lodash/throttle";
import { getEl, NavItem } from "./tools";
import { scrollTo } from "../../utils/scroll";
export default function (props: {
  items: NavItem[];
  headingOffset: number;
  mobile?: boolean;
}) {
  const { items } = props;
  const [currIndex, setCurrIndex] = useState(-1);
  const currIndexRef = useRef(-1);

  const updateHash = (hash: string) => {
    if (hash) {
      window.history.replaceState(null, "", `#${hash}`);
    }
  };

  const handleScroll = useMemo(
    () =>
      throttle(() => {
        if (!items.length) {
          return;
        }

        const scrollTop =
          window.pageYOffset ||
          document.documentElement.scrollTop ||
          document.body.scrollTop ||
          0;

        let top = items[0];
        let lastMin = Number.POSITIVE_INFINITY;

        for (const each of items) {
          const el: any = getEl(each, items);
          if (!el) {
            continue;
          }

          const distance = Math.abs(scrollTop + props.headingOffset - el.offsetTop);
          if (distance <= lastMin) {
            lastMin = distance;
            top = each;
          }
        }

        if (currIndexRef.current !== top.index) {
          currIndexRef.current = top.index;
          setCurrIndex(top.index);

          if (!props.mobile) {
            updateHash(top.text);
          }
        }
      }, props.mobile ? 180 : 120),
    [items, props.headingOffset, props.mobile]
  );

  
  useEffect(() => {
    updateTocScrollbar();
  }, [currIndex, props.headingOffset]);

  const updateTocScrollbar = () => {
    const el = document.querySelector(
      "#toc-container > div > div.markdown-navigation > div.active"
    ) as HTMLElement;

    const container = document.querySelector("#toc-container");
    if (el && container) {
      let to = (el as any)?.offsetTop;
      if (to <= props.headingOffset) {
        to = 0;
      } else {
        to = to - 100;
      }
      scrollTo(container, {
        top: to,
        behavior: "smooth",
      });
    }
    // console.log(el?.offsetTop);
  };

  //TODO 逻辑完善的 hash 更新
  useEffect(() => {
    const shouldTrackScroll =
      props.mobile || window.matchMedia("(min-width: 1024px)").matches;

    if (!shouldTrackScroll) {
      return;
    }

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      handleScroll.cancel();
    };
  }, [handleScroll]);
  const res = [];
  for (const each of items) {
    const cls = `title-anchor title-level${each.level} ${
      currIndex == each.index ? "active" : ""
    }`;
    res.push(
      <div
        key={each.index}
        className={cls}
        onClick={() => {
          const el: any = getEl(each, items);

          if (el) {
            let to = el.offsetTop - props.headingOffset;
            if (to <= 100) {
              to = 0;
            }
            scrollTo(window, { top: to, easing: "ease-in-out", duration: 800 });
          }
        }}
      >
        {each.text}
      </div>
    );
  }

  return (
    <>
      <div className="relative" style={{ position: "relative" }}>
        {props.mobile ? (
          <>
            <h2
              style={{ fontWeight: 600, fontSize: "1.5em", marginBottom: 4 }}
              className="text-gray-700 dark:text-dark "
            >
              目录
            </h2>
          </>
        ) : (
          <div
            className="text-center text-lg font-medium mt-4 text-gray-700 dark:text-dark cursor-pointer"
            onClick={() => {
              scrollTo(window, {
                top: 0,
                easing: "ease-in-out",
                duration: 800,
              });
            }}
          >
            目录
          </div>
        )}

        <div className="markdown-navigation" style={{ position: "relative" }}>
          {res}
        </div>
        <div style={{ marginBottom: 10, marginTop: -2 }} />
      </div>
    </>
  );
}

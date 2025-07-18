import Link from "next/link";
import Headroom from "headroom.js";
import { useContext, useEffect, useMemo, useState } from "react";
import SearchCard from "../SearchCard";
import ThemeButton from "../ThemeButton";
import KeyCard from "../KeyCard";
import { MenuItem } from "../../api/getAllData";
import AdminButton from "../AdminButton";
import { ThemeContext } from "../../utils/themeContext";
import RssButton from "../RssButton";
import Item from "./item";
import { encodeQuerystring } from "../../utils/encode";
import { useRouter } from "next/router";

export default function (props: {
  logo: string;
  logoDark: string;
  categories: string[];
  setOpen: (open: boolean) => void;
  isOpen: boolean;
  siteName: string;
  menus: MenuItem[];
  showSubMenu: "true" | "false";
  showAdminButton: "true" | "false";
  showFriends: "true" | "false";
  showRSS: "true" | "false";
  headerLeftContent: "siteName" | "siteLogo";
  defaultTheme: "dark" | "auto" | "light";
  subMenuOffset: number;
  openArticleLinksInNewWindow: boolean;
}) {
  const [showSearch, setShowSearch] = useState(false);
  const [headroom, setHeadroom] = useState<Headroom>();
  const { theme } = useContext(ThemeContext);
  const router = useRouter();

  // Check if we're on the nav page
  const isNavPage = useMemo(() => {
    return router.pathname === '/nav';
  }, [router.pathname]);

  // If we're on the nav page and 'nav' is not in the menus, add it temporarily
  const displayMenus = useMemo(() => {
    if (isNavPage && !props.menus.some(menu => menu.value === '/nav')) {
      // console.log('Adding nav menu item for display');
      const menusCopy = [...props.menus];
      // Add nav item before 'about' if it exists
      const aboutIndex = menusCopy.findIndex(menu => menu.value === '/about');
      const insertIndex = aboutIndex !== -1 ? aboutIndex : menusCopy.length;
      
      menusCopy.splice(insertIndex, 0, {
        id: Date.now(),
        name: '导航',
        value: '/nav',
        level: 0
      });
      return menusCopy;
    }
    return props.menus;
  }, [props.menus, isNavPage]);

  const picUrl = useMemo(() => {
    if (theme.includes("dark") && props.logoDark && props.logoDark != "") {
      return props.logoDark;
    }
    return props.logo;
  }, [theme, props]);
  useEffect(() => {
    const el = document.querySelector("#nav");
    if (el && !headroom) {
      const newHeadroom = new Headroom(el);
      newHeadroom.init();
      setHeadroom(newHeadroom);
    }
    return () => {
      if (headroom) {
        headroom.destroy();
        setHeadroom(undefined);
      }
    };
  }, []);
  
  // Ensure headroom is properly reinitialized when component updates
  useEffect(() => {
    if (headroom) {
      headroom.destroy();
      const el = document.querySelector("#nav");
      if (el) {
        const newHeadroom = new Headroom(el);
        newHeadroom.init();
        setHeadroom(newHeadroom);
      }
    }
  }, [props.isOpen]);

  return (
    <>
      <SearchCard
        openArticleLinksInNewWindow={props.openArticleLinksInNewWindow}
        visible={showSearch}
        setVisible={setShowSearch}
      ></SearchCard>
      <div
        id="nav"
        className=" bg-white sticky top-0 dark:bg-dark nav-shadow dark:nav-shadow-dark"
        style={{ zIndex: 90 }}
      >
        {/* 上面的导航栏 */}
        <div
          className=" flex  items-center w-full border-b border-gray-200 h-14 dark:border-nav-dark"
          style={{ height: 56 }}
        >
          <div className="mx-4 flex items-center">
            <div
              className="cursor-pointer block md:hidden"
              onClick={() => {
                if (!props.isOpen) {
                  // 要打开
                  headroom?.pin();
                }
                props.setOpen(!props.isOpen);
              }}
            >
              <span>
                <svg
                  viewBox="0 0 1024 1024"
                  version="1.1"
                  xmlns="http://www.w3.org/2000/svg"
                  p-id="1340"
                  width="24"
                  height="24"
                  className="dark:text-dark fill-gray-600"
                >
                  <path
                    d="M904 160H120c-4.4 0-8 3.6-8 8v64c0 4.4 3.6 8 8 8h784c4.4 0 8-3.6 8-8v-64c0-4.4-3.6-8-8-8zM904 784H120c-4.4 0-8 3.6-8 8v64c0 4.4 3.6 8 8 8h784c4.4 0 8-3.6 8-8v-64c0-4.4-3.6-8-8-8zM904 472H120c-4.4 0-8 3.6-8 8v64c0 4.4 3.6 8 8 8h784c4.4 0 8-3.6 8-8v-64c0-4.4-3.6-8-8-8z"
                    p-id="1341"
                  ></path>
                </svg>
              </span>
            </div>
            {props.headerLeftContent == "siteLogo" && (
              <div className="hidden md:block transform translate-x-2">
                <img
                  alt="site logo"
                  src={picUrl}
                  width={52}
                  height={52}
                  className=""
                />
              </div>
            )}
          </div>
          {props.headerLeftContent == "siteName" && (
            <Link href="/">
              <div className="text-gray-800 cursor-pointer select-none text-lg dark:text-dark lg:text-xl font-medium  mr-4 hidden md:block">
                {props.siteName}
              </div>
            </Link>
          )}
          {/* 第二个flex */}
          <div className="flex justify-between h-full flex-grow nav-content">
            <div
              style={{ transform: "translateX(30px)" }}
              className="cursor-pointer md:hidden  flex-grow text-center  flex items-center justify-center select-none dark:text-dark"
            >
              <Link href="/">
                <div>{props.siteName}</div>
              </Link>
            </div>
            <ul className=" md:flex h-full items-center  text-sm text-gray-600 dark:text-dark hidden">
              {displayMenus.map((m) => {
                return <Item key={m.id} item={m} />;
              })}
            </ul>
            <div className="flex nav-action">
              <div
                onClick={() => {
                  setShowSearch(true);
                  document.body.style.overflow = "hidden";
                }}
                title="搜索"
                className="flex group transform hover:scale-110 transition-all select-none cursor-pointer"
              >
                <div className="flex items-center mr-0 sm:mr-2 hover:cursor-pointer   transition-all dark:text-dark fill-gray-600">
                  <svg
                    viewBox="0 0 1024 1024"
                    version="1.1"
                    xmlns="http://www.w3.org/2000/svg"
                    p-id="2305"
                    width="20"
                    height="20"
                  >
                    <path
                      d="M789.804097 737.772047 742.865042 784.699846 898.765741 940.600545 945.704796 893.672746Z"
                      p-id="2306"
                    ></path>
                    <path
                      d="M456.92259 82.893942c-209.311143 0-379.582131 170.282245-379.582131 379.582131s170.270988 379.570875 379.582131 379.570875c209.287607 0 379.558595-170.270988 379.558595-379.570875S666.210197 82.893942 456.92259 82.893942zM770.128989 462.477097c0 172.721807-140.508127 313.229934-313.206398 313.229934-172.720783 0-313.229934-140.508127-313.229934-313.229934s140.508127-313.229934 313.229934-313.229934C629.620861 149.247162 770.128989 289.75529 770.128989 462.477097z"
                      p-id="2307"
                    ></path>
                  </svg>
                </div>
                <div className="flex items-center ">
                  <KeyCard type="search"></KeyCard>
                </div>
              </div>
              <ThemeButton defaultTheme={props.defaultTheme} />
              {props.showRSS == "true" && (
                <RssButton showAdminButton={props.showAdminButton == "true"} />
              )}
              {props.showAdminButton == "true" && <AdminButton />}
            </div>
          </div>
        </div>
        {Boolean(props.categories.length) && props.showSubMenu == "true" && (
          <div className="min-h-10 items-center hidden md:flex border-b border-gray-200 dark:border-nav-dark py-2">
            <div
              className="mx-5"
              style={{ width: 52 + props.subMenuOffset }}
            ></div>
            <ul className="flex flex-wrap items-center text-sm text-gray-600 dark:text-dark">
              {props.categories.map((catelog) => {
                return (
                  <li
                    key={catelog}
                    className="flex items-center md:px-2 hover:text-gray-900 dark:hover:text-dark-hover transform hover:scale-110 cursor-pointer transition-all py-1"
                  >
                    <Link href={`/category/${encodeQuerystring(catelog)}`}>
                      <div>{catelog}</div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </>
  );
}

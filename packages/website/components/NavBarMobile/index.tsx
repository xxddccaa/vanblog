import { slide as Menu } from "react-burger-menu";
import Link from "next/link";
import { useCallback, useMemo } from "react";
import { MenuItem } from "../../api/getAllData";
import { useRouter } from "next/router";

export default function (props: {
  isOpen: boolean;
  setIsOpen: (i: boolean) => void;
  showFriends: "true" | "false";
  showAdminButton: "true" | "false";
  menus: MenuItem[];
}) {
  const router = useRouter();
  
  // Check if we're on the nav page
  const isNavPage = useMemo(() => {
    return router.pathname === '/nav';
  }, [router.pathname]);

  // If we're on the nav page and 'nav' is not in the menus, add it temporarily
  const displayMenus = useMemo(() => {
    if (isNavPage && !props.menus.some(menu => menu.value === '/nav')) {
      // console.log('Adding nav menu item for mobile display');
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

  const renderItem = useCallback((item: MenuItem, isSub?: boolean) => {
    if (item.value.includes("http")) {
      return (
        <li
          className="side-bar-item dark:border-dark-2 dark:hover:bg-dark-2"
          key={item.id}
        >
          <a
            className={`w-full inline-block  ${isSub ? "px-6" : "px-4"}`}
            target="_blank"
            href={item.value}
          >
            {item.name}
          </a>
        </li>
      );
    } else {
      return (
        <li
          className="side-bar-item dark:border-dark-2 dark:hover:bg-dark-2"
          key={item.id}
        >
          <Link href={item.value}>
            <div className={`w-full inline-block  ${isSub ? "px-8" : "px-4"}`}>
              {item.name}
            </div>
          </Link>
        </li>
      );
    }
  }, []);
  
  const renderLinks = useCallback(() => {
    const arr: any[] = [];
    displayMenus.forEach((item) => {
      arr.push(renderItem(item));
      if (item.children && item.children.length > 0) {
        item.children.forEach((i) => {
          arr.push(renderItem(i, true));
        });
      }
    });
    return arr;
  }, [displayMenus, renderItem]);

  return (
    <>
      <div>
        <Menu
          id="nav-mobile"
          disableAutoFocus={true}
          customCrossIcon={false}
          customBurgerIcon={false}
          isOpen={props.isOpen}
          onStateChange={(state) => {
            if (state.isOpen) {
              // 要打开
              document.body.style.overflow = "hidden";
            } else {
              document.body.style.overflow = "auto";
            }

            props.setIsOpen(state.isOpen);
          }}
        >
          <ul
            onClick={() => {
              document.body.style.overflow = "auto";
              props.setIsOpen(false);
            }}
            className=" sm:flex h-full items-center  text-sm text-gray-600 hidden divide-y divide-dashed dark:text-dark "
          >
            {renderLinks()}
            {props.showAdminButton == "true" && (
              <li
                className="side-bar-item dark:border-dark-2 dark:hover:bg-dark-2"
                key={"rss-phone-nav-btn"}
              >
                <a
                  className="w-full inline-block px-4 "
                  target="_blank"
                  href={"/admin"}
                >
                  {"后台"}
                </a>
              </li>
            )}
          </ul>
        </Menu>
      </div>
    </>
  );
}

import Footer from '@/components/Footer';
import { logoutAndRedirect } from '@/components/LogoutButton';
import { applyAdminFavicon, resolveAdminBrandLogo } from '@/utils/adminBranding';
import { getStoredUser } from '@/utils/getStoredUser';
import {
  HomeOutlined,
  LogoutOutlined,
  ProjectOutlined,
  SmileOutlined,
  FormOutlined,
  MessageOutlined,
  CompassOutlined,
  ContainerOutlined,
  ApartmentOutlined,
  PictureOutlined,
  ToolOutlined,
  FolderOutlined,
} from '@ant-design/icons';
import { Menu, message, Modal, notification } from 'antd';
import moment from 'moment';
import { history, Link } from '@umijs/max';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import defaultSettings from '../config/defaultSettings';
import { fetchAllMeta, getAdminLayoutConfig, getAdminThemeConfig } from './services/van-blog/api';
import { checkUrl } from './services/van-blog/checkUrl';
import { applyThemeToDocument, beforeSwitchTheme, getInitTheme } from './services/van-blog/theme';
import {
  getAdminLayoutToken,
  getAdminPrimaryColor,
  readStoredAdminThemeConfig,
  resolveAdminThemeMode,
  storeAdminThemeConfig,
} from './utils/adminTheme';
const loginPath = '/user/login';
const ADMIN_SIDER_COLLAPSE_STORAGE_KEY = 'vanblog.admin.sider.collapsed';
const ADMIN_SIDER_NARROW_BREAKPOINT = 768;
const ADMIN_DEFAULT_VIEWPORT_WIDTH = 1280;

// 图标映射
const iconMapping = {
  smile: <SmileOutlined />,
  form: <FormOutlined />,
  message: <MessageOutlined />,
  compass: <CompassOutlined />,
  container: <ContainerOutlined />,
  apartment: <ApartmentOutlined />,
  picture: <PictureOutlined />,
  tool: <ToolOutlined />,
  folder: <FolderOutlined />,
};
/** 获取用户信息比较慢的时候会展示一个 loading */

const ThemeSync = ({ theme, navTheme, adminThemeConfig }) => {
  useEffect(() => {
    const nextTheme = theme || getInitTheme() || (navTheme === 'realDark' ? 'dark' : 'light');

    // ProLayout may briefly stamp light-theme markers during mount, so re-apply
    // the stored theme once the layout and async children have settled.
    const syncTheme = () => applyThemeToDocument(nextTheme, adminThemeConfig);
    syncTheme();

    let frameId = null;
    let timeoutId = null;

    if (typeof window !== 'undefined') {
      frameId = window.requestAnimationFrame(syncTheme);
      timeoutId = window.setTimeout(syncTheme, 240);
    }

    return () => {
      if (frameId !== null && typeof window !== 'undefined') {
        window.cancelAnimationFrame(frameId);
      }
      if (timeoutId !== null && typeof window !== 'undefined') {
        window.clearTimeout(timeoutId);
      }
    };
  }, [adminThemeConfig, theme, navTheme]);

  return null;
};

const AdminBrandSync = ({ siteInfo }) => {
  useEffect(() => {
    applyAdminFavicon(siteInfo);
  }, [siteInfo?.adminFavicon]);

  return null;
};

const WALINE_PREWARM_KEY = 'vanblog.admin.waline-prewarmed';
const WALINE_PREWARM_RETRY_KEY = 'vanblog.admin.waline-prewarm-retry';

const getViewportWidth = () =>
  typeof window === 'undefined' ? ADMIN_DEFAULT_VIEWPORT_WIDTH : window.innerWidth;

const readDesktopCollapsedPreference = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.localStorage.getItem(ADMIN_SIDER_COLLAPSE_STORAGE_KEY) === 'true';
};

const writeDesktopCollapsedPreference = (collapsed) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(ADMIN_SIDER_COLLAPSE_STORAGE_KEY, String(Boolean(collapsed)));
};

const ThemeLightIcon = ({ size = 16 }) => (
  <svg
    className="fill-gray-600"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 1024 1024"
    fill="currentColor"
    aria-label="light icon"
    width={size}
    height={size}
  >
    <path d="M952 552h-80a40 40 0 0 1 0-80h80a40 40 0 0 1 0 80zM801.88 280.08a41 41 0 0 1-57.96-57.96l57.96-58a41.04 41.04 0 0 1 58 58l-58 57.96zM512 752a240 240 0 1 1 0-480 240 240 0 0 1 0 480zm0-560a40 40 0 0 1-40-40V72a40 40 0 0 1 80 0v80a40 40 0 0 1-40 40zm-289.88 88.08-58-57.96a41.04 41.04 0 0 1 58-58l57.96 58a41 41 0 0 1-57.96 57.96zM192 512a40 40 0 0 1-40 40H72a40 40 0 0 1 0-80h80a40 40 0 0 1 40 40zm30.12 231.92a41 41 0 0 1 57.96 57.96l-57.96 58a41.04 41.04 0 0 1-58-58l58-57.96zM512 832a40 40 0 0 1 40 40v80a40 40 0 0 1-80 0v-80a40 40 0 0 1 40-40zm289.88-88.08 58 57.96a41.04 41.04 0 0 1-58 58l-57.96-58a41 41 0 0 1 57.96-57.96z"></path>
  </svg>
);

const ThemeDarkIcon = ({ size = 16 }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 1024 1024"
    fill="currentColor"
    aria-label="dark icon"
    width={size}
    height={size}
  >
    <path d="M524.8 938.667h-4.267a439.893 439.893 0 0 1-313.173-134.4 446.293 446.293 0 0 1-11.093-597.334A432.213 432.213 0 0 1 366.933 90.027a42.667 42.667 0 0 1 45.227 9.386 42.667 42.667 0 0 1 10.24 42.667 358.4 358.4 0 0 0 82.773 375.893 361.387 361.387 0 0 0 376.747 82.774 42.667 42.667 0 0 1 54.187 55.04 433.493 433.493 0 0 1-99.84 154.88 438.613 438.613 0 0 1-311.467 128z"></path>
  </svg>
);

const getResolvedThemeMode = (initialState) =>
  resolveAdminThemeMode(initialState?.settings?.navTheme);

const getSiderCollapseButton = () =>
  typeof document === 'undefined'
    ? null
    : document.querySelector('.ant-pro-sider-collapsed-button');

const isSiderCollapsed = () => {
  if (typeof document === 'undefined') {
    return false;
  }

  const footer = document
    .querySelector('[data-testid="admin-sider-footer-actions"]')
    ?.closest('.ant-pro-sider-footer');
  if (footer) {
    return footer.classList.contains('ant-pro-sider-footer-collapsed');
  }

  return (
    getSiderCollapseButton()?.classList.contains('ant-pro-sider-collapsed-button-collapsed') ||
    false
  );
};

const SiderCollapseSync = () => {
  const toggleButtonRef = useRef(null);
  const pendingSyncTimersRef = useRef([]);
  const mobileCollapsedRef = useRef(getViewportWidth() < ADMIN_SIDER_NARROW_BREAKPOINT);
  const isNarrowScreenRef = useRef(getViewportWidth() < ADMIN_SIDER_NARROW_BREAKPOINT);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const syncCollapsedState = () => {
      const toggleButton = getSiderCollapseButton();
      if (!toggleButton) {
        return;
      }

      const desiredCollapsed = isNarrowScreenRef.current
        ? mobileCollapsedRef.current
        : readDesktopCollapsedPreference();
      const currentCollapsed = isSiderCollapsed();

      if (currentCollapsed !== desiredCollapsed) {
        toggleButton.click();
      }
    };

    const recordCollapsedState = () => {
      window.setTimeout(() => {
        const currentCollapsed = isSiderCollapsed();

        if (isNarrowScreenRef.current) {
          mobileCollapsedRef.current = currentCollapsed;
          return;
        }

        writeDesktopCollapsedPreference(currentCollapsed);
      }, 80);
    };

    const bindToggleListener = () => {
      const toggleButton = getSiderCollapseButton();
      if (!toggleButton || toggleButtonRef.current === toggleButton) {
        return;
      }

      if (toggleButtonRef.current) {
        toggleButtonRef.current.removeEventListener('click', recordCollapsedState);
      }

      toggleButton.addEventListener('click', recordCollapsedState);
      toggleButtonRef.current = toggleButton;
    };

    const queueDeferredSyncs = () => {
      pendingSyncTimersRef.current.forEach((timer) => {
        window.clearTimeout(timer);
      });
      pendingSyncTimersRef.current = [
        window.setTimeout(syncCollapsedState, 180),
        window.setTimeout(syncCollapsedState, 420),
      ];
    };

    const applyResponsiveCollapse = () => {
      handleSizeChange();
      bindToggleListener();

      const nextIsNarrowScreen = getViewportWidth() < ADMIN_SIDER_NARROW_BREAKPOINT;
      if (nextIsNarrowScreen && !isNarrowScreenRef.current) {
        mobileCollapsedRef.current = true;
      }

      isNarrowScreenRef.current = nextIsNarrowScreen;
      syncCollapsedState();
      queueDeferredSyncs();
    };

    applyResponsiveCollapse();

    const frameId = window.requestAnimationFrame(applyResponsiveCollapse);
    const timeoutId = window.setTimeout(applyResponsiveCollapse, 240);
    window.addEventListener('resize', applyResponsiveCollapse);

    return () => {
      if (toggleButtonRef.current) {
        toggleButtonRef.current.removeEventListener('click', recordCollapsedState);
      }
      pendingSyncTimersRef.current.forEach((timer) => {
        window.clearTimeout(timer);
      });
      window.removeEventListener('resize', applyResponsiveCollapse);
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
    };
  }, []);

  return null;
};

const AdminSiderFooter = ({ collapsed, initialState, setInitialState }) => {
  const theme = initialState?.theme || 'light';
  const themeDisplay =
    theme === 'dark'
      ? { label: '暗色', icon: <ThemeDarkIcon /> }
      : { label: '亮色', icon: <ThemeLightIcon /> };

  const handleThemeToggle = useCallback(() => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    const nextSettings = {
      ...initialState?.settings,
      navTheme: beforeSwitchTheme(nextTheme),
      primaryColor: getAdminPrimaryColor(nextTheme, initialState?.adminThemeConfig),
    };

    setInitialState({
      ...initialState,
      theme: nextTheme,
      settings: nextSettings,
    });
  }, [initialState, setInitialState, theme]);

  const handleLogout = useCallback(() => {
    setInitialState((state) => ({ ...state, user: undefined }));
    logoutAndRedirect().then(() => {
      message.success('登出成功！');
    });
  }, [setInitialState]);

  const handleFooterClick = useCallback(
    ({ key }) => {
      if (key === 'main-site') {
        window.open('/', '_blank', 'noopener,noreferrer');
        return;
      }

      if (key === 'about') {
        history.push('/about');
        return;
      }

      if (key === 'theme-toggle') {
        handleThemeToggle();
        return;
      }

      if (key === 'logout') {
        handleLogout();
      }
    },
    [handleLogout, handleThemeToggle],
  );

  const footerItems = useMemo(
    () => [
      {
        key: 'main-site',
        icon: <HomeOutlined />,
        label: <span data-testid="admin-footer-main-site">主站</span>,
        title: '主站',
      },
      {
        key: 'about',
        icon: <ProjectOutlined />,
        label: <span data-testid="admin-footer-about">关于</span>,
        title: '关于',
      },
      {
        key: 'theme-toggle',
        icon: themeDisplay.icon,
        label: <span data-testid="admin-theme-toggle-label">{themeDisplay.label}</span>,
        title: themeDisplay.label,
      },
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: <span data-testid="admin-logout-label">登出</span>,
        title: '登出',
      },
    ],
    [themeDisplay.icon, themeDisplay.label],
  );

  return (
    <div data-testid="admin-sider-footer-actions">
      <Menu
        mode="inline"
        selectable={false}
        inlineCollapsed={collapsed}
        className="admin-sider-footer-menu"
        items={footerItems}
        onClick={handleFooterClick}
      />
    </div>
  );
};

const WalinePrewarm = () => {
  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }
    if ([loginPath, '/init', '/user/restore'].includes(history.location.pathname)) {
      return undefined;
    }
    if (window.sessionStorage.getItem(WALINE_PREWARM_KEY) === 'full') {
      return undefined;
    }

    let frame = null;
    let disposed = false;
    let idleHandle = null;

    const cleanup = () => {
      if (frame?.parentNode) {
        frame.parentNode.removeChild(frame);
      }
      frame = null;
    };

    const appendHintLink = (rel) => {
      const link = document.createElement('link');
      link.rel = rel;
      link.href = '/api/ui/';
      link.as = 'document';
      document.head.appendChild(link);
      return link;
    };

    const start = () => {
      if (disposed || window.sessionStorage.getItem(WALINE_PREWARM_KEY) === 'full') {
        return;
      }

      fetch('/api/ui/', { credentials: 'same-origin' })
        .then(() => {
          if (!disposed && window.sessionStorage.getItem(WALINE_PREWARM_KEY) !== 'full') {
            window.sessionStorage.setItem(WALINE_PREWARM_KEY, 'page');
          }
        })
        .catch(() => {
          window.sessionStorage.setItem(
            WALINE_PREWARM_RETRY_KEY,
            String(Number(window.sessionStorage.getItem(WALINE_PREWARM_RETRY_KEY) || 0) + 1),
          );
        });

      frame = document.createElement('iframe');
      frame.src = '/api/ui/';
      frame.setAttribute('aria-hidden', 'true');
      frame.setAttribute('tabindex', '-1');
      frame.style.position = 'fixed';
      frame.style.left = '-9999px';
      frame.style.bottom = '0';
      frame.style.width = '1px';
      frame.style.height = '1px';
      frame.style.opacity = '0';
      frame.style.pointerEvents = 'none';
      frame.style.border = '0';

      frame.addEventListener(
        'load',
        () => {
          if (disposed) {
            cleanup();
            return;
          }
          window.sessionStorage.setItem(WALINE_PREWARM_KEY, 'full');
          window.sessionStorage.removeItem(WALINE_PREWARM_RETRY_KEY);
          cleanup();
        },
        { once: true },
      );

      frame.addEventListener(
        'error',
        () => {
          window.sessionStorage.setItem(
            WALINE_PREWARM_RETRY_KEY,
            String(Number(window.sessionStorage.getItem(WALINE_PREWARM_RETRY_KEY) || 0) + 1),
          );
          cleanup();
        },
        { once: true },
      );

      document.body.appendChild(frame);
    };

    const prefetchLink = appendHintLink('prefetch');
    const preloadLink = appendHintLink('preload');
    const kickoff = () => window.setTimeout(start, 300);

    if (typeof window.requestIdleCallback === 'function') {
      idleHandle = window.requestIdleCallback(kickoff, { timeout: 1200 });
    } else {
      idleHandle = kickoff();
    }

    return () => {
      disposed = true;
      if (typeof idleHandle === 'number') {
        window.clearTimeout(idleHandle);
      } else if (idleHandle !== null && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleHandle);
      }
      prefetchLink?.remove();
      preloadLink?.remove();
      cleanup();
    };
  }, []);

  return null;
};

const AdminViewportSync = () => {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return undefined;
    }

    const syncViewport = () => {
      const width = getViewportWidth();
      const nextViewport = width < 768 ? 'mobile' : width < 992 ? 'tablet' : 'desktop';

      document.body.dataset.adminViewport = nextViewport;
      document.documentElement.dataset.adminViewport = nextViewport;
      document.body.classList.toggle('admin-mobile-shell', nextViewport === 'mobile');
      document.body.classList.toggle('admin-tablet-shell', nextViewport === 'tablet');
    };

    syncViewport();
    window.addEventListener('resize', syncViewport);

    return () => {
      window.removeEventListener('resize', syncViewport);
    };
  }, []);

  return null;
};
/**
 * @see  https://umijs.org/zh-CN/plugins/plugin-initial-state
 * */
export async function getInitialState() {
  const fetchInitData = async (option) => {
    try {
      const msg = await fetchAllMeta(option);
      if (msg.statusCode == 233) {
        history.push('/init');
        return msg.data || {};
      } else if (history.location.pathname == '/init' && msg.statusCode == 200) {
        history.push('/');
      }
      return msg.data;
    } catch (error) {
      // console.log('fet init data error', error);
      history.push(loginPath);
      return {};
    }
  };

  const fetchAdminLayoutData = async () => {
    try {
      const { data } = await getAdminLayoutConfig();
      return data;
    } catch (error) {
      // 如果获取失败，返回默认配置
      return null;
    }
  };

  const fetchAdminThemeData = async (shouldRequestAdminTheme) => {
    const fallbackThemeConfig = readStoredAdminThemeConfig();

    if (!shouldRequestAdminTheme) {
      return fallbackThemeConfig;
    }

    try {
      const { data } = await getAdminThemeConfig();
      return storeAdminThemeConfig(data);
    } catch (error) {
      return fallbackThemeConfig;
    }
  };

  // 如果不是登录页面，执行
  let option = {};
  const shouldRequestAdminTheme = Boolean(
    localStorage.getItem('token') &&
      ![loginPath, '/init', '/user/restore'].includes(history.location.pathname),
  );
  if (
    history.location.pathname == loginPath ||
    history.location.pathname == '/init' ||
    !localStorage.getItem('token')
  ) {
    option.skipErrorHandler = true;
  }
  const [initData, adminLayoutData, adminThemeConfig] = await Promise.all([
    fetchInitData(option),
    fetchAdminLayoutData(),
    fetchAdminThemeData(shouldRequestAdminTheme),
  ]);

  const { latestVersion, updatedAt, baseUrl, allowDomains, version } = initData;

  if (baseUrl && !checkUrl(baseUrl)) {
    Modal.warn({
      title: '网站 URL 不合法',
      content: (
        <div>
          <p>
            您在站点设置中填写的"网站 URL"不合法，这将导致一些奇怪的问题（比如生成的 RSS
            订阅源错误等）
          </p>
          <p>网站 URL 需包含完整的协议。</p>
          <p>例如： https://blog-demo.mereith.com</p>
          <a
            onClick={() => {
              history.push('/site/setting?siteInfoTab=basic');
              return true;
            }}
          >
            前往修改
          </a>
        </div>
      ),
    });
  }
  // 来一个横幅提示
  if (version && latestVersion && version != 'dev') {
    if (version >= latestVersion) {
    } else {
      const skipVersion = localStorage.getItem('skipVersion');
      if (skipVersion != latestVersion) {
        // 老的
        notification.info({
          duration: 3000,
          message: (
            <div>
              <p style={{ marginBottom: 4 }}>有新版本！</p>
              <p style={{ marginBottom: 4 }}>{`当前版本:\t${version}`}</p>
              <p style={{ marginBottom: 4 }}>{`最新版本:\t${latestVersion}`}</p>
              <p style={{ marginBottom: 4 }}>{`更新时间:\t${moment(updatedAt).format(
                'YYYY-MM-DD HH:mm:ss',
              )}`}</p>
              <p style={{ marginBottom: 4 }}>
                {`更新日志:\t`}
                <a
                  target={'_blank'}
                  href="https://vanblog.mereith.com/ref/changelog.html"
                  rel="noreferrer"
                >
                  点击查看
                </a>
              </p>
              <p style={{ marginBottom: 4 }}>
                {`更新方法:\t`}
                <a
                  target={'_blank'}
                  href="https://vanblog.mereith.com/guide/update.html#%E5%8D%87%E7%BA%A7%E6%96%B9%E6%B3%95"
                  rel="noreferrer"
                >
                  点击查看
                </a>
              </p>
              <p style={{ marginBottom: 4 }}>
                PS： 更新后如后台一直 loading 或出现 Fetch error 请手动清理一下浏览器缓存
              </p>
              <a
                onClick={() => {
                  window.localStorage.setItem('skipVersion', latestVersion);
                  message.success('跳过此版本成功！下次进入后台将不会触发此版本的升级提示');
                  const el = document.querySelector('.ant-notification-notice-close-x');
                  if (el) {
                    el.click();
                  }
                }}
              >
                跳过此版本
              </a>
            </div>
          ),
        });
      }
    }
  }
  // 暗色模式
  const theme = getInitTheme();
  const sysTheme = applyThemeToDocument(theme, adminThemeConfig);
  return {
    fetchInitData,
    ...initData,
    adminLayoutConfig: adminLayoutData,
    adminThemeConfig,
    settings: {
      ...defaultSettings,
      navTheme: sysTheme,
      primaryColor: getAdminPrimaryColor(theme, adminThemeConfig),
    },
    theme,
  };
} // ProLayout 支持的api https://procomponents.ant.design/components/layout

const handleSizeChange = () => {
  if (typeof document === 'undefined') {
    return;
  }
  const el = document.querySelector('header.ant-layout-header');
  if (el) {
    el.style.display = 'block';
  }
};

export const layout = ({ initialState, setInitialState }) => {
  const sessionUser = initialState?.user || getStoredUser();
  const themeMode = getResolvedThemeMode(initialState);
  const adminLogo = resolveAdminBrandLogo(initialState);
  const siderHeaderColor = themeMode === 'dark' ? '#f8fafc' : 'rgba(0, 0, 0, 0.88)';

  // 动态菜单渲染函数
  const menuDataRender = (menuList) => {
    const { adminLayoutConfig } = initialState || {};

    if (!adminLayoutConfig || !adminLayoutConfig.menuItems) {
      return menuList;
    }

    // 创建菜单项映射
    const menuMapping = {};
    menuList.forEach((menu) => {
      if (menu.path === '/welcome') menuMapping.welcome = menu;
      else if (menu.path === '/article') menuMapping.article = menu;
      else if (menu.path === '/moment') menuMapping.moment = menu;
      else if (menu.path === '/nav') menuMapping.nav = menu;
      else if (menu.path === '/draft') menuMapping.draft = menu;
      else if (menu.path === '/document') menuMapping.document = menu;
      else if (menu.path === '/mindmap') menuMapping.mindmap = menu;
      else if (menu.path === '/static/img') menuMapping.static = menu;
      else if (menu.path === '/site') menuMapping.site = menu;
    });

    // 根据配置生成新的菜单
    const configuredMenus = adminLayoutConfig.menuItems
      .filter((item) => item.visible)
      .sort((a, b) => a.order - b.order)
      .map((item) => {
        const originalMenu = menuMapping[item.key];
        if (originalMenu) {
          return {
            ...originalMenu,
            name: item.name,
            icon: iconMapping[item.icon] || originalMenu.icon,
          };
        }
        return null;
      })
      .filter(Boolean);

    return configuredMenus;
  };

  return {
    menuDataRender,
    menuHeaderRender: (_, __, props) => (
      <Link
        to="/"
        data-testid="admin-sider-logo"
        style={{ display: 'flex', alignItems: 'center', gap: 12, color: siderHeaderColor }}
      >
        <img src={adminLogo} alt="VanBlog logo" style={{ width: 32, height: 32, flexShrink: 0 }} />
        {!props?.collapsed ? (
          <h1 style={{ margin: 0, fontSize: 18, lineHeight: '32px', color: siderHeaderColor }}>
            VanBlog
          </h1>
        ) : null}
      </Link>
    ),
    rightContentRender: false,
    menuFooterRender: (props) => (
      <AdminSiderFooter
        collapsed={Boolean(props?.collapsed)}
        initialState={initialState}
        setInitialState={setInitialState}
      />
    ),
    // disableContentMargin: true,
    footerRender: () => {
      // const { location } = history;
      // const disableArr = ['/editor', '/site/comment'];
      // if (disableArr.includes(location.pathname)) {
      //   return false;
      // }
      // 目前 footer 只有发 console.log 一个功能了。
      return <Footer />;
    },
    onPageChange: () => {
      const { location } = history; // 如果没有登录，重定向到 login
      if (location.pathname === '/init' && !sessionUser) {
        return;
      }
      if (!sessionUser && ![loginPath, '/user/restore'].includes(location.pathname)) {
        history.push(loginPath);
      }
      if (location.pathname == loginPath && Boolean(sessionUser)) {
        history.push('/');
      }
    },
    links: [],

    // 自定义 403 页面
    // unAccessible: <div>unAccessible</div>,
    // 增加一个 loading 的状态
    childrenRender: (children, props) => {
      // if (initialState?.loading) return <PageLoading />;
      return (
        <>
          <ThemeSync
            theme={initialState?.theme}
            navTheme={initialState?.settings?.navTheme}
            adminThemeConfig={initialState?.adminThemeConfig}
          />
          <AdminBrandSync siteInfo={initialState} />
          <SiderCollapseSync />
          <AdminViewportSync />
          <WalinePrewarm />
          {children}
        </>
      );
    },
    token: getAdminLayoutToken(themeMode, initialState?.adminThemeConfig),
    defaultCollapsed: false,
    ...initialState?.settings,
    logo: adminLogo,
  };
};
export const request = {
  errorConfig: {
    adaptor: (resData) => {
      let errorMessage = resData.message;
      let success = resData?.statusCode == 200 || resData?.statusCode == 233;
      if (resData?.statusCode == 401 && resData?.message == 'Unauthorized') {
        errorMessage = '登录失效';
      }
      if (errorMessage == 'Forbidden resource') {
        errorMessage = '权限不足！';
      }
      return {
        ...resData,
        success,
        errorMessage,
      };
    },
  },
  requestInterceptors: [
    (url, options) => {
      return {
        url: url,
        options: {
          ...options,
          interceptors: true,
          headers: {
            token: (() => {
              return window.localStorage.getItem('token') || 'null';
            })(),
          },
        },
      };
    },
  ],
  // responseInterceptors: [
  //   response => {
  //     if (response.statusCode === 233) {
  //       console.log("go to init!")
  //       // window.location.pathname = '/init'
  //       history.push('/init')
  //       return response
  //     } else {
  //       return response
  //     }

  //   }
  // ]
};

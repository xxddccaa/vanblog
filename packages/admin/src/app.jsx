import Footer from '@/components/Footer';
import LogoutButton from '@/components/LogoutButton';
import ThemeButton from '@/components/ThemeButton';
import { getStoredUser } from '@/utils/getStoredUser';
import { getAdminAssetPath } from '@/utils/getAssetPath';
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
import { message, Modal, notification } from 'antd';
import moment from 'moment';
import { history, Link } from '@umijs/max';
import { useEffect } from 'react';
import defaultSettings from '../config/defaultSettings';
import { fetchAllMeta, getAdminLayoutConfig } from './services/van-blog/api';
import { checkUrl } from './services/van-blog/checkUrl';
import { applyThemeToDocument, getInitTheme } from './services/van-blog/theme';
const loginPath = '/user/login';

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

const ThemeSync = ({ theme, navTheme }) => {
  useEffect(() => {
    const nextTheme = theme || getInitTheme() || (navTheme === 'realDark' ? 'dark' : 'light');

    // ProLayout may briefly stamp light-theme markers during mount, so re-apply
    // the stored theme once the layout and async children have settled.
    const syncTheme = () => applyThemeToDocument(nextTheme);
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
  }, [theme, navTheme]);

  return null;
};

const WALINE_PREWARM_KEY = 'vanblog.admin.waline-prewarmed';
const WALINE_PREWARM_RETRY_KEY = 'vanblog.admin.waline-prewarm-retry';

const footerActionButtonStyle = (collapsed) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: collapsed ? 'center' : 'flex-start',
  width: '100%',
  minHeight: 38,
  padding: collapsed ? '8px 0' : '8px 10px',
  border: 0,
  borderRadius: 10,
  background: 'transparent',
  color: 'inherit',
  cursor: 'pointer',
});

const getResolvedThemeMode = (initialState) =>
  initialState?.settings?.navTheme === 'realDark' ? 'dark' : 'light';

const getLayoutToken = (themeMode) => {
  if (themeMode === 'dark') {
    return {
      layout: {
        sider: {
          colorMenuBackground: '#0f172a',
          colorBgCollapsedButton: '#0f172a',
          colorTextCollapsedButton: '#e5e7eb',
          colorTextCollapsedButtonHover: '#f8fafc',
          colorMenuItemDivider: 'rgba(148, 163, 184, 0.18)',
          colorTextMenu: '#cbd5e1',
          colorTextMenuSecondary: '#94a3b8',
          colorTextMenuTitle: '#f8fafc',
          colorTextMenuItemHover: '#f8fafc',
          colorTextMenuActive: '#f8fafc',
          colorTextMenuSelected: '#f8fafc',
          colorBgMenuItemHover: 'rgba(148, 163, 184, 0.12)',
          colorBgMenuItemSelected: 'rgba(59, 130, 246, 0.18)',
        },
      },
    };
  }

  return {
    layout: {
      sider: {
        colorMenuBackground: '#ffffff',
        colorBgCollapsedButton: '#ffffff',
        colorTextCollapsedButton: 'rgba(0, 0, 0, 0.65)',
        colorTextCollapsedButtonHover: 'rgba(0, 0, 0, 0.88)',
        colorMenuItemDivider: 'rgba(5, 5, 5, 0.06)',
        colorTextMenu: 'rgba(0, 0, 0, 0.65)',
        colorTextMenuSecondary: 'rgba(0, 0, 0, 0.45)',
        colorTextMenuTitle: 'rgba(0, 0, 0, 0.88)',
        colorTextMenuItemHover: 'rgba(0, 0, 0, 0.88)',
        colorTextMenuActive: 'rgba(0, 0, 0, 0.88)',
        colorTextMenuSelected: '#1772b4',
        colorBgMenuItemHover: 'rgba(23, 114, 180, 0.08)',
        colorBgMenuItemSelected: 'rgba(23, 114, 180, 0.12)',
      },
    },
  };
};

const AdminSiderFooter = ({ collapsed }) => {
  const labelStyle = collapsed ? { display: 'none' } : { marginLeft: 8 };

  return (
    <div
      data-testid="admin-sider-footer-actions"
      style={{
        padding: collapsed ? '8px' : '12px',
      }}
    >
      <div style={{ minHeight: 38 }}>
        <ThemeButton showText={!collapsed} />
      </div>
      <LogoutButton
        trigger={
          <button
            type="button"
            data-testid="admin-logout-button"
            aria-label="退出后台登录"
            style={footerActionButtonStyle(collapsed)}
          >
            <LogoutOutlined />
            <span style={labelStyle}>登出</span>
          </button>
        }
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
      } else if (
        idleHandle !== null &&
        typeof window.cancelIdleCallback === 'function'
      ) {
        window.cancelIdleCallback(idleHandle);
      }
      prefetchLink?.remove();
      preloadLink?.remove();
      cleanup();
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

  // 如果不是登录页面，执行
  let option = {};
  if (
    history.location.pathname == loginPath ||
    history.location.pathname == '/init' ||
    !localStorage.getItem('token')
  ) {
    option.skipErrorHandler = true;
  }
  const initData = await fetchInitData(option);
  const adminLayoutData = await fetchAdminLayoutData();

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
  const sysTheme = applyThemeToDocument(theme);
  return {
    fetchInitData,
    ...initData,
    adminLayoutConfig: adminLayoutData,
    settings: { ...defaultSettings, navTheme: sysTheme },
    theme,
  };
} // ProLayout 支持的api https://procomponents.ant.design/components/layout

const handleSizeChange = () => {
  const el = document.querySelector('header.ant-layout-header');
  if (el) {
    el.style.display = 'block';
  }
};

window.onresize = handleSizeChange;

export const layout = ({ initialState, setInitialState }) => {
  handleSizeChange();
  const sessionUser = initialState?.user || getStoredUser();
  const themeMode = getResolvedThemeMode(initialState);
  const siderLinkStyle = {
    color: themeMode === 'dark' ? '#cbd5e1' : 'rgba(0, 0, 0, 0.65)',
  };
  const siderHeaderColor = themeMode === 'dark' ? '#f8fafc' : 'rgba(0, 0, 0, 0.88)';

  // 动态菜单渲染函数
  const menuDataRender = (menuList) => {
    const { adminLayoutConfig } = initialState || {};
    
    if (!adminLayoutConfig || !adminLayoutConfig.menuItems) {
      return menuList;
    }

    // 创建菜单项映射
    const menuMapping = {};
    menuList.forEach(menu => {
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
      .filter(item => item.visible)
      .sort((a, b) => a.order - b.order)
      .map(item => {
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
    logo: getAdminAssetPath('logo.svg'),
    menuHeaderRender: (_, __, props) => (
      <Link
        to="/"
        data-testid="admin-sider-logo"
        style={{ display: 'flex', alignItems: 'center', gap: 12, color: siderHeaderColor }}
      >
        <img
          src={getAdminAssetPath('logo.svg')}
          alt="VanBlog logo"
          style={{ width: 32, height: 32, flexShrink: 0 }}
        />
        {!props?.collapsed ? (
          <h1 style={{ margin: 0, fontSize: 18, lineHeight: '32px', color: siderHeaderColor }}>
            VanBlog
          </h1>
        ) : null}
      </Link>
    ),
    rightContentRender: false,
    menuFooterRender: (props) => (
      <AdminSiderFooter collapsed={Boolean(props?.collapsed)} />
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
    links: [
      <a key="mainSiste" rel="noreferrer" target="_blank" href={'/'} style={siderLinkStyle}>
        <HomeOutlined />
        <span>主站</span>
      </a>,
      <Link key="AboutLink" to={'/about'} style={siderLinkStyle}>
        <ProjectOutlined />
        <span>关于</span>
      </Link>,
    ],

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
          />
          <WalinePrewarm />
          {children}
        </>
      );
    },
    token: getLayoutToken(themeMode),
    ...initialState?.settings,
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

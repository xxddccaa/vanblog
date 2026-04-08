const adminAssetBase = process.env.NODE_ENV === 'production' ? '/admin' : '';

const Settings = {
  navTheme: 'light',
  // 明青色
  primaryColor: '#1772B4',
  layout: 'side',
  contentWidth: 'Fixed',
  // contentWidth: 'Fluid',
  fixedHeader: false,
  fixSiderbar: true,
  colorWeak: false,
  // headerRender: false,
  title: 'VanBlog',
  headerHeight: 48,
  splitMenus: false,
  // headerRender: false,
  pwa: false,
  logo: `${adminAssetBase}/logo.svg`,
  iconfontUrl: '',
};
export default Settings;

export class SiteInfo {
  author: string;
  authorLogo: string;
  authorLogoDark: string;
  authDesc: string;
  siteLogo: string;
  siteLogoDark: string;
  favicon: string;
  siteName: string;
  siteDesc: string;
  beianNumber: string;
  beianUrl: string;
  gaBeianNumber: string;
  gaBeianUrl: string;
  gaBeianLogoUrl: string;
  payAliPay: string;
  payWechat: string;
  payAliPayDark: string;
  payWechatDark: string;
  since: Date;
  baseUrl: string;
  gaAnalysisId: string;
  baiduAnalysisId: string;
  copyrightAggreement: string;
  enableComment?: 'true' | 'false';
  showSubMenu?: 'true' | 'false';
  headerLeftContent?: 'siteLogo' | 'siteName';
  subMenuOffset: number;
  showAdminButton: 'true' | 'false';
  showDonateInfo: 'true' | 'false';
  showFriends: 'true' | 'false';
  showCopyRight: 'true' | 'false';
  showDonateButton: 'true' | 'false';
  showDonateInAbout: 'true' | 'false';
  allowOpenHiddenPostByUrl: 'true' | 'false';
  defaultTheme: 'auto' | 'dark' | 'light';
  enableCustomizing: 'true' | 'false';
  showRSS: 'true' | 'false';
  openArticleLinksInNewWindow: 'true' | 'false';
  showExpirationReminder?: 'true' | 'false';
  showEditButton?: 'true' | 'false';
  homePageSize?: number;
  // 管理后台分页设置
  adminArticlePageSize?: number;
  adminDraftPageSize?: number;
  adminMomentPageSize?: number;
  // 音乐相关设置
  enableMusic?: 'true' | 'false';
  showMusicControl?: 'true' | 'false';
  musicAutoPlay?: 'true' | 'false';
  // 全站隐私设置
  privateSite?: 'true' | 'false';
  // 代码显示行数设置
  codeMaxLines?: number;
  // 是否显示建站时间
  showRunningTime?: 'true' | 'false';
  // 网站背景图
  backgroundImage?: string;
  backgroundImageDark?: string;
}
export interface updateUserDto {
  username: string;
  password: string;
}
export type UpdateSiteInfoDto = Partial<SiteInfo> | Partial<updateUserDto>;

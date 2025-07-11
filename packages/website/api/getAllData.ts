import { HeadTag } from "../utils/getLayoutProps";
import { config } from "../utils/loadConfig";
export type SocialType =
  | "bilibili"
  | "email"
  | "github"
  | "wechat"
  | "gitee"
  | "wechat-dark";

export type PresetIconType = 
  | 'bilibili' 
  | 'email' 
  | 'github' 
  | 'gitee' 
  | 'wechat' 
  | 'wechat-dark'
  | 'weibo'
  | 'twitter'
  | 'facebook'
  | 'instagram'
  | 'linkedin'
  | 'youtube'
  | 'tiktok'
  | 'zhihu'
  | 'csdn'
  | 'juejin'
  | 'wechat-mp'
  | 'qq'
  | 'telegram'
  | 'discord'
  | 'custom';
export const defaultMenu: MenuItem[] = [
  {
    id: 0,
    name: "首页",
    value: "/",
    level: 0,
  },
  {
    id: 1,
    name: "标签",
    value: "/tag",
    level: 0,
  },
  {
    id: 2,
    name: "分类",
    value: "/category",
    level: 0,
  },
  {
    id: 3,
    name: "时间线",
    value: "/timeline",
    level: 0,
  },
  {
    id: 4,
    name: "友链",
    value: "/link",
    level: 0,
  },
  {
    id: 5,
    name: "个人动态",
    value: "/moment",
    level: 0,
  },
  {
    id: 6,
    name: "导航",
    value: "/nav",
    level: 0,
  },
  {
    id: 7,
    name: "关于",
    value: "/about",
    level: 0,
  },
];
export interface CustomPageList {
  name: string;
  path: string;
}
export interface CustomPage extends CustomPageList {
  html: string;
}
export interface SocialItem {
  updatedAt: string;
  type: SocialType;
  value: string;
  dark?: string;
  
  // 新增字段
  displayName?: string;
  iconType?: PresetIconType;
  customIconUrl?: string;
  customIconUrlDark?: string;
  linkType?: 'link' | 'email' | 'qrcode';
  darkValue?: string;
  iconName?: string; // 图标管理中的图标名称
  iconData?: IconItem | null; // 完整的图标数据，避免异步请求
}
export interface MenuItem {
  id: number;
  name: string;
  value: string;
  level: number;
  children?: MenuItem[];
}
export interface DonateItem {
  name: string;
  value: string;
  updatedAt: string;
}
export interface LinkItem {
  name: string;
  desc: string;
  logo: string;
  url: string;
  updatedAt: string;
}
export interface MetaProps {
  links: LinkItem[];
  socials: SocialItem[];
  rewards: DonateItem[];
  categories: string[];
  about: {
    updatedAt: string;
    content: string;
  };
  siteInfo: {
    author: string;
    authorDesc: string;
    authorLogo: string;
    authorLogoDark?: string;
    siteLogo: string;
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
    payAliPayDark?: string;
    payWechatDark?: string;
    since: string;
    baseUrl: string;
    baiduAnalysisId?: string;
    gaAnalysisId?: string;
    siteLogoDark?: string;
    copyrightAggreement: string;
    showSubMenu?: "true" | "false";
    showAdminButton?: "true" | "false";
    headerLeftContent?: "siteLogo" | "siteName";
    subMenuOffset?: number;
    showDonateInfo: "true" | "false";
    showFriends: "true" | "false";
    enableComment: "true" | "false";
    defaultTheme: "auto" | "light" | "dark";
    showDonateInAbout?: "true" | "false";
    enableCustomizing: "true" | "false";
    showDonateButton: "true" | "false";
    showCopyRight: "true" | "false";
    showRSS: "true" | "false";
    openArticleLinksInNewWindow: "true" | "false";
    showExpirationReminder: "true" | "false";
    showEditButton: "true" | "false";
    homePageSize?: number;
    // 管理后台分页设置
    adminArticlePageSize?: number;
    adminDraftPageSize?: number;
    adminMomentPageSize?: number;
    // 全站隐私设置
    privateSite?: 'true' | 'false';
  };
}
export interface PublicMetaProp {
  version: string;
  tags: string[];
  totalArticles: number;
  meta: MetaProps;
  menus: MenuItem[];
  totalWordCount: number;
  layout?: {
    css?: string;
    script?: string;
    html?: string;
    head?: HeadTag[];
  };
}

export const version = process.env["VAN_BLOG_VERSION"] || "dev";

const defaultMeta: MetaProps = {
  categories: [],
  links: [],
  socials: [],
  rewards: [],
  about: {
    updatedAt: new Date().toISOString(),
    content: "",
  },
  siteInfo: {
    author: "作者名字",
    authorDesc: "作者描述",
    authorLogo: "/logo.svg",
    siteLogo: "/logo.svg",
    favicon: "/logo.svg",
    siteName: "VanBlog",
    siteDesc: "Vanblog",
    copyrightAggreement: "",
    beianNumber: "",
    beianUrl: "",
    gaBeianNumber: "",
    gaBeianUrl: "",
    gaBeianLogoUrl: "",
    payAliPay: "",
    payWechat: "",
    payAliPayDark: "",
    payWechatDark: "",
    since: "",
    enableComment: "true",
    baseUrl: "",
    showDonateInfo: "true",
    showFriends: "true",
    showAdminButton: "true",
    defaultTheme: "auto",
    showDonateInAbout: "false",
    enableCustomizing: "true",
    showCopyRight: "true",
    showDonateButton: "true",
    showExpirationReminder: "true",
    showRSS: "true",
    openArticleLinksInNewWindow: "false",
    showEditButton: "false",
  },
};

export async function getPublicMeta(): Promise<PublicMetaProp> {
  try {
    const url = `${config.baseUrl}api/public/meta`;
    const res = await fetch(url);
    const { statusCode, data } = await res.json();
    if (statusCode == 233) {
      return {
        version: version,
        totalWordCount: 0,
        menus: defaultMenu,
        tags: [],
        totalArticles: 0,
        meta: defaultMeta,
      };
    }
    return data;
  } catch (err) {
    if (process.env.isBuild == "t") {
      console.log("Failed to connect, using default values");
      // 给一个默认的吧。
      return {
        version: version,
        totalWordCount: 0,
        tags: [],
        menus: defaultMenu,
        totalArticles: 0,
        meta: defaultMeta,
      };
    } else {
      throw err;
    }
  }
}
export async function getAllCustomPages(): Promise<CustomPageList[]> {
  try {
    const url = `${config.baseUrl}api/public/customPage/all`;
    const res = await fetch(url);
    const { statusCode, data } = await res.json();
    if (statusCode == 200) {
      return data;
    } else {
      return [];
    }
  } catch (err) {
    if (process.env.isBuild == "t") {
      console.log("鏃犳硶杩炴帴锛岄噰鐢ㄩ粯璁ゅ€�");
      // 缁欎竴涓�榛樿�ょ殑鍚с€�
      return [];
    } else {
      throw err;
    }
  }
}
export async function getCustomPageByPath(
  path: string
): Promise<CustomPage | null> {
  try {
    const url = `${config.baseUrl}api/public/customPage?path=${path}`;
    const res = await fetch(url);
    const { statusCode, data } = await res.json();
    if (statusCode == 200) {
      return data;
    } else {
      return null;
    }
  } catch (err) {
    if (process.env.isBuild == "t") {
      console.log("鏃犳硶杩炴帴锛岄噰鐢ㄩ粯璁ゅ€�");
      // 缁欎竴涓�榛樿�ょ殑鍚с€�
      return null;
    } else {
      throw err;
    }
  }
}

// 图标相关接口
export interface IconItem {
  name: string;
  type: 'preset' | 'custom';
  iconUrl: string;
  iconUrlDark?: string;
  presetIconType?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export async function getAllIcons(): Promise<IconItem[]> {
  try {
    const url = `/api/public/icon`;
    const res = await fetch(url);
    const { statusCode, data } = await res.json();
    if (statusCode == 200) {
      return data;
    } else {
      return [];
    }
  } catch (err) {
    if (process.env.isBuild == "t") {
      console.log("Failed to get icons, using default values");
      return [];
    } else {
      throw err;
    }
  }
}

export async function getIconByName(name: string): Promise<IconItem | null> {
  try {
    const url = `/api/public/icon/${name}`;
    const res = await fetch(url);
    const { statusCode, data } = await res.json();
    if (statusCode == 200) {
      return data;
    } else {
      return null;
    }
  } catch (err) {
    if (process.env.isBuild == "t") {
      console.log("Failed to get icon, using default value");
      return null;
    } else {
      throw err;
    }
  }
}

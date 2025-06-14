import { MenuItem } from './menu.dto';

export const defaultStaticSetting: StaticSetting = {
  storageType: 'local',
  picgoConfig: null,
  enableWaterMark: false,
  enableWebp: true,
  waterMarkText: null,
  picgoPlugins: null,
};

export type SettingType =
  | 'static'
  | 'https'
  | 'waline'
  | 'layout'
  | 'login'
  | 'menu'
  | 'version'
  | 'isr'
  | 'adminLayout'
  | 'autoBackup';

export type SettingValue =
  | StaticSetting
  | HttpsSetting
  | WalineSetting
  | LayoutSetting
  | VersionSetting
  | ISRSetting
  | AdminLayoutSetting
  | AutoBackupSetting;

export interface ISRSetting {
  mode: 'delay' | 'onDemand';
  delay: number;
}

export interface MenuSetting {
  data: MenuItem[];
}

export type StorageType = 'picgo' | 'local';
export type StaticType = 'img' | 'customPage';
export interface LoginSetting {
  enableMaxLoginRetry: boolean;
  maxRetryTimes: number;
  durationSeconds: number;
  expiresIn: number;
}
export interface VersionSetting {
  version: string;
}

// export interface ScriptItem {
//   type: 'code' | 'link';
//   value: string;
// }

export interface LayoutSetting {
  script: string;
  html: string;
  css: string;
  head: string;
}

export interface HeadTag {
  name: string;
  props: Record<string, string>;
  conent: string;
}

export interface WalineSetting {
  'smtp.enabled': boolean;
  'smtp.port': number;
  'smtp.host': string;
  'smtp.user': string;
  'smtp.password': string;
  'sender.name': string;
  'sender.email': string;
  authorEmail: string;
  webhook?: string;
  forceLoginComment: boolean;
  otherConfig?: string;
}

export interface HttpsSetting {
  redirect: boolean;
}
export interface SearchStaticOption {
  staticType: StaticType;
  page: number;
  pageSize: number;
  view: 'admin' | 'public';
}
export const StoragePath: Record<StaticType, string> = {
  img: `img`,
  customPage: `customPage`,
};
export class StaticSetting {
  storageType: StorageType;
  picgoConfig: any;
  picgoPlugins: string;
  enableWaterMark: boolean;
  waterMarkText: string;
  enableWebp: boolean;
}

export interface AdminLayoutSetting {
  menuItems: AdminMenuItem[];
}

export interface AdminMenuItem {
  key: string;
  name: string;
  originalName: string;
  icon: string;
  path: string;
  order: number;
  visible: boolean;
}

export const defaultAdminLayoutSetting: AdminLayoutSetting = {
  menuItems: [
    {
      key: 'welcome',
      name: '分析概览',
      originalName: '分析概览',
      icon: 'smile',
      path: '/welcome',
      order: 0,
      visible: true,
    },
    {
      key: 'article',
      name: '文章管理',
      originalName: '文章管理',
      icon: 'form',
      path: '/article',
      order: 1,
      visible: true,
    },
    {
      key: 'moment',
      name: '动态管理',
      originalName: '动态管理',
      icon: 'message',
      path: '/moment',
      order: 2,
      visible: true,
    },
    {
      key: 'nav',
      name: '导航管理',
      originalName: '导航管理',
      icon: 'compass',
      path: '/nav',
      order: 3,
      visible: true,
    },
    {
      key: 'draft',
      name: '草稿管理',
      originalName: '草稿管理',
      icon: 'container',
      path: '/draft',
      order: 4,
      visible: true,
    },
    {
      key: 'static',
      name: '图片管理',
      originalName: '图片管理',
      icon: 'picture',
      path: '/static/img',
      order: 5,
      visible: true,
    },
    {
      key: 'site',
      name: '站点管理',
      originalName: '站点管理',
      icon: 'tool',
      path: '/site',
      order: 6,
      visible: true,
    },
  ],
};

export interface AutoBackupSetting {
  enabled: boolean;
  backupTime: string; // 格式：'03:00' 表示凌晨3点
  retentionCount: number; // 保留最新的多少个备份文件
}

export const defaultAutoBackupSetting: AutoBackupSetting = {
  enabled: false,
  backupTime: '03:00',
  retentionCount: 10,
};

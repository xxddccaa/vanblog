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
  | 'autoBackup'
  | 'music';

export type SettingValue =
  | StaticSetting
  | HttpsSetting
  | WalineSetting
  | LayoutSetting
  | VersionSetting
  | ISRSetting
  | AdminLayoutSetting
  | AutoBackupSetting
  | MusicSetting;

export interface ISRSetting {
  mode: 'delay' | 'onDemand';
  delay: number;
}

export interface MenuSetting {
  data: MenuItem[];
}

export type StorageType = 'picgo' | 'local';
export type StaticType = 'img' | 'customPage' | 'music';
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
  animations?: AnimationSettings;
}

export interface AnimationSettings {
  enabled: boolean;
  snowflake?: SnowflakeConfig;
  particles?: ParticleConfig;
  heartClick?: HeartClickConfig;
  mouseDrag?: MouseDragConfig;
}

export interface SnowflakeConfig {
  enabled: boolean;
  color: string;
  count: number;
  speed: number;
  size: number;
}

export interface ParticleConfig {
  enabled: boolean;
  color: string;
  darkColor: string; // 暗色主题下的颜色
  count: number;
  opacity: number; // 透明度
  zIndex: number; // 层级
}

export interface HeartClickConfig {
  enabled: boolean;
}

export interface MouseDragConfig {
  enabled: boolean;
  color: string;
  darkColor: string;
  particleCount: number;
  particleSize: number;
  trailLength: number;
  speed: number;
  opacity: number;
  intensity: number;
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
  music: `music`,
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
      key: 'document',
      name: '私密文档',
      originalName: '私密文档',
      icon: 'folder',
      path: '/document',
      order: 5,
      visible: true,
    },
    {
      key: 'mindmap',
      name: '思维导图',
      originalName: '思维导图',
      icon: 'apartment',
      path: '/mindmap',
      order: 6,
      visible: true,
    },
    {
      key: 'static',
      name: '图片管理',
      originalName: '图片管理',
      icon: 'picture',
      path: '/static/img',
      order: 7,
      visible: true,
    },
    {
      key: 'site',
      name: '站点管理',
      originalName: '站点管理',
      icon: 'tool',
      path: '/site',
      order: 8,
      visible: true,
    },
  ],
};

export interface AutoBackupSetting {
  enabled: boolean;
  backupTime: string; // 格式：'03:00' 表示凌晨3点
  retentionCount: number; // 保留最新的多少个备份文件
  // 阿里云盘相关配置
  aliyunpan: {
    enabled: boolean; // 是否启用阿里云盘备份
    syncTime: string; // 阿里云盘同步时间，格式：'03:30'
    localPath: string; // 本地备份路径
    panPath: string; // 云盘路径
  };
}

export const defaultAutoBackupSetting: AutoBackupSetting = {
  enabled: false,
  backupTime: '03:00',
  retentionCount: 10,
  aliyunpan: {
    enabled: false,
    syncTime: '03:30',
    localPath: '/app/static',
    panPath: '/backup/vanblog-static',
  },
};

export interface MusicSetting {
  enabled: boolean; // 是否启用音乐功能
  showControl: boolean; // 是否显示音乐控制器
  autoPlay: boolean; // 是否自动播放
  loop: boolean; // 是否循环播放
  volume: number; // 音量 0-100
  currentPlaylist: string[]; // 当前播放列表
  currentIndex: number; // 当前播放的歌曲索引
}

export const defaultMusicSetting: MusicSetting = {
  enabled: false,
  showControl: true,
  autoPlay: false,
  loop: true,
  volume: 50,
  currentPlaylist: [],
  currentIndex: 0,
};

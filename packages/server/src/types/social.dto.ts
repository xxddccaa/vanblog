// 预设图标类型
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

// 兼容旧版本，保留原有的SocialType
export type SocialType = 'bilibili' | 'email' | 'github' | 'gitee' | 'wechat' | 'wechat-dark';

export class SocialItem {
  updatedAt: Date;
  value: string;
  type: SocialType; // 保留兼容性
  
  // 新增字段
  displayName?: string; // 显示名称，如 "GitHub"、"邮箱"等
  iconType?: PresetIconType; // 图标类型，默认使用type值
  customIconUrl?: string; // 自定义图标URL
  customIconUrlDark?: string; // 自定义图标URL（暗色模式）
  linkType?: 'link' | 'email' | 'qrcode'; // 链接类型
  darkValue?: string; // 暗色模式下的值（主要用于微信二维码）
  iconName?: string; // 图标管理中的图标名称
}

export class SocialDto {
  value: string;
  type: SocialType; // 保留兼容性
  
  // 新增字段
  displayName?: string;
  iconType?: PresetIconType;
  customIconUrl?: string;
  customIconUrlDark?: string;
  linkType?: 'link' | 'email' | 'qrcode';
  darkValue?: string;
  iconName?: string; // 图标管理中的图标名称
}

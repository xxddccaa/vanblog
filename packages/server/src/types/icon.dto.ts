export class IconDto {
  name: string; // 图标名称，如 "wechat-qr-1"
  type: 'preset' | 'custom'; // 预设图标或自定义图标
  usage?: 'nav' | 'social'; // 图标用途：导航或社交
  iconUrl: string; // 图标URL（浅色主题）
  iconUrlDark?: string; // 图标URL（深色主题，可选）
  presetIconType?: string; // 预设图标类型（如果是预设图标）
  description?: string; // 图标描述
}

export class IconItem {
  name: string;
  type: 'preset' | 'custom';
  usage?: 'nav' | 'social'; // 图标用途：导航或社交
  iconUrl: string;
  iconUrlDark?: string;
  presetIconType?: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
} 
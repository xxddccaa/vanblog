import { Alert, Card, Col, Input, Row, Select, Typography } from 'antd';

const { Text, Paragraph } = Typography;

// 定义预置主题列表（只包含 vanblog 适配过的主题：已做亮/暗包裹，且样式范围只影响 Markdown 容器）
const PRESET_THEMES = {
  light: [
    { value: '__vanblog_plain__', label: 'Vanblog Plain（朴素/经典）', description: '不加载额外主题，只用系统自带 GitHub 风格（推荐给喜欢朴素的人）' },
    { value: '/markdown-themes/vanblog-minimal-light-only.css', label: 'Vanblog Minimal（舒适·极简）', description: '低噪点/低刺激/轻强调（仅亮色）' },
    { value: '/markdown-themes/vanblog-sepia-light-only.css', label: 'Vanblog Sepia Book（舒适·暖纸张）', description: '书籍感/衬线/更柔和对比（仅亮色）' },
    { value: '/markdown-themes/vanblog-nord-light-only.css', label: 'Vanblog Nord（舒适·北欧）', description: '低饱和冷静配色（仅亮色）' },
    { value: '/markdown-themes/vanblog-candy-light-only.css', label: 'Vanblog Candy（糖果风）', description: '点阵纸背景 + 糖果条纹标题 + 卡片引用/代码块（仅亮色）' },
    { value: '/markdown-themes/vanblog-notebook-light-only.css', label: 'Vanblog Notebook（手帐横线纸）', description: '横线纸 + 胶带标题 + 便签引用（仅亮色）' },
    { value: '/markdown-themes/vanblog-glass-light-only.css', label: 'Vanblog Glass（玻璃拟态）', description: '玻璃卡片 + 渐变光晕背景（仅亮色）' },
    { value: '/markdown-themes/vanblog-glitch-light-only.css', label: 'Vanblog Glitch（赛博故障）', description: '噪点/扫描线/错位阴影/抖动（仅亮色）' },
    { value: '/markdown-themes/vanblog-pixel-light-only.css', label: 'Vanblog Pixel（像素风）', description: '8-bit 像素边框 + 方块标题（仅亮色）' },
    { value: '/markdown-themes/vanblog-newspaper-light-only.css', label: 'Vanblog Newspaper（复古报纸）', description: '衬线排版 + 首字下沉 + 装饰分割线（仅亮色）' },
    { value: '/markdown-themes/vanblog-vaporwave-light-only.css', label: 'Vanblog Vaporwave（蒸汽波渐变）', description: '网格日落 + 霓虹渐变标题（仅亮色）' },
    { value: '/markdown-themes/vanblog-hologram-light-only.css', label: 'Vanblog Hologram（冲击·全息虹彩）', description: '虹彩折射/光斑/3D卡片（仅亮色）' },
    { value: '/markdown-themes/vanblog-bloodmoon-light-only.css', label: 'Vanblog Blood Moon（冲击·深红月蚀）', description: '深红强调 + 月蚀氛围（仅亮色）' },
    { value: '/markdown-themes/phycat-cherry-light-only.css', label: 'Phycat Cherry（樱桃粉）', description: '温暖的樱桃粉色调，适合亮色模式' },
    { value: '/markdown-themes/phycat-sky-light-only.css', label: 'Phycat Sky（天空蓝）', description: '清新的天空蓝色调（仅亮色）' },
    { value: '/markdown-themes/phycat-forest-light-only.css', label: 'Phycat Forest（森林绿）', description: '自然的森林绿色调（仅亮色）' },
    { value: '/markdown-themes/phycat-sakura-light-only.css', label: 'Phycat Sakura（樱花粉）', description: '优雅的樱花粉色调（仅亮色）' },
    { value: '/markdown-themes/phycat-mint-light-only.css', label: 'Phycat Mint（薄荷绿）', description: '清爽的薄荷绿色调（仅亮色）' },
    { value: '/markdown-themes/phycat-caramel-light-only.css', label: 'Phycat Caramel（焦糖色）', description: '温暖的焦糖色调（仅亮色）' },
    { value: '/markdown-themes/phycat-mauve-light-only.css', label: 'Phycat Mauve（紫罗兰）', description: '优雅的紫罗兰色调（仅亮色）' },
    { value: '/markdown-themes/phycat-prussian-light-only.css', label: 'Phycat Prussian（普鲁士蓝）', description: '深沉的普鲁士蓝色调（仅亮色）' },
    { value: '/markdown-themes/vanblog-paper-light-only.css', label: 'Vanblog Paper（纸张蓝）', description: '清爽的纸张/蓝色系（仅亮色）' },
    { value: '/markdown-themes/vanblog-latte-light-only.css', label: 'Vanblog Latte（拿铁米黄）', description: '温暖的米黄色/拿铁系（仅亮色）' },
    { value: '', label: '系统默认', description: '使用 GitHub 风格的 Markdown 样式' },
  ],
  dark: [
    { value: '__vanblog_plain__', label: 'Vanblog Plain（朴素/经典）', description: '不加载额外主题，只用系统自带 GitHub 风格（推荐给喜欢朴素的人）' },
    { value: '/markdown-themes/vanblog-minimal-dark-only.css', label: 'Vanblog Minimal（舒适·极简）', description: '低刺激暗色/轻强调（仅暗色）' },
    { value: '/markdown-themes/vanblog-sepia-dark-only.css', label: 'Vanblog Sepia Book（舒适·暖暗纸）', description: '暖暗纸/护眼/书籍感（仅暗色）' },
    { value: '/markdown-themes/vanblog-nord-dark-only.css', label: 'Vanblog Nord（舒适·北欧）', description: '北欧暗色/低刺激层次（仅暗色）' },
    { value: '/markdown-themes/vanblog-neon-dark-only.css', label: 'Vanblog Neon（赛博霓虹）', description: '霓虹发光标题 + 玻璃面板 + 渐变光晕（仅暗色）' },
    { value: '/markdown-themes/vanblog-midnight-dark-only.css', label: 'Vanblog Midnight（午夜星空）', description: '星点背景 + 克制线条标题（仅暗色）' },
    { value: '/markdown-themes/vanblog-terminal-dark-only.css', label: 'Vanblog Terminal（终端风）', description: '终端/命令行风格的标题与引用（仅暗色）' },
    { value: '/markdown-themes/vanblog-glitch-dark-only.css', label: 'Vanblog Glitch（赛博故障）', description: '噪点/扫描线/错位阴影/抖动（仅暗色）' },
    { value: '/markdown-themes/vanblog-pixel-dark-only.css', label: 'Vanblog Pixel（像素风）', description: '8-bit 像素边框 + CRT 扫描线（仅暗色）' },
    { value: '/markdown-themes/vanblog-newspaper-dark-only.css', label: 'Vanblog Newspaper（复古报纸）', description: '暗色报纸：墨水在炭纸上（仅暗色）' },
    { value: '/markdown-themes/vanblog-vaporwave-dark-only.css', label: 'Vanblog Vaporwave（蒸汽波渐变）', description: '暗色蒸汽波：霓虹渐变与网格（仅暗色）' },
    { value: '/markdown-themes/vanblog-hologram-dark-only.css', label: 'Vanblog Hologram（冲击·全息虹彩）', description: '暗色全息虹彩（仅暗色）' },
    { value: '/markdown-themes/vanblog-bloodmoon-dark-only.css', label: 'Vanblog Blood Moon（冲击·深红月蚀）', description: '暗色月蚀/深红光晕（仅暗色）' },
    { value: '/markdown-themes/phycat-dark-only.css', label: 'Phycat Dark（深色樱桃）', description: '深色模式的樱桃粉色调' },
    { value: '/markdown-themes/phycat-sky-dark-only.css', label: 'Phycat Sky Dark（深海蓝）', description: '深色天空蓝配色（仅暗色）' },
    { value: '/markdown-themes/phycat-forest-dark-only.css', label: 'Phycat Forest Dark（深林绿）', description: '深色森林绿配色（仅暗色）' },
    { value: '/markdown-themes/phycat-sakura-dark-only.css', label: 'Phycat Sakura Dark（夜樱粉）', description: '深色樱花粉配色（仅暗色）' },
    { value: '/markdown-themes/phycat-mint-dark-only.css', label: 'Phycat Mint Dark（深薄荷青）', description: '深色薄荷青配色（仅暗色）' },
    { value: '/markdown-themes/phycat-caramel-dark-only.css', label: 'Phycat Caramel Dark（深焦糖）', description: '深色焦糖配色（仅暗色）' },
    { value: '/markdown-themes/phycat-mauve-dark-only.css', label: 'Phycat Mauve Dark（深紫罗兰）', description: '深色紫罗兰配色（仅暗色）' },
    { value: '/markdown-themes/phycat-prussian-dark-only.css', label: 'Phycat Prussian Dark（深普鲁士蓝）', description: '深色普鲁士蓝配色（仅暗色）' },
    { value: '/markdown-themes/vanblog-aurora-dark-only.css', label: 'Vanblog Aurora（极光紫青）', description: '更活泼的紫青渐变（仅暗色）' },
    { value: '/markdown-themes/vanblog-graphite-dark-only.css', label: 'Vanblog Graphite（石墨灰）', description: '克制耐看的中性暗色（仅暗色）' },
    { value: '', label: '系统默认', description: '使用 GitHub 风格的 Markdown 样式' },
  ],
};

export default function MarkdownThemeSelector(props: {
  value?: {
    markdownLightThemeUrl?: string;
    markdownDarkThemeUrl?: string;
    markdownLightThemePreset?: string;
    markdownDarkThemePreset?: string;
  };
  onChange?: (value: any) => void;
}) {
  const { value = {}, onChange } = props;

  const normalizePreset = (p?: string) => (p === '__vanblog_plain__' ? '' : p);
  const normalizeUrl = (u?: string) => (u === '__vanblog_plain__' ? '' : u);

  const effectiveLight =
    normalizeUrl(value.markdownLightThemeUrl) ||
    normalizePreset(value.markdownLightThemePreset) ||
    '/markdown-themes/phycat-cherry-light-only.css';
  const effectiveDark =
    normalizeUrl(value.markdownDarkThemeUrl) ||
    normalizePreset(value.markdownDarkThemePreset) ||
    '/markdown-themes/phycat-dark-only.css';

  return (
    <div style={{ padding: '16px 0' }}>
      <Alert
        message="主题设置说明"
        description={
          <div>
            <Paragraph>
              1. 可以选择预置主题，也可以自定义 CSS 文件路径
            </Paragraph>
            <Paragraph>
              2. 如果自定义路径和预设都设置了，优先使用自定义路径
            </Paragraph>
            <Paragraph>
              3. 需要在「站点配置 - 布局设置」中开启客制化功能才能生效
            </Paragraph>
          </div>
        }
        type="info"
        style={{ marginBottom: 24 }}
        showIcon
      />

      <Row gutter={[24, 24]}>
        <Col span={12}>
          <Card title="☀️ 亮色主题" size="small">
            <div style={{ marginBottom: 12 }}>
              <div style={{ marginBottom: 6 }}>选择预设主题</div>
              <Select
                value={value.markdownLightThemePreset ?? ''}
                placeholder="请选择亮色主题"
                style={{ width: '100%' }}
                showSearch
                optionFilterProp="label"
                options={PRESET_THEMES.light}
                onChange={(val) => {
                  const v = val === '__vanblog_plain__' ? '' : val;
                  onChange?.({
                    ...value,
                    markdownLightThemePreset: v,
                    // 选预置 => 清空自定义URL，避免互相覆盖导致“暗色回默认”等问题
                    markdownLightThemeUrl: '',
                  });
                }}
              />
            </div>

            <div style={{ marginBottom: 6 }}>或自定义 CSS 路径</div>
            <Input
              placeholder="/markdown-themes/your-theme.css"
              value={value.markdownLightThemeUrl || ''}
              onChange={(e) => {
                const url = e.target.value;
                onChange?.({
                  ...value,
                  markdownLightThemeUrl: url,
                  // 填自定义 => 清空预置
                  markdownLightThemePreset: url ? '' : value.markdownLightThemePreset,
                });
              }}
            />

            <div style={{ marginTop: 8 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                当前生效：{effectiveLight}
              </Text>
            </div>
          </Card>
        </Col>

        <Col span={12}>
          <Card title="🌙 暗色主题" size="small">
            <div style={{ marginBottom: 12 }}>
              <div style={{ marginBottom: 6 }}>选择预设主题</div>
              <Select
                value={value.markdownDarkThemePreset ?? ''}
                placeholder="请选择暗色主题"
                style={{ width: '100%' }}
                showSearch
                optionFilterProp="label"
                options={PRESET_THEMES.dark}
                onChange={(val) => {
                  const v = val === '__vanblog_plain__' ? '' : val;
                  onChange?.({
                    ...value,
                    markdownDarkThemePreset: v,
                    markdownDarkThemeUrl: '',
                  });
                }}
              />
            </div>

            <div style={{ marginBottom: 6 }}>或自定义 CSS 路径</div>
            <Input
              placeholder="/markdown-themes/your-dark-theme.css"
              value={value.markdownDarkThemeUrl || ''}
              onChange={(e) => {
                const url = e.target.value;
                onChange?.({
                  ...value,
                  markdownDarkThemeUrl: url,
                  markdownDarkThemePreset: url ? '' : value.markdownDarkThemePreset,
                });
              }}
            />

            <div style={{ marginTop: 8 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                当前生效：{effectiveDark}
              </Text>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}


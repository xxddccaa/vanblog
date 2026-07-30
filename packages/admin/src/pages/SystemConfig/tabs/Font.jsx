import { getFontSetting, updateFontSetting } from '@/services/van-blog/api';
import UploadBtn from '@/components/UploadBtn';
import {
  Alert,
  Button,
  Card,
  Input,
  message,
  Popconfirm,
  Radio,
  Select,
  Space,
  Spin,
  Table,
  Typography,
} from 'antd';
import { useEffect, useMemo, useState } from 'react';

const { Text, Paragraph } = Typography;

// 内置字体注册表（与前台 FontStyle 的 PRESET_*_FONTS 保持一致）
const CN_FONTS = [
  { value: 'system', label: '系统默认（不下载）', family: null },
  { value: 'lxgw', label: '霞鹜文楷', family: 'LXGW WenKai', href: '/fonts/preset/lxgw/index.css' },
  { value: 'misans', label: 'MiSans（近苹方）', family: 'MiSans', href: '/fonts/preset/misans/index.css' },
  { value: 'songti', label: '思源宋体', family: 'Source Han Serif SC', href: '/fonts/preset/songti/index.css' },
];
const EN_FONTS = [
  { value: 'system', label: '系统默认（不下载）', family: null },
  { value: 'ebgaramond', label: 'EB Garamond', family: 'EB Garamond', href: '/fonts/preset/ebg/index.css' },
  { value: 'inter', label: 'Inter', family: 'Inter', href: '/fonts/preset/inter/index.css' },
  { value: 'jetbrains', label: 'JetBrains Mono', family: 'JetBrains Mono', href: '/fonts/preset/jetbrains/index.css' },
];
const SYSTEM_FALLBACK =
  '"PingFang SC", "Microsoft YaHei", -apple-system, system-ui, sans-serif';

const findFont = (list, value) => list.find((f) => f.value === value) || list[0];

const EXT_FORMAT = { woff2: 'woff2', woff: 'woff', ttf: 'truetype', otf: 'opentype' };
const guessFormat = (src) => EXT_FORMAT[(src || '').split('.').pop()?.toLowerCase()] || undefined;
const stemFromSrc = (src) => {
  const file = (src || '').split('/').pop() || '';
  const parts = file.split('.');
  return parts.length >= 3 ? parts.slice(1, -1).join('.') : parts[0] || 'MyFont';
};

const PREVIEW_TEXT = '春江潮水连海平，海上明月共潮生。The quick brown fox 0123456789';

export default function FontTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [mode, setMode] = useState('off');
  const [scope, setScope] = useState('body');
  const [cnFont, setCnFont] = useState('system');
  const [enFont, setEnFont] = useState('system');
  const [fontFamily, setFontFamily] = useState('');
  const [faces, setFaces] = useState([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data } = await getFontSetting();
      setMode(data?.mode || 'off');
      setScope(data?.scope || 'body');
      setCnFont(data?.cnFont || 'system');
      setEnFont(data?.enFont || 'system');
      setFontFamily(data?.fontFamily || '');
      setFaces(Array.isArray(data?.faces) ? data.faces : []);
    } catch (err) {
      message.error('加载字体设置失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onSave = async () => {
    setSaving(true);
    try {
      await updateFontSetting({ mode, scope, cnFont, enFont, fontFamily, faces });
      message.success('字体设置已保存，前台刷新后生效');
    } catch (err) {
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const onUploadFinish = (info) => {
    const src = info?.response?.data?.src;
    if (!src) {
      message.error('字体上传失败');
      return;
    }
    const family = stemFromSrc(src);
    const face = { family, src, weight: 'normal', style: 'normal', format: guessFormat(src) };
    setFaces((prev) => {
      if (prev.some((f) => f.src === src)) {
        message.warning('该字体已在列表中');
        return prev;
      }
      return [...prev, face];
    });
    setFontFamily((prev) =>
      prev && prev.trim() ? prev : `"${family}", ${SYSTEM_FALLBACK}`,
    );
    message.success('字体上传成功');
  };

  const updateFace = (index, patch) =>
    setFaces((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  const removeFace = (index) => setFaces((prev) => prev.filter((_, i) => i !== index));

  // 预览需要的 @font-face / <link>
  const previewLinks = useMemo(() => {
    if (mode !== 'preset') return [];
    const links = [];
    const en = findFont(EN_FONTS, enFont).href;
    const cn = findFont(CN_FONTS, cnFont).href;
    if (en) links.push(en);
    if (cn) links.push(cn);
    return links;
  }, [mode, cnFont, enFont]);

  const previewFontFaceCss = useMemo(() => {
    if (mode !== 'custom') return '';
    return faces
      .filter((f) => f.family && f.src)
      .map(
        (f) =>
          `@font-face{font-family:"${f.family}";src:url("${f.src}")${
            f.format ? ` format("${f.format}")` : ''
          };font-weight:${f.weight || 'normal'};font-style:${f.style || 'normal'};font-display:swap;}`,
      )
      .join('\n');
  }, [mode, faces]);

  const previewFamily = useMemo(() => {
    if (mode === 'preset') {
      const en = findFont(EN_FONTS, enFont).family;
      const cn = findFont(CN_FONTS, cnFont).family;
      const parts = [];
      if (en) parts.push(`"${en}"`);
      if (cn) parts.push(`"${cn}"`);
      return parts.length ? `${parts.join(', ')}, ${SYSTEM_FALLBACK}` : 'inherit';
    }
    if (mode === 'custom') return fontFamily || 'inherit';
    return 'inherit';
  }, [mode, cnFont, enFont, fontFamily]);

  const columns = [
    {
      title: 'font-family 名',
      dataIndex: 'family',
      render: (v, _r, i) => (
        <Input value={v} size="small" onChange={(e) => updateFace(i, { family: e.target.value })} />
      ),
    },
    {
      title: '字重',
      dataIndex: 'weight',
      width: 110,
      render: (v, _r, i) => (
        <Input value={v} size="small" placeholder="normal" onChange={(e) => updateFace(i, { weight: e.target.value })} />
      ),
    },
    {
      title: '样式',
      dataIndex: 'style',
      width: 110,
      render: (v, _r, i) => (
        <Input value={v} size="small" placeholder="normal" onChange={(e) => updateFace(i, { style: e.target.value })} />
      ),
    },
    {
      title: '文件',
      dataIndex: 'src',
      ellipsis: true,
      render: (v) => (
        <Text type="secondary" style={{ fontSize: 12 }} copyable={{ text: v }}>
          {v}
        </Text>
      ),
    },
    {
      title: '操作',
      width: 70,
      render: (_v, _r, i) => (
        <Popconfirm title="从列表移除该字体？" onConfirm={() => removeFace(i)}>
          <a>移除</a>
        </Popconfirm>
      ),
    },
  ];

  if (loading) {
    return (
      <div style={{ padding: '24px 0', textAlign: 'center' }}>
        <Spin />
      </div>
    );
  }

  return (
    <Card>
      {previewLinks.map((href) => (
        <link key={href} rel="stylesheet" href={href} />
      ))}
      {previewFontFaceCss ? <style dangerouslySetInnerHTML={{ __html: previewFontFaceCss }} /> : null}

      <Alert
        style={{ marginBottom: 16 }}
        type="info"
        message="前台字体设置"
        description="三选一：维持原样不改动；内置预设按中英分别挑选字体（按需加载、翻页不再请求）；自定义上传使用你自己的字体文件。某一侧选“系统默认”即维持该语言原本的字体。"
      />

      <div style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 8, fontWeight: 500 }}>字体模式</div>
        <Radio.Group value={mode} onChange={(e) => setMode(e.target.value)}>
          <Radio.Button value="off">维持原样</Radio.Button>
          <Radio.Button value="preset">内置预设</Radio.Button>
          <Radio.Button value="custom">自定义上传</Radio.Button>
        </Radio.Group>
      </div>

      {mode !== 'off' && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>作用范围</div>
          <Radio.Group value={scope} onChange={(e) => setScope(e.target.value)}>
            <Radio.Button value="body">仅文章正文</Radio.Button>
            <Radio.Button value="site">全站</Radio.Button>
          </Radio.Group>
        </div>
      )}

      {mode === 'preset' && (
        <div style={{ marginBottom: 16 }}>
          <Space size="large" wrap>
            <div>
              <div style={{ marginBottom: 8, fontWeight: 500 }}>中文字体</div>
              <Select
                value={cnFont}
                style={{ width: 220 }}
                onChange={setCnFont}
                options={CN_FONTS.map((f) => ({ value: f.value, label: f.label }))}
              />
            </div>
            <div>
              <div style={{ marginBottom: 8, fontWeight: 500 }}>英文/数字字体</div>
              <Select
                value={enFont}
                style={{ width: 220 }}
                onChange={setEnFont}
                options={EN_FONTS.map((f) => ({ value: f.value, label: f.label }))}
              />
            </div>
          </Space>
          <Paragraph type="secondary" style={{ fontSize: 12, marginTop: 8 }}>
            英文命中英文字体、中文命中中文字体（浏览器按字形回退）。任一侧选“系统默认”即该语言保持原样、零下载。
          </Paragraph>
        </div>
      )}

      {mode === 'custom' && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>上传字体文件</div>
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <UploadBtn
              muti={false}
              setLoading={setUploading}
              loading={uploading}
              text="上传字体（woff2 / woff / ttf / otf）"
              url="/api/admin/font/upload"
              accept=".woff2,.woff,.ttf,.otf"
              onFinish={onUploadFinish}
            />
            <Alert
              type="warning"
              message="大字体请先转 woff2 或子集化"
              description="上传什么用什么：整份大中文字体（如未压缩的 ttf）访客首次会整份下载（此后长期缓存、翻页不再请求）。中文字体建议先子集化为 woff2 再上传。"
            />
            {faces.length > 0 && (
              <Table size="small" rowKey={(r) => r.src} columns={columns} dataSource={faces} pagination={false} />
            )}
            <div>
              <div style={{ marginBottom: 8, fontWeight: 500 }}>font-family 字体栈</div>
              <Input.TextArea
                value={fontFamily}
                onChange={(e) => setFontFamily(e.target.value)}
                autoSize={{ minRows: 2, maxRows: 4 }}
                placeholder={'例如："MyFont", "PingFang SC", -apple-system, sans-serif'}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                前面放英文/拉丁字体、后面放中文字体即可实现“英文用 A、中文用 B”。
              </Text>
            </div>
          </Space>
        </div>
      )}

      {mode !== 'off' && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>预览</div>
          <div
            style={{
              fontFamily: previewFamily,
              border: '1px dashed #d9d9d9',
              borderRadius: 6,
              padding: 16,
              fontSize: 20,
              lineHeight: 1.8,
            }}
          >
            {PREVIEW_TEXT}
          </div>
        </div>
      )}

      <Button type="primary" loading={saving} onClick={onSave}>
        保存
      </Button>
    </Card>
  );
}

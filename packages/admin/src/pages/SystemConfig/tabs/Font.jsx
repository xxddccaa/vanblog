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
  Space,
  Spin,
  Table,
  Typography,
} from 'antd';
import { useEffect, useMemo, useState } from 'react';

const { Text, Paragraph } = Typography;

// 内置预设的 font-family 栈（与前台 FontStyle 保持一致）
const PRESET_FONT_FAMILY =
  '"EB Garamond", "LXGW WenKai", "PingFang SC", "Microsoft YaHei", -apple-system, system-ui, sans-serif';

const EXT_FORMAT = {
  woff2: 'woff2',
  woff: 'woff',
  ttf: 'truetype',
  otf: 'opentype',
};

function guessFormat(src) {
  const ext = (src || '').split('.').pop()?.toLowerCase();
  return EXT_FORMAT[ext] || undefined;
}

function stemFromSrc(src) {
  // /static/font/<md5>.<stem>.<ext> → <stem>
  const file = (src || '').split('/').pop() || '';
  const parts = file.split('.');
  if (parts.length >= 3) {
    return parts.slice(1, -1).join('.');
  }
  return parts[0] || 'MyFont';
}

const PREVIEW_TEXT = '中文字体预览 The quick brown fox 0123456789';

export default function FontTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [mode, setMode] = useState('off');
  const [scope, setScope] = useState('body');
  const [fontFamily, setFontFamily] = useState('');
  const [faces, setFaces] = useState([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data } = await getFontSetting();
      setMode(data?.mode || 'off');
      setScope(data?.scope || 'body');
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
      await updateFontSetting({ mode, scope, fontFamily, faces });
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
    // 首个字体自动填入 font-family 栈
    setFontFamily((prev) =>
      prev && prev.trim()
        ? prev
        : `"${family}", "PingFang SC", "Microsoft YaHei", -apple-system, system-ui, sans-serif`,
    );
    message.success('字体上传成功');
  };

  const updateFace = (index, patch) => {
    setFaces((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  };

  const removeFace = (index) => {
    setFaces((prev) => prev.filter((_, i) => i !== index));
  };

  // 预览用：为自定义字体注入 @font-face（src 与前台同源 /static/font/...）
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
    if (mode === 'preset') return PRESET_FONT_FAMILY;
    if (mode === 'custom') return fontFamily || 'inherit';
    return 'inherit';
  }, [mode, fontFamily]);

  const columns = [
    {
      title: 'font-family 名',
      dataIndex: 'family',
      render: (v, _row, index) => (
        <Input
          value={v}
          size="small"
          onChange={(e) => updateFace(index, { family: e.target.value })}
        />
      ),
    },
    {
      title: '字重',
      dataIndex: 'weight',
      width: 110,
      render: (v, _row, index) => (
        <Input
          value={v}
          size="small"
          placeholder="normal"
          onChange={(e) => updateFace(index, { weight: e.target.value })}
        />
      ),
    },
    {
      title: '样式',
      dataIndex: 'style',
      width: 110,
      render: (v, _row, index) => (
        <Input
          value={v}
          size="small"
          placeholder="normal"
          onChange={(e) => updateFace(index, { style: e.target.value })}
        />
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
      render: (_v, _row, index) => (
        <Popconfirm title="从列表移除该字体？" onConfirm={() => removeFace(index)}>
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
      {previewFontFaceCss ? (
        <style dangerouslySetInnerHTML={{ __html: previewFontFaceCss }} />
      ) : null}

      <Alert
        style={{ marginBottom: 16 }}
        type="info"
        message="前台字体设置"
        description="三选一：维持原样不改动；内置预设一键启用霞鹜文楷+EB Garamond（随包自带、按需加载）；自定义上传使用你自己的字体文件。"
      />

      <div style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 8, fontWeight: 500 }}>字体模式</div>
        <Radio.Group value={mode} onChange={(e) => setMode(e.target.value)}>
          <Radio.Button value="off">维持原样</Radio.Button>
          <Radio.Button value="preset">内置预设（霞鹜文楷 + EB Garamond）</Radio.Button>
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
              description="上传什么用什么：整份大中文字体（如未压缩的 ttf）访客首次会整份下载（此后长期缓存、翻页不再请求）。中文字体建议先用工具子集化为 woff2 再上传，体积更小。"
            />
            {faces.length > 0 && (
              <Table
                size="small"
                rowKey={(r) => r.src}
                columns={columns}
                dataSource={faces}
                pagination={false}
              />
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
                前面放英文/拉丁字体、后面放中文字体即可实现"英文用 A、中文用 B"（浏览器按字形逐个回退）。
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
            <div style={{ fontSize: 15 }}>
              春江潮水连海平，海上明月共潮生。The quick brown fox jumps over the lazy dog.
            </div>
          </div>
          {mode === 'custom' && (
            <Paragraph type="secondary" style={{ fontSize: 12, marginTop: 8 }}>
              预览未变化？确认已上传字体、且 font-family 栈里写了对应的字体名。
            </Paragraph>
          )}
        </div>
      )}

      <Button type="primary" loading={saving} onClick={onSave}>
        保存
      </Button>
    </Card>
  );
}

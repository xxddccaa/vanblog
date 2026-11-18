import {
  getPublicMaskSetting,
  previewPublicMask,
  scanPublicMask,
  updatePublicMaskSetting,
} from '@/services/van-blog/api';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  Divider,
  Empty,
  Form,
  Input,
  message,
  Row,
  Select,
  Space,
  Spin,
  Switch,
  Table,
  Tag,
  Typography,
} from 'antd';
import { useEffect, useMemo, useState } from 'react';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

const BUILTIN_OPTIONS = [
  {
    key: 'apiToken',
    label: 'API Token / 密钥',
    description: 'sk-…、ghp_…、github_pat_…、AKIA…、AIza…、hf_…、xox…、glpat-…、Stripe 密钥',
  },
  {
    key: 'privateKey',
    label: '私钥',
    description: '-----BEGIN … PRIVATE KEY----- 整块，只有开头没有结尾的也会屏蔽到末尾',
  },
  { key: 'jwt', label: 'JWT', description: 'eyJ… 开头的三段式 Token' },
  {
    key: 'urlCredential',
    label: 'URL 中的账号密码',
    description: '如 postgres://user:pass@host 中的 user:pass',
  },
  { key: 'bearer', label: '认证请求头', description: 'Bearer xxx、Authorization: Basic xxx' },
  {
    key: 'secretAssignment',
    label: '密码类赋值',
    description: 'password=…、api_key: …、TOKEN=…、密码：… 的值；变量引用和占位符不算',
  },
  { key: 'email', label: '邮箱地址', description: '白名单里的地址（如 git@github.com）不屏蔽' },
  {
    key: 'publicIp',
    label: '公网 IP',
    description: 'IPv4/IPv6 公网地址；内网、回环、保留地址不屏蔽',
  },
];

const REPLACEMENT_FIELDS = [
  { key: 'custom', label: '自定义词' },
  { key: 'secret', label: '密钥类' },
  { key: 'email', label: '邮箱' },
  { key: 'ip', label: 'IP' },
];

const ERROR_MESSAGES = {
  TOO_MANY_RULES: '规则过多，最多 500 条',
  KEYWORD_TOO_SHORT: '关键词至少 2 个字符',
  KEYWORD_TOO_LONG: '关键词最多 128 个字符',
  KEYWORD_DUPLICATE: '关键词重复',
  REGEX_TOO_LONG: '正则最长 512 个字符',
  REGEX_INVALID: '正则语法错误',
  REGEX_MATCHES_EMPTY: '正则不能匹配空字符串',
  REGEX_NESTED_QUANTIFIER: '正则含嵌套量词（如 (a+)+），可能导致服务卡死',
  REGEX_TOO_SLOW: '正则匹配过慢，请简化',
  REPLACEMENT_INVALID:
    '屏蔽文本需为 1-16 个字符，且不能包含 * _ [ ] ( ) < > # ~ | \\ ! & " \' ` 等会被 Markdown 解析的符号',
  REPLACEMENT_MATCHED: '有规则会命中屏蔽文本本身，请修改规则或屏蔽文本',
  TOO_MANY_ALLOWLIST_ITEMS: '白名单最多 500 条',
  ALLOWLIST_ITEM_TOO_LONG: '白名单单条最长 200 个字符',
};

const SOURCE_LABELS = {
  article: '文章',
  moment: '动态',
  about: '关于页',
  siteInfo: '站点信息',
  social: '社交信息',
  link: '友链',
  reward: '打赏',
  menu: '菜单',
  layout: '客制化代码',
  customPage: '自定义页面',
  tag: '标签',
  category: '分类',
  navTool: '导航工具',
  navCategory: '导航分类',
  staticFile: '静态文件',
};

const WARNING_LABELS = {
  PATHNAME_REPLACED_BY_ID: { color: 'blue', text: '文章链接将改用 ID，旧链接失效' },
  TAXONOMY_RENAMED: { color: 'blue', text: '前台显示屏蔽后的名字' },
  TAXONOMY_COLLISION: { color: 'red', text: '多个名字屏蔽后重名，对应页面无法访问' },
  CUSTOM_PAGE_HIDDEN: { color: 'orange', text: '页面路径含屏蔽词，前台无法访问' },
  STATIC_FILE_HIDDEN: { color: 'orange', text: '文件名含屏蔽词，前台无法访问' },
  URL_MASKED: { color: 'orange', text: '链接或图片地址被屏蔽，将会失效' },
  SECRET_FOUND: { color: 'red', text: '疑似真实密钥：屏蔽不能代替轮换，请尽快作废' },
};

const KIND_TAGS = {
  custom: { color: 'purple', text: '自定义' },
  secret: { color: 'red', text: '密钥' },
  email: { color: 'gold', text: '邮箱' },
  ip: { color: 'cyan', text: 'IP' },
};

const newRuleId = () => `rule-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const toFormValues = (setting) => ({
  enabled: Boolean(setting?.enabled),
  rules: (setting?.rules || []).map((rule) => ({ ...rule, enabled: rule.enabled !== false })),
  builtins: { ...(setting?.builtins || {}) },
  replacements: { ...(setting?.replacements || {}) },
  allowlist: setting?.allowlist || [],
});

const toPayload = (values) => ({
  enabled: Boolean(values.enabled),
  rules: (values.rules || []).map((rule) => ({
    id: rule.id || newRuleId(),
    enabled: rule.enabled !== false,
    type: rule.type === 'regex' ? 'regex' : 'keyword',
    pattern: String(rule.pattern || '').trim(),
    caseSensitive: Boolean(rule.caseSensitive),
    note: rule.note || undefined,
  })),
  builtins: values.builtins || {},
  replacements: values.replacements || {},
  allowlist: values.allowlist || [],
});

export default function PublicMaskTab() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);
  const [errors, setErrors] = useState([]);
  const [bulkKeywords, setBulkKeywords] = useState('');
  const [previewText, setPreviewText] = useState('');
  const [previewResult, setPreviewResult] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [scanning, setScanning] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getPublicMaskSetting();
      if (res?.statusCode === 200 && res?.data) {
        form.setFieldsValue(toFormValues(res.data.setting));
        setStatus(res.data.status);
      }
    } catch (err) {
      message.error('加载前台屏蔽设置失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const currentDraft = () => toPayload(form.getFieldsValue(true));

  const ruleLabel = (ruleId) => {
    const rules = form.getFieldValue('rules') || [];
    const index = rules.findIndex((rule) => rule?.id === ruleId);
    if (index < 0) {
      return '';
    }
    return `第 ${index + 1} 条规则「${rules[index].pattern}」：`;
  };

  const onSave = async () => {
    setSaving(true);
    setErrors([]);
    try {
      const res = await updatePublicMaskSetting(currentDraft());
      if (res?.statusCode === 200) {
        form.setFieldsValue(toFormValues(res.data.setting));
        setStatus(res.data.status);
        message.success('已保存。前台正在刷新，内容较多时 RSS 重新生成可能需要几分钟');
      } else if (res?.data?.errors?.length) {
        setErrors(res.data.errors);
        message.error('保存失败，请检查规则');
      } else {
        message.error(res?.message || '保存失败');
      }
    } catch (err) {
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const onBulkAdd = () => {
    const words = bulkKeywords
      .split(/[\n,，]/)
      .map((word) => word.trim())
      .filter(Boolean);
    if (!words.length) {
      return;
    }
    const rules = form.getFieldValue('rules') || [];
    const existing = new Set(rules.map((rule) => String(rule?.pattern || '').toLowerCase()));
    const added = words
      .filter((word) => !existing.has(word.toLowerCase()))
      .map((word) => ({ id: newRuleId(), enabled: true, type: 'keyword', pattern: word }));
    form.setFieldsValue({ rules: [...rules, ...added] });
    setBulkKeywords('');
    message.success(`已添加 ${added.length} 个关键词，保存后生效`);
  };

  const onPreview = async () => {
    setPreviewing(true);
    try {
      const res = await previewPublicMask({ setting: currentDraft(), text: previewText });
      if (res?.data?.errors?.length) {
        setErrors(res.data.errors);
        setPreviewResult(null);
      } else {
        setErrors([]);
        setPreviewResult(res?.data || null);
      }
    } catch (err) {
      message.error('预览失败');
    } finally {
      setPreviewing(false);
    }
  };

  const onScan = async () => {
    setScanning(true);
    try {
      const res = await scanPublicMask({ setting: currentDraft() });
      if (res?.data?.errors?.length) {
        setErrors(res.data.errors);
        setScanResult(null);
      } else {
        setErrors([]);
        setScanResult(res?.data || null);
      }
    } catch (err) {
      message.error('扫描失败');
    } finally {
      setScanning(false);
    }
  };

  const scanColumns = useMemo(
    () => [
      {
        title: '来源',
        dataIndex: 'source',
        width: 100,
        render: (source) => SOURCE_LABELS[source] || source,
      },
      {
        title: '位置',
        key: 'location',
        width: 260,
        render: (_, item) => (
          <Space direction="vertical" size={0}>
            <Text ellipsis={{ tooltip: item.title }} style={{ maxWidth: 240 }}>
              {item.title || item.id || '-'}
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {item.field}
              {item.hidden ? '（隐藏文章）' : ''}
            </Text>
          </Space>
        ),
      },
      {
        title: '命中',
        key: 'hits',
        render: (_, item) => (
          <Space size={[4, 4]} wrap>
            {item.hits.map((hit) => (
              <Tag key={`${hit.kind}:${hit.match}`} color={KIND_TAGS[hit.kind]?.color}>
                {KIND_TAGS[hit.kind]?.text}：{hit.match}
              </Tag>
            ))}
            {item.count > item.hits.length ? (
              <Text type="secondary">共 {item.count} 处</Text>
            ) : null}
          </Space>
        ),
      },
      {
        title: '影响',
        key: 'warnings',
        width: 240,
        render: (_, item) => (
          <Space size={[4, 4]} wrap>
            {item.warnings.map((warning) => (
              <Tag key={warning} color={WARNING_LABELS[warning]?.color}>
                {WARNING_LABELS[warning]?.text || warning}
              </Tag>
            ))}
          </Space>
        ),
      },
    ],
    [],
  );

  if (loading) {
    return (
      <div style={{ padding: '24px 0', textAlign: 'center' }}>
        <Spin />
      </div>
    );
  }

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Card title="前台屏蔽">
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="访客能看到的内容在发出前统一替换，后台始终显示原文"
          description={
            <div>
              <div>
                覆盖文章、动态、关于页、站点信息、搜索与搜索索引、RSS、sitemap、自定义页面和静态文本文件。
              </div>
              <div>
                评论同样会被打码；不覆盖图片里的文字。已经被抓取或订阅过的旧内容无法收回，真实密钥请直接作废并更换。
              </div>
            </div>
          }
        />
        {status && !status.ok ? (
          <Alert
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
            message="当前保存的规则无法生效，前台公开内容已暂停输出（503），请修正后重新保存"
          />
        ) : null}
        {errors.length ? (
          <Alert
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
            message="规则有误"
            description={
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {errors.map((error, index) => (
                  <li key={index}>
                    {error.ruleId ? ruleLabel(error.ruleId) : ''}
                    {ERROR_MESSAGES[error.code] || error.code}
                    {error.field ? `（${error.field}）` : ''}
                  </li>
                ))}
              </ul>
            }
          />
        ) : null}

        <Form form={form} layout="vertical">
          <Form.Item
            name="enabled"
            label="启用前台屏蔽"
            valuePropName="checked"
            extra={
              status?.ok
                ? status.active
                  ? '当前状态：已生效'
                  : '当前状态：未生效（未开启或没有任何规则）'
                : null
            }
          >
            <Switch />
          </Form.Item>

          <Divider orientation="left">自定义屏蔽词</Divider>
          <Paragraph type="secondary">
            关键词按子串匹配，默认不区分大小写，例如 intranet 也会命中
            Intranet-gpu01。正则用于更复杂的格式。
          </Paragraph>
          <Form.List name="rules">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Row key={key} gutter={8} align="middle" style={{ marginBottom: 8 }}>
                    <Form.Item {...restField} name={[name, 'id']} hidden>
                      <Input />
                    </Form.Item>
                    <Col xs={8} md={3}>
                      <Form.Item
                        {...restField}
                        name={[name, 'type']}
                        noStyle
                        initialValue="keyword"
                      >
                        <Select
                          style={{ width: '100%' }}
                          options={[
                            { label: '关键词', value: 'keyword' },
                            { label: '正则', value: 'regex' },
                          ]}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={16} md={7}>
                      <Form.Item
                        {...restField}
                        name={[name, 'pattern']}
                        noStyle
                        rules={[{ required: true, message: '请输入内容' }]}
                      >
                        <Input placeholder="如内部主机名、机房代号、node-\d+" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={6}>
                      <Form.Item {...restField} name={[name, 'note']} noStyle>
                        <Input placeholder="备注（可选）" />
                      </Form.Item>
                    </Col>
                    <Col xs={10} md={3}>
                      <Form.Item
                        {...restField}
                        name={[name, 'caseSensitive']}
                        valuePropName="checked"
                        noStyle
                      >
                        <Checkbox>区分大小写</Checkbox>
                      </Form.Item>
                    </Col>
                    <Col xs={10} md={3}>
                      <Form.Item
                        {...restField}
                        name={[name, 'enabled']}
                        valuePropName="checked"
                        noStyle
                        initialValue={true}
                      >
                        <Switch checkedChildren="启用" unCheckedChildren="停用" />
                      </Form.Item>
                    </Col>
                    <Col xs={4} md={2}>
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => remove(name)}
                      />
                    </Col>
                  </Row>
                ))}
                <Space wrap style={{ width: '100%' }}>
                  <Button
                    type="dashed"
                    icon={<PlusOutlined />}
                    onClick={() =>
                      add({ id: newRuleId(), enabled: true, type: 'keyword', pattern: '' })
                    }
                  >
                    添加规则
                  </Button>
                  <Input
                    style={{ width: 320 }}
                    value={bulkKeywords}
                    onChange={(event) => setBulkKeywords(event.target.value)}
                    onPressEnter={onBulkAdd}
                    placeholder="批量添加关键词，用逗号分隔，如 host-a, host-b, lab-x"
                  />
                  <Button onClick={onBulkAdd}>批量添加</Button>
                </Space>
              </>
            )}
          </Form.List>

          <Divider orientation="left">内置检测</Divider>
          <Row gutter={[16, 8]}>
            {BUILTIN_OPTIONS.map((option) => (
              <Col key={option.key} xs={24} md={12}>
                <Form.Item name={['builtins', option.key]} valuePropName="checked" noStyle>
                  <Checkbox>
                    <Text strong>{option.label}</Text>
                    <div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {option.description}
                      </Text>
                    </div>
                  </Checkbox>
                </Form.Item>
              </Col>
            ))}
          </Row>

          <Divider orientation="left">屏蔽后显示的文本</Divider>
          <Row gutter={16}>
            {REPLACEMENT_FIELDS.map((field) => (
              <Col key={field.key} xs={12} md={6}>
                <Form.Item name={['replacements', field.key]} label={field.label}>
                  <Input maxLength={16} />
                </Form.Item>
              </Col>
            ))}
          </Row>

          <Divider orientation="left">白名单</Divider>
          <Form.Item
            name="allowlist"
            extra="只对内置检测生效，例如 git@github.com、8.8.8.8；自定义屏蔽词始终屏蔽。"
          >
            <Select mode="tags" tokenSeparators={[',', '，', ' ']} placeholder="输入后回车添加" />
          </Form.Item>

          <Space>
            <Button type="primary" loading={saving} onClick={onSave}>
              保存
            </Button>
            <Button onClick={loadData}>放弃修改</Button>
          </Space>
        </Form>
      </Card>

      <Card title="试一试" extra={<Text type="secondary">按当前表单规则预览，未保存也可以试</Text>}>
        <TextArea
          rows={5}
          value={previewText}
          onChange={(event) => setPreviewText(event.target.value)}
          placeholder="粘贴一段文章内容，查看前台会显示成什么样"
        />
        <Button style={{ marginTop: 12 }} loading={previewing} onClick={onPreview}>
          预览
        </Button>
        {previewResult ? (
          <div style={{ marginTop: 12 }}>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0 }}>
              {previewResult.masked}
            </pre>
            <Space size={[4, 4]} wrap style={{ marginTop: 8 }}>
              {(previewResult.hits || []).map((hit, index) => (
                <Tag key={index} color={KIND_TAGS[hit.kind]?.color}>
                  {KIND_TAGS[hit.kind]?.text}：{hit.match}
                </Tag>
              ))}
            </Space>
          </div>
        ) : null}
      </Card>

      <Card
        title="命中扫描"
        extra={
          <Button loading={scanning} onClick={onScan}>
            按当前表单规则扫描全站
          </Button>
        }
      >
        {scanResult ? (
          <>
            <Paragraph>
              共 {scanResult.totals?.items || 0} 处内容命中，{scanResult.totals?.hits || 0} 次
              {scanResult.totals?.truncated ? '（结果过多，只显示前 1000 条）' : ''}
            </Paragraph>
            <Space size={[4, 4]} wrap style={{ marginBottom: 12 }}>
              {Object.entries(scanResult.warnings || {}).map(([warning, count]) => (
                <Tag key={warning} color={WARNING_LABELS[warning]?.color}>
                  {WARNING_LABELS[warning]?.text || warning}：{count}
                </Tag>
              ))}
            </Space>
            <Table
              size="small"
              rowKey={(item, index) => `${item.source}:${item.id}:${item.field}:${index}`}
              columns={scanColumns}
              dataSource={scanResult.items || []}
              pagination={{ pageSize: 20 }}
              scroll={{ x: 900 }}
            />
          </>
        ) : (
          <Empty description="扫描结果只在后台可见，用来确认哪些内容会被屏蔽、哪些链接会受影响" />
        )}
      </Card>
    </Space>
  );
}

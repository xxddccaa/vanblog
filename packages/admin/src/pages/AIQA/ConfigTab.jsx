import TipTitle from '@/components/TipTitle';
import {
  AppstoreAddOutlined,
  CheckCircleOutlined,
  DatabaseOutlined,
  InfoCircleOutlined,
  KeyOutlined,
  LinkOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
} from 'antd';
import { fieldTips, formatTime, getResourceManagementModeLabel } from './shared';
import styles from './index.less';

const { Text } = Typography;

const searchModeOptions = [
  { label: '混合检索 · mixedRecall', value: 'mixedRecall' },
  { label: '向量检索 · embedding', value: 'embedding' },
  { label: '全文检索 · fullTextRecall', value: 'fullTextRecall' },
];

function OpsMetric(props) {
  const { label, value, text } = props;

  return (
    <div className={styles.opsMetricCard}>
      <div className={styles.opsMetricLabel}>{label}</div>
      <div className={styles.opsMetricValue}>{value}</div>
      <div className={styles.opsMetricText}>{text}</div>
    </div>
  );
}

function StatusFactRow(props) {
  const { label, value } = props;

  return (
    <div className={styles.statusFactRow}>
      <div className={styles.statusFactLabel}>{label}</div>
      <div className={styles.statusFactValue}>{value}</div>
    </div>
  );
}

function SignalPanel(props) {
  const { icon, eyebrow, title, description, items = [], tone = 'info' } = props;

  return (
    <div className={`${styles.signalPanel} ${styles[`signal${tone}`] || ''}`}>
      <div className={styles.signalIcon}>{icon}</div>
      <div className={styles.signalBody}>
        {eyebrow ? <div className={styles.signalEyebrow}>{eyebrow}</div> : null}
        <div className={styles.signalTitle}>{title}</div>
        {description ? <div className={styles.signalDescription}>{description}</div> : null}
        {items.length ? (
          <ul className={styles.signalList}>
            {items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

function SecretHint(props) {
  const { configured, label = '已保存', emptyLabel = '未配置', detail } = props;

  return (
    <Space size={8} wrap>
      <Tag color={configured ? 'blue' : 'default'}>{configured ? label : emptyLabel}</Tag>
      <Text type="secondary">{detail}</Text>
    </Space>
  );
}

export default function ConfigTab(props) {
  const {
    form,
    status,
    syncSummary,
    secretState,
    extensionQueryEnabled,
    savingConfig,
    statusLoading,
    testingConnection,
    syncing,
    syncingBundledModels,
    provisioningResources,
    testingBundledModels,
    onSaveConfig,
    onRefreshStatus,
    onTestConnection,
    onFullSync,
    onSyncBundledModels,
    onProvisionResources,
    onTestBundledModels,
  } = props;

  const configuredStatus = !status?.configured
    ? '待配置'
    : status?.enabled
      ? '已启用'
      : '已配置，未启用';
  const sourceSummary = `文章 ${status?.sourceCounts?.article ?? 0} / 草稿 ${
    status?.sourceCounts?.draft ?? 0
  } / 文档 ${status?.sourceCounts?.document ?? 0}`;
  const syncedSummary = `文章 ${status?.syncedCounts?.article ?? 0} / 草稿 ${
    status?.syncedCounts?.draft ?? 0
  } / 文档 ${status?.syncedCounts?.document ?? 0}`;
  const managedResourceNames = status?.managedResourceNames || {};

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} xl={8}>
        <div className={styles.opsColumn}>
          <Card className={styles.panelCard}>
            <div className={styles.opsHeader}>
              <div>
                <div className={styles.sectionEyebrow}>运行状态</div>
                <div className={styles.opsHeaderTitle}>FastGPT 连接、知识库与同步</div>
                <div className={styles.opsHeaderDesc}>
                  先确认当前资源和同步状态，再决定是保存配置、测试连通性还是执行全量同步。
                </div>
              </div>
              <Space wrap className={styles.opsActionRow}>
                <Button icon={<ReloadOutlined />} onClick={onRefreshStatus} loading={statusLoading}>
                  刷新状态
                </Button>
                <Button
                  icon={<CheckCircleOutlined />}
                  onClick={onTestConnection}
                  loading={testingConnection}
                >
                  测试连接
                </Button>
                <Button
                  type="primary"
                  icon={<SyncOutlined />}
                  onClick={onFullSync}
                  loading={syncing}
                >
                  全量同步
                </Button>
              </Space>
            </div>

            {status?.lastSyncError ? (
              <Alert
                type="warning"
                showIcon
                className={styles.statusAlert}
                message="最近一次同步出现异常"
                description={status.lastSyncError}
              />
            ) : null}

            <div className={styles.opsMetricGrid}>
              <OpsMetric label="当前状态" value={configuredStatus} text="配置、启用与运行状态" />
              <OpsMetric
                label="博客知识源"
                value={status?.totalSources ?? 0}
                text={sourceSummary}
              />
              <OpsMetric label="已同步" value={status?.syncedSources ?? 0} text={syncedSummary} />
              <OpsMetric
                label="待同步"
                value={status?.pendingSources ?? 0}
                text={status?.pendingSources ? '还有内容待入库或更新' : '当前知识库已追平'}
              />
            </div>

            <div className={styles.statusFactList}>
              <StatusFactRow
                label="FastGPT 内部地址"
                value={<Text code>{status?.fastgptInternalUrl || '未配置'}</Text>}
              />
              <StatusFactRow
                label="FastGPT root 密码"
                value={
                  status?.fastgptRootPasswordConfigured ? (
                    <Tag color="green">已注入，可同步 bundled 模型</Tag>
                  ) : (
                    <Tag color="default">未注入，仅可测试上游接口</Tag>
                  )
                }
              />
              <StatusFactRow
                label="bundled 模型配置"
                value={
                  status?.bundledModelConfigured ? (
                    <Tag color="green">已填写</Tag>
                  ) : (
                    <Tag color="orange">待填写</Tag>
                  )
                }
              />
              <StatusFactRow
                label={<TipTitle title="Dataset ID" tip={fieldTips.datasetId} />}
                value={status?.datasetId ? <Text copyable>{status.datasetId}</Text> : '未配置'}
              />
              <StatusFactRow
                label={<TipTitle title="App ID" tip={fieldTips.appId} />}
                value={status?.appId ? <Text copyable>{status.appId}</Text> : '未配置'}
              />
              <StatusFactRow label="最近增量同步" value={formatTime(status?.lastSyncAt)} />
              <StatusFactRow label="最近全量同步" value={formatTime(status?.lastFullSyncAt)} />
            </div>

            {syncSummary ? (
              <div className={styles.syncSnapshot}>
                <div className={styles.syncSnapshotTitle}>最近一次 {syncSummary.trigger} 同步</div>
                <div className={styles.syncSnapshotText}>
                  新增 {syncSummary.created}，更新 {syncSummary.updated}，跳过 {syncSummary.skipped}
                  ，删除 {syncSummary.deleted}，失败 {syncSummary.failed}。完成于{' '}
                  {formatTime(syncSummary.finishedAt)}。
                </div>
              </div>
            ) : null}

            <div className={styles.extensionBox}>
              <div className={styles.extensionBoxHeader}>
                <div>
                  <div className={styles.extensionBoxTitle}>博客 AI 身份与命名隔离</div>
                  <div className={styles.extensionBoxText}>
                    `blogInstanceId` 只保存在当前博客自己的 PG 配置里，用于共享 FastGPT
                    时隔离自动资源。
                  </div>
                </div>
                <Space size={8} wrap>
                  <Tag color={status?.resourceManagementMode === 'managedV2' ? 'green' : 'default'}>
                    {status?.resourceManagementMode || 'manual'}
                  </Tag>
                  <Tag color="blue">命名规则 v{status?.resourceNamingVersion ?? 2}</Tag>
                  {status?.legacyAutoMigrationPending ? (
                    <Tag color="orange">旧资源待迁移</Tag>
                  ) : null}
                </Space>
              </div>
              <div className={styles.statusFactList}>
                <StatusFactRow
                  label="博客唯一标识"
                  value={
                    status?.blogInstanceId ? (
                      <Text copyable>{status.blogInstanceId}</Text>
                    ) : (
                      '生成中'
                    )
                  }
                />
                <StatusFactRow
                  label="资源管理模式"
                  value={getResourceManagementModeLabel(status?.resourceManagementMode)}
                />
                <StatusFactRow
                  label="自动管理 Dataset 名"
                  value={
                    managedResourceNames.dataset ? (
                      <Text code>{managedResourceNames.dataset}</Text>
                    ) : (
                      '未绑定'
                    )
                  }
                />
                <StatusFactRow
                  label="自动管理 App 名"
                  value={
                    managedResourceNames.app ? (
                      <Text code>{managedResourceNames.app}</Text>
                    ) : (
                      '未绑定'
                    )
                  }
                />
                <StatusFactRow
                  label="自动管理 API Key 名"
                  value={
                    managedResourceNames.apiKey ? (
                      <Text code>{managedResourceNames.apiKey}</Text>
                    ) : (
                      '未绑定'
                    )
                  }
                />
              </div>
            </div>
          </Card>

          <SignalPanel
            tone={status?.fastgptRootPasswordConfigured ? 'success' : 'warning'}
            icon={
              status?.fastgptRootPasswordConfigured ? (
                <SafetyCertificateOutlined />
              ) : (
                <InfoCircleOutlined />
              )
            }
            eyebrow="Bundled 接入"
            title={
              status?.fastgptRootPasswordConfigured
                ? '后台已经具备写入 FastGPT 的权限'
                : '当前更适合先做上游接口联通测试'
            }
            description={
              status?.fastgptRootPasswordConfigured
                ? '现在可以直接在后台同步 bundled 模型，并自动创建 Dataset / App / API Key。'
                : '如果还没注入 FastGPT root 密码，这一页仍可校验上游 chat / embedding 接口，但不会写入 FastGPT。'
            }
            items={
              status?.fastgptRootPasswordConfigured
                ? [
                    '测试模型：直接请求你填写的 OpenAI-compatible 地址。',
                    '同步模型：把 chat / embedding 模型写入 bundled FastGPT。',
                    '自动创建资源：优先复用已有 Dataset / App，尽量不打断现有配置。',
                  ]
                : ['先确认上游接口可用，再补 FASTGPT_ROOT_PASSWORD。']
            }
          />

          <SignalPanel
            tone="warning"
            icon={<DatabaseOutlined />}
            eyebrow="Embedding 变更提醒"
            title="换 embedding 后，旧知识库不会自动重算向量"
            description="如果后续替换向量模型，FastGPT 已存在的 Dataset 通常需要重新创建或重建。"
            items={['先创建新 Dataset，再重新执行一次全量同步。']}
          />
        </div>
      </Col>

      <Col xs={24} xl={16}>
        <Card className={styles.panelCard}>
          <Form form={form} layout="vertical" initialValues={{}}>
            <div className={styles.formToolbar}>
              <div className={styles.formToolbarCopy}>
                <div className={styles.sectionEyebrow}>配置中心</div>
                <div className={styles.formToolbarTitle}>FastGPT 资源、检索策略与模型接入</div>
                <div className={styles.formToolbarText}>
                  按照“启用入口 → 检索策略 → 模型接入”的顺序配置，能更快定位问题并减少反复保存。
                </div>
              </div>
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={onSaveConfig}
                loading={savingConfig}
              >
                保存配置
              </Button>
            </div>

            <div className={styles.formSection}>
              <div className={styles.formSectionHeader}>
                <div className={styles.formSectionLead}>
                  <div className={styles.sectionEyebrow}>问答入口</div>
                  <div className={styles.formSectionTitle}>启用后台问答并绑定 FastGPT 资源</div>
                  <div className={styles.formSectionText}>
                    Dataset 负责存储博客知识，App 负责聊天编排，API Key 用于后台接口鉴权。
                  </div>
                </div>
              </div>

              <div className={styles.settingToggleCard}>
                <div className={styles.settingToggleCopy}>
                  <div className={styles.settingToggleTitle}>启用 AI 问答</div>
                  <div className={styles.settingToggleText}>
                    关闭后不会影响已保存的配置，但后台不会对外提供 AI 工作台问答能力。
                  </div>
                </div>
                <div className={styles.settingToggleControl}>
                  <Form.Item name="enabled" valuePropName="checked" noStyle>
                    <Switch />
                  </Form.Item>
                </div>
              </div>

              <Row gutter={12}>
                <Col xs={24} md={12}>
                  <Form.Item
                    label={<TipTitle title="Dataset ID" tip={fieldTips.datasetId} />}
                    name="datasetId"
                  >
                    <Input placeholder="例如 65abc9bd9d1448617cba5e6c" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    label={<TipTitle title="App ID" tip={fieldTips.appId} />}
                    name="appId"
                    extra="聊天鉴权会自动使用 apiKey-appId 形式访问 FastGPT。先不填也可以保存。"
                  >
                    <Input placeholder="例如 65abc9bd9d1448617cba5fff" />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                label={<TipTitle title="API Key" tip={fieldTips.apiKey} />}
                name="apiKey"
                extra={
                  <SecretHint
                    configured={secretState?.apiKeyConfigured}
                    label="已保存，留空沿用"
                    emptyLabel="未保存"
                    detail="输入新值会覆盖当前 API Key。"
                  />
                }
              >
                <Input.Password
                  placeholder={
                    secretState?.apiKeyConfigured
                      ? '已保存 API Key，输入新值可覆盖'
                      : 'fastgpt-xxxxxx'
                  }
                  autoComplete="new-password"
                />
              </Form.Item>
            </div>

            <div className={styles.formSection}>
              <div className={styles.formSectionHeader}>
                <div className={styles.formSectionLead}>
                  <div className={styles.sectionEyebrow}>检索策略</div>
                  <div className={styles.formSectionTitle}>控制检索模式、召回阈值与问题扩写</div>
                  <div className={styles.formSectionText}>
                    这里决定问答会怎样检索博客知识，以及在检索前是否先用扩写模型改写问题。
                  </div>
                </div>
              </div>

              <Row gutter={12}>
                <Col xs={24} md={12}>
                  <Form.Item label="检索模式" name="searchMode">
                    <Select options={searchModeOptions} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="最大 Token 限额" name="limit">
                    <InputNumber min={100} max={20000} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={12}>
                <Col xs={24} md={12}>
                  <Form.Item label="最小相似度" name="similarity">
                    <InputNumber min={0} max={1} step={0.05} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <div className={styles.settingToggleCard}>
                    <div className={styles.settingToggleCopy}>
                      <div className={styles.settingToggleTitle}>启用 Rerank</div>
                      <div className={styles.settingToggleText}>
                        对召回结果二次排序，适合知识片段较多时提升相关性。
                      </div>
                    </div>
                    <div className={styles.settingToggleControl}>
                      <Form.Item name="usingReRank" valuePropName="checked" noStyle>
                        <Switch />
                      </Form.Item>
                    </div>
                  </div>
                </Col>
              </Row>

              <div className={styles.extensionBox}>
                <div className={styles.extensionBoxHeader}>
                  <div>
                    <div className={styles.extensionBoxTitle}>
                      <TipTitle title="启用 Query Extension" tip={fieldTips.queryExtension} />
                    </div>
                    <div className={styles.extensionBoxText}>
                      适合缩写多、术语多的知识库；会增加一次问题扩写请求与额外时延。
                    </div>
                  </div>
                  <Form.Item
                    name="datasetSearchUsingExtensionQuery"
                    valuePropName="checked"
                    noStyle
                  >
                    <Switch />
                  </Form.Item>
                </div>

                {extensionQueryEnabled ? (
                  <Row gutter={12}>
                    <Col xs={24} md={12}>
                      <Form.Item label="Extension Model" name="datasetSearchExtensionModel">
                        <Input placeholder="例如 gpt-5 / qwen-plus" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item label="Extension Background" name="datasetSearchExtensionBg">
                        <Input.TextArea
                          rows={4}
                          placeholder="补充查询扩写背景，例如你的博客研究方向、术语缩写或常见别名。"
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                ) : null}
              </div>
            </div>

            <div className={styles.formSection}>
              <div className={styles.modelSectionHeader}>
                <div className={styles.formSectionLead}>
                  <div className={styles.sectionEyebrow}>Bundled FastGPT 模型接入</div>
                  <div className={styles.formSectionTitle}>上游模型地址、调用 key 与鉴权 Token</div>
                  <div className={styles.formSectionText}>
                    对话模型负责聊天，向量模型负责 embedding。地址都需要填写完整的 OpenAI-compatible
                    接口路径。
                  </div>
                </div>
                <Space wrap className={styles.modelActionRow}>
                  <Button
                    icon={<AppstoreAddOutlined />}
                    onClick={onProvisionResources}
                    loading={provisioningResources}
                  >
                    自动创建 Dataset / App / API Key
                  </Button>
                  <Button
                    icon={<LinkOutlined />}
                    onClick={onSyncBundledModels}
                    loading={syncingBundledModels}
                  >
                    同步模型到 FastGPT
                  </Button>
                  <Button
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    onClick={onTestBundledModels}
                    loading={testingBundledModels}
                  >
                    测试模型
                  </Button>
                </Space>
              </div>

              <div className={styles.modelDeck}>
                <div className={styles.modelPane}>
                  <div className={styles.modelPaneHeader}>
                    <div>
                      <div className={styles.modelPaneEyebrow}>Chat</div>
                      <div className={styles.modelPaneTitle}>对话模型</div>
                      <div className={styles.modelPaneText}>
                        完整地址需要以 `/chat/completions` 结尾。
                      </div>
                    </div>
                    <Tag color="blue">/chat/completions</Tag>
                  </div>
                  <Row gutter={12}>
                    <Col xs={24} md={12}>
                      <Form.Item label="模型名" name={['bundledModels', 'llm', 'name']}>
                        <Input placeholder="例如 Qwen3.5-35B-A3B" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item label="调用 Key" name={['bundledModels', 'llm', 'model']}>
                        <Input placeholder="例如 Qwen3.5-35B-A3B" />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item
                    label="调用地址"
                    name={['bundledModels', 'llm', 'requestUrl']}
                    extra="填写完整接口地址，例如 https://example.com/v1/chat/completions"
                  >
                    <Input placeholder="https://your-openai-compatible-host/v1/chat/completions" />
                  </Form.Item>
                  <Form.Item
                    label={<TipTitle title="Token" tip={fieldTips.bundledToken} />}
                    name={['bundledModels', 'llm', 'requestAuth']}
                    extra={
                      <SecretHint
                        configured={secretState?.llmRequestAuthConfigured}
                        label="已保存，留空沿用"
                        emptyLabel="可留空"
                        detail="如果填写，会以 Authorization: Bearer xxx 的形式发送。"
                      />
                    }
                  >
                    <Input.Password
                      placeholder={
                        secretState?.llmRequestAuthConfigured
                          ? '已保存 Token，输入新值可覆盖'
                          : '留空则不带 Authorization'
                      }
                      autoComplete="new-password"
                    />
                  </Form.Item>
                </div>

                <div className={styles.modelPane}>
                  <div className={styles.modelPaneHeader}>
                    <div>
                      <div className={styles.modelPaneEyebrow}>Embedding</div>
                      <div className={styles.modelPaneTitle}>向量模型</div>
                      <div className={styles.modelPaneText}>
                        完整地址需要以 `/embeddings` 结尾。
                      </div>
                    </div>
                    <Tag color="cyan">/embeddings</Tag>
                  </div>
                  <Row gutter={12}>
                    <Col xs={24} md={12}>
                      <Form.Item label="模型名" name={['bundledModels', 'embedding', 'name']}>
                        <Input placeholder="例如 qwen3-embedding-8b" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item label="调用 Key" name={['bundledModels', 'embedding', 'model']}>
                        <Input placeholder="例如 qwen3-embedding-8b" />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item
                    label="调用地址"
                    name={['bundledModels', 'embedding', 'requestUrl']}
                    extra="填写完整接口地址，例如 https://example.com/v1/embeddings"
                  >
                    <Input placeholder="https://your-openai-compatible-host/v1/embeddings" />
                  </Form.Item>
                  <Form.Item
                    label={<TipTitle title="Token" tip={fieldTips.bundledToken} />}
                    name={['bundledModels', 'embedding', 'requestAuth']}
                    extra={
                      <SecretHint
                        configured={secretState?.embeddingRequestAuthConfigured}
                        label="已保存，留空沿用"
                        emptyLabel="可留空"
                        detail="如果填写，会以 Authorization: Bearer xxx 的形式发送。"
                      />
                    }
                  >
                    <Input.Password
                      placeholder={
                        secretState?.embeddingRequestAuthConfigured
                          ? '已保存 Token，输入新值可覆盖'
                          : '留空则不带 Authorization'
                      }
                      autoComplete="new-password"
                    />
                  </Form.Item>
                </div>
              </div>

              <div className={styles.footNoteStrip}>
                <KeyOutlined />
                <span>
                  页面不会回显真实 Token / API
                  Key。看到空输入框是正常的：留空表示沿用，输入新值才会覆盖。
                </span>
              </div>
            </div>
          </Form>
        </Card>
      </Col>
    </Row>
  );
}

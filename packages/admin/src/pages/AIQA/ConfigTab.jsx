import TipTitle from '@/components/TipTitle';
import {
  AppstoreAddOutlined,
  CheckCircleOutlined,
  KeyOutlined,
  LinkOutlined,
  ReloadOutlined,
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

const workflowSteps = [
  { key: 'models', index: '1', title: '填模型接口' },
  { key: 'test', index: '2', title: '测模型' },
  { key: 'write', index: '3', title: '写入 FastGPT' },
  { key: 'sync', index: '4', title: '保存并同步知识' },
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

function SecretHint(props) {
  const { configured, label = '已保存', emptyLabel = '未配置', detail } = props;

  return (
    <Space size={8} wrap>
      <Tag color={configured ? 'blue' : 'default'}>{configured ? label : emptyLabel}</Tag>
      {detail ? <Text type="secondary">{detail}</Text> : null}
    </Space>
  );
}

function StepPanel(props) {
  const { step, title, titleTip, hint, actions, children } = props;

  return (
    <div className={styles.stepPanel}>
      <div className={styles.stepHeader}>
        <div className={styles.stepHeaderMain}>
          <div className={styles.stepIndex}>{step}</div>
          <div className={styles.stepCopy}>
            <div className={styles.sectionEyebrow}>步骤 {step}</div>
            <div className={styles.stepTitle}>
              {titleTip ? <TipTitle title={title} tip={titleTip} /> : title}
            </div>
            {hint ? <div className={styles.stepHint}>{hint}</div> : null}
          </div>
        </div>
        {actions ? <div className={styles.stepActions}>{actions}</div> : null}
      </div>
      {children}
    </div>
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
  const autoManagedFacts = [
    managedResourceNames.dataset
      ? {
          key: 'dataset',
          label: '自动管理 Dataset 名',
          value: <Text code>{managedResourceNames.dataset}</Text>,
        }
      : null,
    managedResourceNames.app
      ? {
          key: 'app',
          label: '自动管理 App 名',
          value: <Text code>{managedResourceNames.app}</Text>,
        }
      : null,
    managedResourceNames.apiKey
      ? {
          key: 'apiKey',
          label: '自动管理 API Key 名',
          value: <Text code>{managedResourceNames.apiKey}</Text>,
        }
      : null,
  ].filter(Boolean);

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} xl={8}>
        <div className={styles.opsColumn}>
          <Card className={styles.panelCard}>
            <div className={styles.opsHeader}>
              <div>
                <div className={styles.sectionEyebrow}>当前状态</div>
                <div className={styles.opsHeaderTitle}>先看现在卡在哪一步</div>
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
              </Space>
            </div>

            {status?.lastSyncError ? (
              <Alert
                type="warning"
                showIcon
                className={styles.statusAlert}
                message="最近一次同步异常"
                description={status.lastSyncError}
              />
            ) : null}

            <div className={styles.opsMetricGrid}>
              <OpsMetric
                label="问答入口"
                value={configuredStatus}
                text={status?.enabled ? '后台问答已可用' : '还没开始对外提供问答'}
              />
              <OpsMetric
                label="博客知识源"
                value={status?.totalSources ?? 0}
                text={sourceSummary}
              />
              <OpsMetric
                label="已同步"
                value={status?.syncedSources ?? 0}
                text={syncedSummary}
              />
              <OpsMetric
                label="写入权限"
                value={status?.fastgptRootPasswordConfigured ? '已具备' : '缺少'}
                text={
                  status?.fastgptRootPasswordConfigured
                    ? '可写 bundled FastGPT'
                    : '当前只能测试模型接口'
                }
              />
            </div>

            <div className={styles.statusFactList}>
              <StatusFactRow
                label="FastGPT 内部地址"
                value={<Text code>{status?.fastgptInternalUrl || '未配置'}</Text>}
              />
              <StatusFactRow
                label={<TipTitle title="FastGPT root 密码" tip={fieldTips.rootPassword} />}
                value={
                  status?.fastgptRootPasswordConfigured ? (
                    <Tag color="green">已注入</Tag>
                  ) : (
                    <Tag color="default">未注入</Tag>
                  )
                }
              />
              <StatusFactRow
                label="bundled 模型"
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
              <StatusFactRow label="最近全量同步" value={formatTime(status?.lastFullSyncAt)} />
            </div>

            <div className={styles.statusSubsection}>
              <div className={styles.statusSubsectionHead}>
                <div className={styles.statusSubsectionTitle}>博客 AI 身份</div>
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
                {autoManagedFacts.map((item) => (
                  <StatusFactRow key={item.key} label={item.label} value={item.value} />
                ))}
              </div>
            </div>

            {syncSummary ? (
              <div className={styles.syncSnapshot}>
                <div className={styles.syncSnapshotTitle}>最近一次 {syncSummary.trigger} 同步</div>
                <div className={styles.syncSnapshotText}>
                  新增 {syncSummary.created}，更新 {syncSummary.updated}，跳过 {syncSummary.skipped}
                  ，删除 {syncSummary.deleted}，失败 {syncSummary.failed}。
                </div>
              </div>
            ) : null}
          </Card>
        </div>
      </Col>

      <Col xs={24} xl={16}>
        <Card className={styles.panelCard}>
          <Form form={form} layout="vertical" initialValues={{}}>
            <div className={styles.formToolbar}>
              <div className={styles.formToolbarCopy}>
                <div className={styles.sectionEyebrow}>配置中心</div>
                <div className={styles.formToolbarTitle}>按 1 → 4 配好就能开始问答</div>
              </div>
            </div>

            <div className={styles.workflowStrip}>
              {workflowSteps.map((item) => (
                <div key={item.key} className={styles.workflowStep}>
                  <div className={styles.workflowStepIndex}>{item.index}</div>
                  <div className={styles.workflowStepTitle}>{item.title}</div>
                </div>
              ))}
            </div>
            <div className={styles.workflowHint}>说明都收进 ? 里，按顺序操作最省事。</div>

            <StepPanel
              step="1"
              title="填写模型接口"
              titleTip="先把 chat 和 embeddings 的完整接口地址、调用 Key、Token 填好，后面的测试和写入步骤才有意义。"
              hint="先把上游 chat / embeddings 接口填完整。"
            >
              <div className={styles.modelDeck}>
                <div className={styles.modelPane}>
                  <div className={styles.modelPaneHeader}>
                    <div>
                      <div className={styles.modelPaneEyebrow}>Chat</div>
                      <div className={styles.modelPaneTitle}>对话模型</div>
                    </div>
                    <Tag color="blue">/chat/completions</Tag>
                  </div>
                  <Row gutter={12}>
                    <Col xs={24} md={12}>
                      <Form.Item
                        label={<TipTitle title="展示名" tip={fieldTips.modelDisplayName} />}
                        name={['bundledModels', 'llm', 'name']}
                      >
                        <Input placeholder="例如 Qwen3.5-35B-A3B" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item
                        label={<TipTitle title="调用 Key" tip={fieldTips.modelKey} />}
                        name={['bundledModels', 'llm', 'model']}
                      >
                        <Input placeholder="例如 Qwen3.5-35B-A3B" />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item
                    label={<TipTitle title="调用地址" tip={fieldTips.chatRequestUrl} />}
                    name={['bundledModels', 'llm', 'requestUrl']}
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
                        detail="输入新值才会覆盖。"
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
                    </div>
                    <Tag color="cyan">/embeddings</Tag>
                  </div>
                  <Row gutter={12}>
                    <Col xs={24} md={12}>
                      <Form.Item
                        label={<TipTitle title="展示名" tip={fieldTips.modelDisplayName} />}
                        name={['bundledModels', 'embedding', 'name']}
                      >
                        <Input placeholder="例如 qwen3-embedding-8b" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item
                        label={<TipTitle title="调用 Key" tip={fieldTips.modelKey} />}
                        name={['bundledModels', 'embedding', 'model']}
                      >
                        <Input placeholder="例如 qwen3-embedding-8b" />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item
                    label={<TipTitle title="调用地址" tip={fieldTips.embeddingRequestUrl} />}
                    name={['bundledModels', 'embedding', 'requestUrl']}
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
                        detail="输入新值才会覆盖。"
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
                <span>Token / API Key 不会回显；留空表示沿用，输入新值才会覆盖。</span>
              </div>
            </StepPanel>

            <StepPanel
              step="2"
              title="测试模型"
              titleTip="这一步只测试你填写的上游接口能否正常返回，不会把配置写入 FastGPT。"
              hint="先测接口是否可用，再做写入和同步。"
              actions={
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  onClick={onTestBundledModels}
                  loading={testingBundledModels}
                >
                  测试模型
                </Button>
              }
            >
              <div className={styles.stepStatusRow}>
                <Tag color={status?.bundledModelConfigured ? 'green' : 'orange'}>
                  {status?.bundledModelConfigured ? '模型信息已填写' : '模型信息待填写'}
                </Tag>
                <Text type="secondary">这里测的是 chat / embeddings 上游接口，不会写入 FastGPT。</Text>
              </div>
            </StepPanel>

            <StepPanel
              step="3"
              title="写入 FastGPT"
              titleTip="需要已注入 FastGPT root 密码。先同步模型，再自动创建或复用 Dataset / App / API Key。"
              hint="只有具备 root 权限时，这一步才会真正写入 bundled FastGPT。"
              actions={
                <Space wrap className={styles.stepActions}>
                  <Button
                    icon={<LinkOutlined />}
                    onClick={onSyncBundledModels}
                    loading={syncingBundledModels}
                  >
                    同步模型到 FastGPT
                  </Button>
                  <Button
                    icon={<AppstoreAddOutlined />}
                    onClick={onProvisionResources}
                    loading={provisioningResources}
                  >
                    自动创建资源
                  </Button>
                </Space>
              }
            >
              <div className={styles.stepStatusRow}>
                <Tag color={status?.fastgptRootPasswordConfigured ? 'green' : 'default'}>
                  {status?.fastgptRootPasswordConfigured ? '已具备写入权限' : '缺少 root 密码'}
                </Tag>
                <Text type="secondary">
                  {status?.fastgptRootPasswordConfigured
                    ? '现在可以把模型写入 FastGPT，并自动创建或复用 Dataset / App / API Key。'
                    : '先在部署环境注入 FastGPT root 密码，再回来执行这一步。'}
                </Text>
              </div>
            </StepPanel>

            <StepPanel
              step="4"
              title="保存配置并同步知识"
              titleTip="先保存问答入口、资源绑定和检索策略，再执行全量同步，把博客内容正式写进知识库。"
              hint="保存后，页面配置才会成为实际运行配置。"
              actions={
                <Space wrap className={styles.stepActions}>
                  <Button
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    onClick={onSaveConfig}
                    loading={savingConfig}
                  >
                    保存配置
                  </Button>
                  <Button icon={<SyncOutlined />} onClick={onFullSync} loading={syncing}>
                    全量同步
                  </Button>
                </Space>
              }
            >
              <div className={styles.settingToggleCard}>
                <div className={styles.settingToggleCopy}>
                  <div className={styles.settingToggleTitle}>
                    <TipTitle title="启用 AI 问答" tip={fieldTips.enabled} />
                  </div>
                </div>
                <div className={styles.settingToggleControl}>
                  <Form.Item name="enabled" valuePropName="checked" noStyle>
                    <Switch />
                  </Form.Item>
                </div>
              </div>

              <div className={styles.stepSectionDivider}>资源绑定</div>
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

              <div className={styles.stepSectionDivider}>检索设置</div>
              <Row gutter={12}>
                <Col xs={24} md={12}>
                  <Form.Item
                    label={<TipTitle title="检索模式" tip={fieldTips.searchMode} />}
                    name="searchMode"
                  >
                    <Select options={searchModeOptions} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    label={<TipTitle title="最大 Token 限额" tip={fieldTips.limit} />}
                    name="limit"
                  >
                    <InputNumber min={100} max={20000} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={12}>
                <Col xs={24} md={12}>
                  <Form.Item
                    label={<TipTitle title="最小相似度" tip={fieldTips.similarity} />}
                    name="similarity"
                  >
                    <InputNumber min={0} max={1} step={0.05} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <div className={styles.settingToggleCard}>
                    <div className={styles.settingToggleCopy}>
                      <div className={styles.settingToggleTitle}>
                        <TipTitle title="启用 Rerank" tip={fieldTips.usingReRank} />
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
                  <div className={styles.extensionBoxTitle}>
                    <TipTitle title="启用 Query Extension" tip={fieldTips.queryExtension} />
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
                      <Form.Item
                        label={<TipTitle title="Extension Model" tip={fieldTips.extensionModel} />}
                        name="datasetSearchExtensionModel"
                      >
                        <Input placeholder="例如 gpt-5 / qwen-plus" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item
                        label={
                          <TipTitle
                            title="Extension Background"
                            tip={fieldTips.extensionBackground}
                          />
                        }
                        name="datasetSearchExtensionBg"
                      >
                        <Input.TextArea
                          rows={4}
                          placeholder="补充常见术语、缩写、栏目名或研究方向。"
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                ) : null}
              </div>

              <div className={styles.stepStatusRow}>
                <Tag color={status?.enabled ? 'green' : 'default'}>
                  {status?.enabled ? '问答入口已启用' : '保存后仍可暂不启用'}
                </Tag>
                <Text type="secondary">
                  保存完成后，再点一次全量同步，把文章、草稿和私密文档写进知识库。
                </Text>
              </div>
            </StepPanel>
          </Form>
        </Card>
      </Col>
    </Row>
  );
}

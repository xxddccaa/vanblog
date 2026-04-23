import {
  CodeOutlined,
  ExportOutlined,
  InfoCircleOutlined,
  LaptopOutlined,
  LinkOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { Alert, Button, Card, Space, Spin, Tag, Tooltip, Typography } from 'antd';
import styles from './index.less';

const { Paragraph, Text } = Typography;

const defaultTools = ['opencode', 'python3', 'pip', 'git', 'rg', 'tmux', 'bash'];

function TerminalFact(props) {
  const { label, value, tip } = props;

  return (
    <div className={styles.terminalFactCard}>
      <div className={styles.terminalFactLabel}>
        {label}
        {tip ? (
          <Tooltip title={tip}>
            <QuestionCircleOutlined />
          </Tooltip>
        ) : null}
      </div>
      <div className={styles.terminalFactValue}>{value}</div>
    </div>
  );
}

export default function TerminalTab(props) {
  const {
    status,
    statusLoading,
    connecting,
    connected,
    frameKey,
    frameSrc,
    onConnect,
    onReconnect,
    onOpenWindow,
  } = props;

  const tools = Array.isArray(status?.tools) && status.tools.length ? status.tools : defaultTools;

  return (
    <div className={styles.terminalWorkbench}>
      <div className={styles.chatStatusStrip}>
        <div className={styles.chatStatusLead}>
          <div className={styles.sectionEyebrow}>OpenCode 终端</div>
          <div className={styles.chatStatusTitle}>浏览器里直接进入 server 容器终端</div>
          <div className={styles.chatStatusText}>
            v1 只负责提供终端入口与预装 CLI。进入后请在终端里自行完成 OpenCode provider / login /
            首次配置，不会自动复用本页保存的模型信息。
          </div>
        </div>
        <div className={styles.chatStatusMetrics}>
          <div className={styles.chatStatusMetric}>
            <div className={styles.chatStatusMetricLabel}>终端入口</div>
            <div className={styles.chatStatusMetricValue}>
              {status?.enabled ? '已启用' : '当前部署未启用'}
            </div>
            <div className={styles.chatStatusMetricText}>
              {status?.entryPath || '/admin/ai-terminal'}
            </div>
          </div>
          <div className={styles.chatStatusMetric}>
            <div className={styles.chatStatusMetricLabel}>工作目录</div>
            <div className={styles.chatStatusMetricValue}>
              {status?.workspacePath || '/workspace/vanblog'}
            </div>
            <div className={styles.chatStatusMetricText}>当前部署 / 项目目录会挂载到这里</div>
          </div>
          <div className={styles.chatStatusMetric}>
            <div className={styles.chatStatusMetricLabel}>预装工具</div>
            <div className={styles.chatStatusMetricValue}>opencode / git / rg</div>
            <div className={styles.chatStatusMetricText}>bash、tmux、python3、pip 也已可用</div>
          </div>
        </div>
      </div>

      <Card className={styles.panelCard}>
        <Spin spinning={statusLoading && !status}>
          <div className={styles.terminalIntroGrid}>
            <TerminalFact
              label="工作目录"
              value={<Text code>{status?.workspacePath || '/workspace/vanblog'}</Text>}
              tip="终端默认会从这个目录启动，方便直接操作当前 compose / 项目目录。"
            />
            <TerminalFact
              label="终端 HOME"
              value={<Text code>{status?.homePath || '/app/ai-terminal-home'}</Text>}
              tip="OpenCode 本地配置、缓存和 shell 历史默认都会落在这里，并映射到宿主机。"
            />
            <TerminalFact
              label="入口路径"
              value={<Text code>{status?.entryPath || '/admin/ai-terminal'}</Text>}
              tip="连接终端后，iframe 与新窗口都会打开这个受保护入口。"
            />
          </div>

          <div className={styles.terminalToolStrip}>
            <div className={styles.terminalToolStripHead}>
              <div>
                <div className={styles.sectionEyebrow}>预装工具</div>
                <div className={styles.statusSubsectionTitle}>开箱可用的命令行能力</div>
              </div>
              <Tooltip title="OpenCode 已安装，但 provider / login / 首次配置需要在终端里自己完成。">
                <Button icon={<InfoCircleOutlined />} type="text">
                  使用说明
                </Button>
              </Tooltip>
            </div>

            <Space wrap className={styles.terminalToolTags}>
              {tools.map((tool) => (
                <Tag key={tool} className={styles.terminalToolTag}>
                  {tool}
                </Tag>
              ))}
            </Space>
          </div>
        </Spin>
      </Card>

      {!status?.enabled ? (
        <Card className={styles.panelCard}>
          <div className={styles.terminalDisabledState}>
            <LaptopOutlined className={styles.terminalStateIcon} />
            <div className={styles.chatEmptyTitle}>当前部署未启用 AI 终端</div>
            <Paragraph className={styles.chatEmptyText}>
              这个 tab 会保留在后台，但只有显式叠加 `docker-compose.ai-qa.yml` 或直接使用
              `docker-compose.latest.ai.yml` 时，server 容器才会启动 Wetty 并开放浏览器终端入口。
            </Paragraph>
            <Alert
              type="info"
              showIcon
              className={styles.terminalHintAlert}
              message="启用后会复用现有 server 容器，不会新增独立 terminal service。"
            />
          </div>
        </Card>
      ) : connected ? (
        <Card className={styles.panelCard}>
          <div className={styles.terminalFrameHead}>
            <div>
              <div className={styles.sectionEyebrow}>活动终端</div>
              <div className={styles.statusSubsectionTitle}>当前会话已连接</div>
            </div>
            <Space wrap>
              <Button icon={<ReloadOutlined />} onClick={onReconnect} loading={connecting}>
                重新连接
              </Button>
              <Button icon={<ExportOutlined />} onClick={onOpenWindow} loading={connecting}>
                新窗口打开
              </Button>
            </Space>
          </div>
          <div className={styles.terminalFrameWrap}>
            <iframe
              key={frameKey}
              title="OpenCode 终端"
              src={frameSrc}
              className={styles.terminalFrame}
              allow="clipboard-read; clipboard-write"
            />
          </div>
        </Card>
      ) : (
        <Card className={styles.panelCard}>
          <div className={styles.terminalEmptyState}>
            <CodeOutlined className={styles.terminalStateIcon} />
            <div className={styles.chatEmptyTitle}>点击后为当前管理员创建一次终端会话</div>
            <Paragraph className={styles.chatEmptyText}>
              前端会先调用 <Text code>POST /api/admin/ai-qa/terminal/session</Text> 设置 path-scoped
              HttpOnly cookie，然后再加载
              <Text code>{status?.entryPath || '/admin/ai-terminal'}</Text>。
            </Paragraph>
            <Space wrap>
              <Button
                type="primary"
                size="large"
                icon={<LinkOutlined />}
                onClick={onConnect}
                loading={connecting}
              >
                连接终端
              </Button>
              <Button
                size="large"
                icon={<ExportOutlined />}
                onClick={onOpenWindow}
                loading={connecting}
              >
                新窗口打开
              </Button>
            </Space>
          </div>
        </Card>
      )}
    </div>
  );
}

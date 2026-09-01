import { getSystemLogTail } from '@/services/van-blog/api';
import { Button, Card, Space, Spin } from 'antd';
import { useEffect, useRef, useState } from 'react';
import TerminalDisplay from '@/components/TerminalDisplay';
import { mergeSystemLogLines } from './systemLogState';

type SystemLogProps = {
  fetchTail?: typeof getSystemLogTail;
  pollIntervalMs?: number;
};

export function SystemLog({
  fetchTail = getSystemLogTail,
  pollIntervalMs = 5000,
}: SystemLogProps = {}) {
  const [lines, setLines] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<any>();
  const domRef = useRef<HTMLPreElement>(null);
  const cursorRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);
  const mountedRef = useRef(false);
  const generationRef = useRef(0);

  const fetchLog = async (reset = false) => {
    if ((!reset && inFlightRef.current) || (!reset && document.hidden)) {
      return;
    }
    const generation = reset ? generationRef.current + 1 : generationRef.current;
    if (reset) {
      generationRef.current = generation;
    }
    inFlightRef.current = true;
    try {
      const { data } = await fetchTail(reset ? null : cursorRef.current, 1000);
      if (!mountedRef.current || generation !== generationRef.current) {
        return;
      }
      cursorRef.current = data.nextCursor || null;
      setLines((current) =>
        mergeSystemLogLines(current, {
          data: data.data,
          reset: reset || data.reset,
        }),
      );
    } catch (err) {
    } finally {
      if (generation === generationRef.current) {
        inFlightRef.current = false;
      }
    }
  };
  useEffect(() => {
    mountedRef.current = true;
    setLoading(true);
    fetchLog(true)
      .then(() => {
        setTimeout(() => {
          if (domRef.current) {
            domRef.current.scrollTop = domRef.current.scrollHeight;
          }
        }, 10);
      })
      .finally(() => {
        if (mountedRef.current) {
          setLoading(false);
        }
      });
    timerRef.current = setInterval(() => {
      void fetchLog();
    }, pollIntervalMs);
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        void fetchLog();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
      clearInterval(timerRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);
  return (
    <Card
      title="系统日志（每5s自动刷新）"
      extra={
        <Space>
          <Button
            type="primary"
            onClick={() => {
              setLoading(true);
              fetchLog(true).finally(() => {
                if (mountedRef.current) {
                  setLoading(false);
                }
                setTimeout(() => {
                  if (domRef.current) {
                    domRef.current.scrollTop = domRef.current.scrollHeight;
                  }
                }, 10);
              });
            }}
          >
            手动刷新
          </Button>
        </Space>
      }
    >
      <Spin spinning={loading}>
        <pre
          ref={domRef}
          style={{
            maxHeight: 'calc(100vh - 250px)',
            height: 'calc(100vh - 250px)',
            minHeight: 'calc(100vh - 250px)',
            overflowY: 'auto',
          }}
        >
          <TerminalDisplay content={lines.join('\n')} />
        </pre>
      </Spin>
    </Card>
  );
}

export default function SystemLogTab() {
  return <SystemLog />;
}

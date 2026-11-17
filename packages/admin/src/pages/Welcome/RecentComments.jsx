import { getCommentStats } from '@/services/van-blog/api';
import {
  getCommentExcerpt,
  getCommentNick,
  getCommentStatusMeta,
  unwrapCommentResponse,
} from '@/services/van-blog/comment';
import { publishCommentStats } from '@/services/van-blog/commentPending';
import { MessageOutlined } from '@ant-design/icons';
import { Link, useAccess } from '@umijs/max';
import { Badge, Empty, Spin, Tag } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import style from './index.less';

const RECENT_LIMIT = 5;

const RecentCommentsPanel = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let disposed = false;
    getCommentStats()
      .then((response) => {
        const data = unwrapCommentResponse(response);
        if (disposed) return;
        setStats(data);
        publishCommentStats(data);
      })
      .catch(() => {
        if (!disposed) setFailed(true);
      })
      .finally(() => {
        if (!disposed) setLoading(false);
      });
    return () => {
      disposed = true;
    };
  }, []);

  if (failed) return null;

  const pending = Number(stats?.pending) || 0;
  const recent = Array.isArray(stats?.recent) ? stats.recent.slice(0, RECENT_LIMIT) : [];

  return (
    <section className={style['chart-container']} data-testid="welcome-recent-comments">
      <div className={style['chart-header']}>
        <div className={style['chart-title']}>
          <MessageOutlined className={style['chart-icon']} />
          <span>最近评论</span>
        </div>
        <div className={style['chart-extra']}>
          <Link to="/site/comment?status=pending" className={style['recent-comment-pending']}>
            <span>待审核</span>
            <Badge
              count={pending}
              showZero
              overflowCount={999}
              color={pending ? undefined : '#bfbfbf'}
            />
          </Link>
        </div>
      </div>
      <Spin spinning={loading}>
        {recent.length ? (
          <ul className={style['recent-comment-list']}>
            {recent.map((item) => {
              const meta = getCommentStatusMeta(item.status);
              return (
                <li key={item.id}>
                  <Link
                    to={
                      item.status === 'pending' ? '/site/comment?status=pending' : '/site/comment'
                    }
                    className={style['recent-comment-item']}
                  >
                    <div className={style['recent-comment-head']}>
                      <span className={style['recent-comment-nick']}>{getCommentNick(item)}</span>
                      {item.status !== 'approved' ? (
                        <Tag color={meta.color}>{meta.text}</Tag>
                      ) : null}
                      <span className={style['recent-comment-meta']}>
                        {item.targetTitle ? `${item.targetTitle} · ` : ''}
                        {item.createdAt ? dayjs(item.createdAt).format('MM-DD HH:mm') : ''}
                      </span>
                    </div>
                    <div className={style['recent-comment-content']}>
                      {getCommentExcerpt(item.content, 80) || '（空）'}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : loading ? (
          <div style={{ minHeight: 60 }} />
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无评论" />
        )}
      </Spin>
    </section>
  );
};

/** Comment moderation is super-admin only, so collaborators never request it. */
export default function RecentComments() {
  const access = useAccess();
  if (!access?.isSuperAdmin) return null;
  return <RecentCommentsPanel />;
}

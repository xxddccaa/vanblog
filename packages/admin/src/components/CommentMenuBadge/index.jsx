import {
  useCommentPendingCount,
  useCommentPendingPolling,
} from '@/services/van-blog/commentPending';
import { Link } from '@umijs/max';
import { Badge } from 'antd';
import { cloneElement, isValidElement } from 'react';

export const COMMENT_MENU_PATH = '/site/comment';

export const CommentPendingSync = ({ enabled }) => {
  useCommentPendingPolling(Boolean(enabled));
  return null;
};

export const CommentPendingBadge = () => {
  const count = useCommentPendingCount();
  if (!count) return null;
  return (
    <Badge
      count={count}
      overflowCount={99}
      size="small"
      title={`${count} 条评论待审核`}
      data-testid="comment-menu-pending-badge"
    />
  );
};

const withPendingBadge = (defaultDom) => {
  const badge = <CommentPendingBadge key="comment-pending-badge" />;
  if (isValidElement(defaultDom)) {
    const children = defaultDom.props?.children;
    return cloneElement(
      defaultDom,
      undefined,
      ...(Array.isArray(children) ? children : [children]),
      badge,
    );
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      {defaultDom}
      {badge}
    </span>
  );
};

/**
 * Same behaviour as the default menu item renderer of the umi layout plugin,
 * plus the pending comment badge on the comment management entry.
 */
export const renderAdminMenuItem = (menuItemProps, defaultDom) => {
  const dom = menuItemProps?.path === COMMENT_MENU_PATH ? withPendingBadge(defaultDom) : defaultDom;
  if (menuItemProps?.isUrl || menuItemProps?.children) {
    return dom;
  }
  if (menuItemProps?.path && !menuItemProps.replace) {
    return (
      <Link to={menuItemProps.path.replace('/*', '')} target={menuItemProps.target}>
        {dom}
      </Link>
    );
  }
  return dom;
};

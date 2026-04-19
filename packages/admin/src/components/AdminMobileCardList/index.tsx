import { Empty, Pagination, Spin } from 'antd';
import React from 'react';

type PaginationConfig = {
  current?: number;
  pageSize?: number;
  total?: number;
  onChange?: (page: number, pageSize: number) => void;
  pageSizeOptions?: string[];
  showSizeChanger?: boolean;
};

type AdminMobileCardListProps<T> = {
  items: T[];
  loading?: boolean;
  rowKey?: keyof T | ((item: T, index: number) => React.Key);
  emptyText?: React.ReactNode;
  renderCard: (item: T, index: number) => React.ReactNode;
  pagination?: PaginationConfig;
};

const getRowKey = <T,>(item: T, index: number, rowKey?: AdminMobileCardListProps<T>['rowKey']) => {
  if (typeof rowKey === 'function') {
    return rowKey(item, index);
  }

  if (rowKey && item && typeof item === 'object' && rowKey in item) {
    return (item as Record<string, React.Key>)[rowKey as string];
  }

  return index;
};

export default function AdminMobileCardList<T>(props: AdminMobileCardListProps<T>) {
  const { items, loading = false, rowKey, emptyText = '暂无数据', renderCard, pagination } = props;

  return (
    <Spin spinning={loading}>
      <div className="admin-mobile-card-list">
        {items.length ? (
          items.map((item, index) => (
            <div key={getRowKey(item, index, rowKey)} className="admin-mobile-card-list-item">
              {renderCard(item, index)}
            </div>
          ))
        ) : (
          <div className="admin-mobile-card-list-empty">
            <Empty description={emptyText} />
          </div>
        )}
      </div>
      {pagination && items.length ? (
        <div className="admin-mobile-card-list-pagination">
          <Pagination
            size="small"
            current={pagination.current}
            pageSize={pagination.pageSize}
            total={pagination.total}
            onChange={pagination.onChange}
            pageSizeOptions={pagination.pageSizeOptions}
            showSizeChanger={pagination.showSizeChanger}
            simple
          />
        </div>
      ) : null}
    </Spin>
  );
}

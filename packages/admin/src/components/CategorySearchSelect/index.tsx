import { getAllCategories } from '@/services/van-blog/api';
import { AutoComplete } from 'antd';
import type { AutoCompleteProps } from 'antd';
import { useEffect, useMemo, useState } from 'react';

let cachedCategories: string[] | null = null;
let pendingCategories: Promise<string[]> | null = null;

const loadCategories = (): Promise<string[]> => {
  if (cachedCategories) {
    return Promise.resolve(cachedCategories);
  }
  if (!pendingCategories) {
    pendingCategories = getAllCategories()
      .then(({ data }) => {
        const list = Array.from(
          new Set(
            (Array.isArray(data) ? data : [])
              .map((item) => String(item || '').trim())
              .filter(Boolean),
          ),
        );
        cachedCategories = list;
        return list;
      })
      .catch(() => {
        pendingCategories = null;
        return [] as string[];
      });
  }
  return pendingCategories;
};

const filterCategoryOption = (input: string, option?: { label?: unknown; value?: unknown }) => {
  const text = String(option?.label ?? option?.value ?? '').toLowerCase();
  return text.includes(String(input ?? '').toLowerCase());
};

export default function CategorySearchSelect({
  placeholder = '搜索或输入分类',
  ...rest
}: AutoCompleteProps) {
  const [categories, setCategories] = useState<string[]>(cachedCategories || []);

  useEffect(() => {
    let alive = true;
    loadCategories().then((list) => {
      if (alive) {
        setCategories(list);
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  const options = useMemo(
    () => categories.map((item) => ({ label: item, value: item })),
    [categories],
  );

  return (
    <AutoComplete
      allowClear={true}
      options={options}
      placeholder={placeholder}
      filterOption={filterCategoryOption}
      {...rest}
    />
  );
}

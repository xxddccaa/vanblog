import { fireEvent, render, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAllCategoriesMock = vi.fn();

vi.mock('@/services/van-blog/api', () => ({
  getAllCategories: (...args: unknown[]) => getAllCategoriesMock(...args),
}));

const openDropdown = async (container: HTMLElement) => {
  const combo = container.querySelector('input[role="combobox"]') as HTMLInputElement;
  expect(combo).toBeTruthy();
  fireEvent.focus(combo);
  fireEvent.mouseDown(combo);
  return combo;
};

const renderedOptions = () => {
  const dropdowns = Array.from(document.querySelectorAll('.ant-select-dropdown'));
  const current = dropdowns[dropdowns.length - 1];
  if (!current) {
    return [];
  }
  return Array.from(current.querySelectorAll('.ant-select-item-option')).map(
    (item) => item.textContent || '',
  );
};

const loadComponent = async () => {
  const module = await import('./index');
  return module.default;
};

describe('CategorySearchSelect', () => {
  beforeEach(() => {
    document.querySelectorAll('.ant-select-dropdown').forEach((node) => node.remove());
    getAllCategoriesMock.mockReset();
    getAllCategoriesMock.mockResolvedValue({ data: ['前端', '后端', 'Java', ''] });
    vi.resetModules();
  });

  it('拉取分类作为候选项', async () => {
    const CategorySearchSelect = await loadComponent();
    const { container } = render(<CategorySearchSelect />);

    const combo = await openDropdown(container);
    expect(combo.value).toBe('');
    await waitFor(() => expect(renderedOptions()).toEqual(['前端', '后端', 'Java']));
  });

  it('输入时按子串过滤候选项，忽略大小写', async () => {
    const CategorySearchSelect = await loadComponent();
    const { container } = render(<CategorySearchSelect />);

    const combo = await openDropdown(container);
    await waitFor(() => expect(renderedOptions().length).toBe(3));

    fireEvent.change(combo, { target: { value: '后' } });
    await waitFor(() => expect(renderedOptions()).toEqual(['后端']));

    fireEvent.change(combo, { target: { value: 'java' } });
    await waitFor(() => expect(renderedOptions()).toEqual(['Java']));
  });

  it('输入不存在的分类时，仍以输入文本回调 onChange', async () => {
    const CategorySearchSelect = await loadComponent();
    const onChange = vi.fn();
    const { container } = render(<CategorySearchSelect onChange={onChange} />);

    const combo = await openDropdown(container);
    await waitFor(() => expect(renderedOptions().length).toBe(3));

    fireEvent.change(combo, { target: { value: '不存在的分类' } });
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('不存在的分类', expect.anything()));
    // jsdom 下动画不会结束，旧候选项节点会残留，这里以「无数据」状态断言
    await waitFor(() =>
      expect(document.querySelectorAll('.ant-select-dropdown-empty').length).toBe(1),
    );
  });

  it('选中候选项时回调该分类', async () => {
    const CategorySearchSelect = await loadComponent();
    const onChange = vi.fn();
    const { container } = render(<CategorySearchSelect onChange={onChange} />);

    const combo = await openDropdown(container);
    await waitFor(() => expect(renderedOptions().length).toBe(3));
    fireEvent.change(combo, { target: { value: '前端' } });
    await waitFor(() => expect(renderedOptions()).toEqual(['前端']));
    const dropdowns = Array.from(document.querySelectorAll('.ant-select-dropdown'));
    const current = dropdowns[dropdowns.length - 1];
    fireEvent.click(current.querySelector('.ant-select-item-option') as HTMLElement);

    await waitFor(() => expect(combo.value).toBe('前端'));
    expect(onChange).toHaveBeenCalled();
  });

  it('多次挂载只请求一次分类', async () => {
    const CategorySearchSelect = await loadComponent();
    const first = render(<CategorySearchSelect />);
    await waitFor(() => expect(getAllCategoriesMock).toHaveBeenCalledTimes(1));
    first.unmount();

    render(<CategorySearchSelect />);
    await waitFor(() => expect(getAllCategoriesMock).toHaveBeenCalledTimes(1));
  });

  it('分类接口失败时降级为空候选项而不报错', async () => {
    getAllCategoriesMock.mockRejectedValue(new Error('boom'));
    const CategorySearchSelect = await loadComponent();
    const { container } = render(<CategorySearchSelect />);

    const combo = await openDropdown(container);
    expect(combo).toBeTruthy();
    await waitFor(() => expect(getAllCategoriesMock).toHaveBeenCalledTimes(1));
    expect(renderedOptions()).toEqual([]);
  });
});

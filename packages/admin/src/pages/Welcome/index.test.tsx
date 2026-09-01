import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type WelcomeLoads = {
  overview: number;
  viewer: number;
  article: number;
};

const getWelcomeLoads = () =>
  (globalThis as typeof globalThis & { __welcomeLoads: WelcomeLoads }).__welcomeLoads;

vi.mock('@/services/van-blog/useTab', async () => {
  const React = await import('react');
  return {
    useTab: (initial: string) => React.useState(initial),
  };
});

vi.mock('antd', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  Grid: {
    useBreakpoint: () => ({ md: true, sm: true, xs: false }),
  },
  Spin: () => <div data-testid="welcome-spin" />,
}));

vi.mock('@ant-design/pro-layout', () => ({
  PageContainer: ({ children, tabList, onTabChange }: any) => (
    <div>
      <nav>
        {(tabList || []).map((item: any) => (
          <button key={item.key} type="button" onClick={() => onTabChange(item.key)}>
            {item.tab}
          </button>
        ))}
      </nav>
      {children}
    </div>
  ),
}));

vi.mock('@ant-design/icons', () => {
  const Icon = () => null;
  return {
    BarChartOutlined: Icon,
    DotChartOutlined: Icon,
    FundProjectionScreenOutlined: Icon,
  };
});

vi.mock('./tabs/overview', () => {
  getWelcomeLoads().overview += 1;
  return {
    default: () => <div data-testid="overview-tab" />,
  };
});

vi.mock('./tabs/viewer', () => {
  getWelcomeLoads().viewer += 1;
  return {
    default: () => <div data-testid="viewer-tab" />,
  };
});

vi.mock('./tabs/article', () => {
  getWelcomeLoads().article += 1;
  return {
    default: () => <div data-testid="article-tab" />,
  };
});

describe('Welcome tab loading', () => {
  beforeEach(() => {
    vi.resetModules();
    (globalThis as typeof globalThis & { __welcomeLoads: WelcomeLoads }).__welcomeLoads = {
      overview: 0,
      viewer: 0,
      article: 0,
    };
  });

  afterEach(() => {
    cleanup();
  });

  it('loads only the active tab and fetches other chart tabs after switching', async () => {
    const { default: Welcome } = await import('./index');
    render(<Welcome />);

    expect(await screen.findByTestId('overview-tab')).not.toBeNull();
    expect(getWelcomeLoads()).toEqual({
      overview: 1,
      viewer: 0,
      article: 0,
    });

    fireEvent.click(screen.getByRole('button', { name: '访客统计' }));
    expect(await screen.findByTestId('viewer-tab')).not.toBeNull();
    await waitFor(() =>
      expect(getWelcomeLoads()).toEqual({
        overview: 1,
        viewer: 1,
        article: 0,
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: '文章分析' }));
    expect(await screen.findByTestId('article-tab')).not.toBeNull();
    expect(getWelcomeLoads()).toEqual({
      overview: 1,
      viewer: 1,
      article: 1,
    });
  });

  it('shows a local error and recreates a rejected tab loader on retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { default: Welcome } = await import('./index');
    const Overview = () => <div data-testid="overview-recovered" />;
    const Viewer = () => <div data-testid="viewer-recovered" />;
    const Article = () => <div data-testid="article-recovered" />;
    const viewerLoader = vi
      .fn()
      .mockRejectedValueOnce(new Error('viewer chunk failed'))
      .mockResolvedValueOnce({ default: Viewer });
    const tabLoaders = {
      overview: vi.fn().mockResolvedValue({ default: Overview }),
      viewer: viewerLoader,
      article: vi.fn().mockResolvedValue({ default: Article }),
    };

    render(<Welcome tabLoaders={tabLoaders} />);
    expect(await screen.findByTestId('overview-recovered')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /访客统计/ }));
    expect(await screen.findByTestId('welcome-tab-error')).not.toBeNull();
    expect(viewerLoader).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: '重试' }));
    expect(await screen.findByTestId('viewer-recovered')).not.toBeNull();
    expect(viewerLoader).toHaveBeenCalledTimes(2);
  });
});

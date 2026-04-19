import ResponsivePageTabs from '@/components/ResponsivePageTabs';
import AnimationEffects from '@/components/AnimationEffects';
import MarkdownThemeSelector from '@/components/MarkdownThemeSelector';
import { getLayoutConfig, updateLayoutConfig } from '@/services/van-blog/api';
import { getSiteInfo, updateSiteInfo } from '@/services/van-blog/api';
import useAdminResponsive from '@/services/van-blog/useAdminResponsive';
import { useTab } from '@/services/van-blog/useTab';
import { Button, Card, message, Modal, Spin } from 'antd';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';

const CodeEditor = lazy(() => import('@/components/CodeEditor'));

export default function () {
  const { mobile } = useAdminResponsive();
  const tabKeys = ['mdTheme', 'animations', 'css', 'script', 'html', 'head'];
  const [tab, setTab] = useTab('animations', 'customTab', tabKeys);
  const [loading, setLoading] = useState(true);
  const [values, setValues] = useState({
    css: '',
    script: '',
    html: '',
    head: '',
    animations: {
      enabled: true, // 设为true以便初始时动画可以生效
      snowflake: {
        enabled: false,
        color: '#ff69b4',
        count: 120,
        speed: 1.0,
        size: 0.8,
      },
      particles: {
        enabled: false,
        color: '#000000',
        darkColor: '#ffffff',
        count: 99,
        opacity: 0.5,
        zIndex: -1,
      },
      heartClick: {
        enabled: false,
      },
    },
  });
  const [themeValues, setThemeValues] = useState({
    markdownLightThemeUrl: '',
    markdownDarkThemeUrl: '',
    markdownLightThemePreset: '',
    markdownDarkThemePreset: '',
  });
  const cardRef = useRef();
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [layoutRes, siteInfoRes] = await Promise.all([getLayoutConfig(), getSiteInfo()]);

      if (layoutRes.data) {
        setValues((prev) => ({
          css: layoutRes.data?.css || '',
          script: layoutRes.data?.script || '',
          html: layoutRes.data?.html || '',
          head: layoutRes.data?.head || '',
          animations: layoutRes.data?.animations || prev.animations,
        }));
      }

      if (siteInfoRes.data) {
        setThemeValues({
          markdownLightThemeUrl: siteInfoRes.data?.markdownLightThemeUrl || '',
          markdownDarkThemeUrl: siteInfoRes.data?.markdownDarkThemeUrl || '',
          markdownLightThemePreset: siteInfoRes.data?.markdownLightThemePreset || '',
          markdownDarkThemePreset: siteInfoRes.data?.markdownDarkThemePreset || '',
        });
      }
    } catch (err) {
      throw err;
    } finally {
      setLoading(false);
    }
  }, [setValues, setThemeValues, setLoading]);
  const handleSave = async () => {
    Modal.confirm({
      title: '保存确认',
      content:
        '在保存前请确认代码的正确性,有问题的代码可能导致前台报错！如不生效，请检查是否在站点配置/布局设置中打开了客制化功能。',
      onOk: async () => {
        setLoading(true);
        try {
          // 保存布局配置
          await updateLayoutConfig(values);

          // 同步保存 Markdown 主题配置（避免用户切换到其他tab后点击“保存”导致主题未写入）
          await updateSiteInfo(themeValues);

          setLoading(false);
          message.success('更新成功！');
        } catch (err) {
          throw err;
        } finally {
          setLoading(false);
        }
      },
    });
  };
  const handleReset = async () => {
    fetchData();
    message.success('重置成功！');
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);
  const languageMap = {
    css: 'css',
    script: 'javascript',
    html: 'html',
    head: 'html',
  };
  const isCodeTab = ['css', 'script', 'html', 'head'].includes(tab);

  const tabList = [
    {
      key: 'mdTheme',
      label: '🎨 Markdown 主题',
      shortLabel: 'Markdown',
    },
    {
      key: 'animations',
      label: '🎭 动画效果',
      shortLabel: '动画',
    },
    {
      key: 'css',
      label: '自定义 CSS',
      shortLabel: 'CSS',
    },
    {
      key: 'script',
      label: '自定义 Script',
      shortLabel: 'Script',
    },
    {
      key: 'html',
      label: '自定义 HTML (body)',
      shortLabel: 'HTML body',
    },
    {
      key: 'head',
      label: '自定义 HTML (head)',
      shortLabel: 'HTML head',
    },
  ];
  return (
    <>
      <Card
        ref={cardRef}
        tabList={
          mobile
            ? undefined
            : tabList.map((item) => ({
                key: item.key,
                tab: item.label,
              }))
        }
        onTabChange={setTab}
        activeTabKey={tab}
        defaultActiveTabKey={'animations'}
        className="card-body-full"
        actions={[
          <Button type="link" key="save" onClick={handleSave}>
            保存
          </Button>,
          <Button type="link" key="reset" onClick={handleReset}>
            重置
          </Button>,
        ]}
      >
        {mobile ? <ResponsivePageTabs items={tabList} activeKey={tab} onChange={setTab} /> : null}
        <Spin spinning={loading}>
          {tab == 'mdTheme' && (
            <MarkdownThemeSelector
              value={themeValues}
              onChange={(newThemeValues) => {
                setThemeValues(newThemeValues);
              }}
            />
          )}
          {tab == 'animations' && (
            <AnimationEffects
              value={values.animations}
              onChange={(animations) => {
                setValues({ ...values, animations });
              }}
            />
          )}
          {isCodeTab && (
            <Suspense
              fallback={
                <div style={{ padding: '48px 0', textAlign: 'center' }}>
                  <Spin />
                </div>
              }
            >
              <CodeEditor
                height={mobile ? 420 : 600}
                language={languageMap[tab]}
                onChange={(v) => {
                  setValues({ ...values, [tab]: v });
                }}
                value={values[tab] || ''}
              />
            </Suspense>
          )}
        </Spin>
      </Card>
    </>
  );
}

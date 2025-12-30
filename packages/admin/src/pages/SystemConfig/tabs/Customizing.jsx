import CodeEditor from '@/components/CodeEditor';
import AnimationEffects from '@/components/AnimationEffects';
import MarkdownThemeSelector from '@/components/MarkdownThemeSelector';
import { getLayoutConfig, updateLayoutConfig } from '@/services/van-blog/api';
import { getSiteInfo, updateSiteInfo } from '@/services/van-blog/api';
import { useTab } from '@/services/van-blog/useTab';
import { Button, Card, message, Modal, Spin } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';

export default function () {
  const [tab, setTab] = useTab('animations', 'customTab');
  const [loading, setLoading] = useState(true);
  const [values, setValues] = useState({
    css: '',
    script: '',
    html: '',
    head: '',
    animations: {
      enabled: true,  // 设为true以便初始时动画可以生效
      snowflake: {
        enabled: false,
        color: '#ff69b4',
        count: 120,
        speed: 1.0,
        size: 0.8
      },
      particles: {
        enabled: false,
        color: '#000000',
        darkColor: '#ffffff',
        count: 99,
        opacity: 0.5,
        zIndex: -1
      },
      heartClick: {
        enabled: false
      }
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
      const [layoutRes, siteInfoRes] = await Promise.all([
        getLayoutConfig(),
        getSiteInfo(),
      ]);
      
      if (layoutRes.data) {
        setValues(prev => ({
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

  const tabList = [
    {
      key: 'mdTheme',
      tab: '🎨 Markdown 主题',
    },
    {
      key: 'animations',
      tab: '🎭 动画效果',
    },
    {
      key: 'css',
      tab: '自定义 CSS',
    },
    {
      key: 'script',
      tab: '自定义 Script',
    },
    {
      key: 'html',
      tab: '自定义 HTML (body)',
    },
    {
      key: 'head',
      tab: '自定义 HTML (head)',
    },
  ];
  return (
    <>
      <Card
        ref={cardRef}
        tabList={tabList}
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
          {tab == 'css' && (
            <CodeEditor
              height={600}
              language={languageMap[tab]}
              onChange={(v) => {
                setValues({ ...values, [tab]: v });
              }}
              value={values[tab] || ''}
            />
          )}
          {tab == 'script' && (
            <CodeEditor
              height={600}
              language={languageMap[tab]}
              onChange={(v) => {
                setValues({ ...values, [tab]: v });
              }}
              value={values[tab] || ''}
            />
          )}
          {tab == 'html' && (
            <CodeEditor
              height={600}
              language={languageMap[tab]}
              onChange={(v) => {
                setValues({ ...values, [tab]: v });
              }}
              value={values[tab] || ''}
            />
          )}
          {tab == 'head' && (
            <CodeEditor
              height={600}
              language={languageMap[tab]}
              onChange={(v) => {
                setValues({ ...values, [tab]: v });
              }}
              value={values[tab] || ''}
            />
          )}
        </Spin>
      </Card>
    </>
  );
}

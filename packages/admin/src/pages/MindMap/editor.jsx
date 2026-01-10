import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { PageContainer } from '@ant-design/pro-layout';
import { Card, Button, Space, message, Spin, Input, Modal } from 'antd';
import {
  SaveOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons';
import { history, useLocation } from 'umi';
import {
  getMindMapById,
  updateMindMap,
} from '@/services/van-blog/api';
import './editor.less';

export default function MindMapEditor() {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mindMapData, setMindMapData] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const iframeRef = useRef(null);
  const mindMapContentRef = useRef(null); // 使用 ref 存储思维导图内容
  const saveHandlerRef = useRef(null); // 用于在 iframe 中引用保存函数

  // 使用稳定的缓存破坏参数，只在组件挂载时生成一次
  const iframeCacheBuster = useMemo(() => Date.now(), []);
  
  // 从URL获取ID
  const getMindMapId = () => {
    const params = new URLSearchParams(location.search);
    return params.get('id');
  };
  
  // 获取当前思维导图 ID，用作 iframe 的 key
  const currentMindMapId = getMindMapId();

  // 加载思维导图数据
  const loadMindMapData = useCallback(async () => {
    const id = getMindMapId();
    if (!id) {
      message.error('缺少思维导图ID');
      history.push('/mindmap');
      return;
    }

    setLoading(true);
    try {
      const { data } = await getMindMapById(id);
      
      setMindMapData(data);
      setTitle(data.title);
      setDescription(data.description || '');
      
      // 解析并存储初始数据
      try {
        let parsedContent;
        if (data.content) {
          // 如果 content 是字符串，需要解析
          if (typeof data.content === 'string') {
            parsedContent = JSON.parse(data.content);
          } else {
            // 如果已经是对象，直接使用
            parsedContent = data.content;
          }
        } else {
          // 如果没有 content，使用默认数据（格式要和保存的数据一致）
          parsedContent = {
            root: {
              data: {
                text: '根节点'
              },
              children: []
            },
            theme: {
              template: 'avocado',
              config: {}
            },
            layout: 'logicalStructure',
            view: null
          };
          console.warn('数据库中没有 content 数据，使用默认数据');
        }
        
        mindMapContentRef.current = parsedContent;
      } catch (e) {
        console.error('解析思维导图数据失败:', e);
      }
      
      // 注意：initMindMap 将在 iframe onLoad 事件中调用
    } catch (error) {
      message.error('加载思维导图数据失败');
      history.push('/mindmap');
    } finally {
      setLoading(false);
    }
  }, [location]);

  useEffect(() => {
    loadMindMapData();
  }, [loadMindMapData]);

  // 更新 saveHandlerRef，使其始终指向最新的 handleSave
  useEffect(() => {
    saveHandlerRef.current = handleSave;
  }, [handleSave]);

  // 添加 Ctrl+S 快捷键监听（外部窗口）
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+S 或 Cmd+S (Mac)
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (saveHandlerRef.current) {
          saveHandlerRef.current();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // 监听来自 iframe 的保存消息
  useEffect(() => {
    const handleMessage = (event) => {
      // 安全检查：确保消息来自同源
      if (event.data && event.data.type === 'MINDMAP_SAVE') {
        if (saveHandlerRef.current) {
          saveHandlerRef.current();
        }
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  // 初始化思维导图
  const initMindMap = (data) => {
    if (!iframeRef.current) {
      console.error('iframe 未加载');
      return;
    }

    const iframe = iframeRef.current;
    const iframeWindow = iframe.contentWindow;

    if (!iframeWindow) {
      console.error('iframe window 未加载');
      return;
    }

    console.log('===== 初始化思维导图 =====');
    console.log('思维导图 ID:', currentMindMapId);
    console.log('数据包含的字段:', mindMapContentRef.current ? Object.keys(mindMapContentRef.current) : '无数据');
    
    // HTML 中已经设置了 takeOverApp = true
    // 当 app.js 执行时，会检测到并设置 window.initApp（但不会自动调用）
    // 我们只需要设置全局方法，然后调用 initApp
    
    // 设置全局方法（必须在调用 initApp 之前设置）
    iframeWindow.takeOverAppMethods = {
      getMindMapData: () => {
        const data = mindMapContentRef.current;
        return data;
      },
      saveMindMapData: (newData) => {
        // 实时更新本地缓存的思维导图数据
        const currentData = mindMapContentRef.current || {};
        const dataKeys = Object.keys(newData);
        const currentKeys = Object.keys(currentData);
        
        // 如果传入的数据不完整（字段少于4个），合并到现有数据
        if (dataKeys.length < 4 && currentKeys.length >= 4) {
          mindMapContentRef.current = {
            ...currentData,
            ...newData
          };
        } else {
          // 如果传入的数据是完整的，直接替换
          mindMapContentRef.current = newData;
        }
      },
      getMindMapConfig: () => {
        return {};
      },
      saveMindMapConfig: (config) => {
        // 配置已更新
      },
      getLanguage: () => {
        return 'zh';
      },
      saveLanguage: (lang) => {
        // 语言已更新
      },
      getLocalConfig: () => {
        return null;
      },
      saveLocalConfig: (config) => {
        // 本地配置已更新
      },
    };

    // 在 iframe 内部添加 Ctrl+S 快捷键监听
    const setupIframeKeyboardListener = () => {
      if (iframeWindow.document) {
        iframeWindow.document.addEventListener('keydown', (e) => {
          // Ctrl+S 或 Cmd+S (Mac)
          if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            // 通过 postMessage 通知父窗口保存
            window.postMessage({ type: 'MINDMAP_SAVE' }, '*');
          }
        });
      }
    };

    // 在 takeOverApp 模式下，需要手动调用 initApp 来启动 Vue 应用
    // 因为 JavaScript 文件可能还在加载中，需要轮询等待 initApp 函数
    console.log('准备启动 Vue 应用，等待 initApp 函数加载...');

    let initRetryCount = 0;
    const maxInitRetries = 50; // 最多等待 10 秒

    const tryInitApp = () => {
      initRetryCount++;

      if (iframeWindow.initApp && typeof iframeWindow.initApp === 'function') {
        console.log('✅ 找到 initApp 函数，启动 Vue 应用');
        iframeWindow.initApp();

        // 设置 iframe 内部的键盘监听
        setupIframeKeyboardListener();

        // Vue 应用启动后，数据会自动从 getMindMapData 加载
        // 等待 Vue 应用完全启动后，通过 setData 事件确保数据加载
        setTimeout(() => {
          if (iframeWindow.$bus && iframeWindow.$bus.$emit) {
            console.log('✅ 通过 $bus 发送 setData 事件');
            iframeWindow.$bus.$emit('setData', mindMapContentRef.current);
          }
        }, 1000);
      } else if (initRetryCount < maxInitRetries) {
        if (initRetryCount % 10 === 0) {
          console.log(`等待 initApp 函数... (${initRetryCount}/${maxInitRetries})`);
        }
        setTimeout(tryInitApp, 200);
      } else {
        console.error('等待 initApp 函数超时，Vue 应用无法启动');
      }
    };

    // 延迟一点开始检查，给 JavaScript 文件一些加载时间
    setTimeout(tryInitApp, 300);
  };

  // 保存思维导图
  const handleSave = useCallback(async () => {
    const id = getMindMapId();
    if (!id) {
      message.error('缺少思维导图ID');
      return;
    }

    // 防止重复保存
    if (saving) {
      console.log('正在保存中，跳过本次保存请求');
      return;
    }

    setSaving(true);
    try {
      // 尝试从 iframe 获取最新完整数据
      const iframe = iframeRef.current;
      const iframeWindow = iframe?.contentWindow;
      let currentData = mindMapContentRef.current;
      
      // 如果 iframe 中有思维导图实例，尝试获取完整数据
      if (iframeWindow && iframeWindow.takeOverAppMethods) {
        // 先尝试从 iframe 获取完整数据
        if (iframeWindow.takeOverAppMethods.getMindMapData) {
          const iframeData = iframeWindow.takeOverAppMethods.getMindMapData();
          if (iframeData) {
            const iframeKeys = Object.keys(iframeData);
            const currentKeys = currentData ? Object.keys(currentData) : [];
            
            // 如果 iframe 中的数据更完整（字段更多），使用 iframe 的数据
            if (iframeKeys.length >= currentKeys.length) {
              console.log('使用 iframe 中的完整数据');
              currentData = iframeData;
              mindMapContentRef.current = iframeData;
            }
          }
        }
      }
      
      if (!currentData) {
        message.error('无法获取思维导图数据');
        setSaving(false);
        return;
      }
      
      // 检查数据是否完整（应该包含 root, layout, theme, view 等字段）
      const dataKeys = Object.keys(currentData);
      const requiredKeys = ['root', 'layout', 'theme'];
      const missingKeys = requiredKeys.filter(key => !dataKeys.includes(key));
      
      if (missingKeys.length > 0) {
        console.warn('数据不完整，缺少字段:', missingKeys);
      }
      
      // 使用当前 title state，如果为空则使用原始数据中的标题
      const currentTitle = title || mindMapData?.title || '未命名思维导图';
      const currentDescription = description !== undefined ? description : (mindMapData?.description || '');

      const payload = {
        title: currentTitle,
        description: currentDescription,
        content: JSON.stringify(currentData),
      };
      
      await updateMindMap(id, payload);
      
      // 更新本地 state
      setMindMapData({
        ...mindMapData,
        title: payload.title,
        description: payload.description,
        content: payload.content,
      });
      
      console.log('===== 保存操作完成 =====');
      
      message.success('保存成功');
    } catch (error) {
      console.error('===== 保存失败 =====');
      console.error('错误信息:', error);
      message.error('保存失败: ' + (error.message || '未知错误'));
    } finally {
      setSaving(false);
    }
  }, [mindMapData, title, description, saving]);

  // 更新标题和描述
  const handleUpdateInfo = async () => {
    const id = getMindMapId();
    if (!id) {
      message.error('缺少思维导图ID');
      return;
    }

    if (!title.trim()) {
      message.error('标题不能为空');
      return;
    }

    try {
      // 获取当前最新的思维导图内容
      let currentContent = mindMapContentRef.current;
      
      // 尝试从 iframe 获取最新数据
      const iframe = iframeRef.current;
      const iframeWindow = iframe?.contentWindow;
      if (iframeWindow && iframeWindow.takeOverAppMethods && iframeWindow.takeOverAppMethods.getMindMapData) {
        const iframeData = iframeWindow.takeOverAppMethods.getMindMapData();
        if (iframeData) {
          currentContent = iframeData;
          mindMapContentRef.current = iframeData;
        }
      }
      
      await updateMindMap(id, {
        title: title.trim(),
        description: description.trim(),
        content: currentContent ? JSON.stringify(currentContent) : mindMapData.content, // 使用最新内容
      });
      
      setMindMapData({
        ...mindMapData,
        title: title.trim(),
        description: description.trim(),
        content: currentContent ? JSON.stringify(currentContent) : mindMapData.content,
      });
      
      message.success('更新成功');
      setShowEditModal(false);
    } catch (error) {
      message.error('更新失败');
    }
  };

  return (
    <PageContainer
      title={
        <Space>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => history.push('/mindmap')}
          >
            返回
          </Button>
          <span>{mindMapData?.title || '加载中...'}</span>
        </Space>
      }
      extra={
        <Space>
          <Button onClick={() => setShowEditModal(true)}>
            编辑信息
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={saving}
            onClick={handleSave}
            title="保存到数据库 (Ctrl+S)"
          >
            保存 (Ctrl+S)
          </Button>
        </Space>
      }
    >
      <Card className="mindmap-editor-card" bodyStyle={{ padding: 0, height: 'calc(100vh - 200px)' }}>
        {loading ? (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            height: '100%' 
          }}>
            <Spin size="large" tip="加载中..." />
          </div>
        ) : (
          <iframe
            key={currentMindMapId}  // 添加 key，当 ID 变化时强制重建 iframe
            ref={iframeRef}
            src={`/admin/mindmap/index.html?v=${iframeCacheBuster}`}  // 使用稳定的缓存破坏参数
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
            }}
            title="思维导图编辑器"
            onLoad={() => {
              console.log('iframe 加载完成，初始化思维导图');
              // 立即初始化，不要延迟
              // 因为我们需要在 JavaScript 执行之前设置好 takeOverApp 和方法
              initMindMap(mindMapData);
            }}
          />
        )}
      </Card>

      <Modal
        title="编辑思维导图信息"
        open={showEditModal}
        onOk={handleUpdateInfo}
        onCancel={() => {
          setShowEditModal(false);
          setTitle(mindMapData?.title || '');
          setDescription(mindMapData?.description || '');
        }}
        okText="确定"
        cancelText="取消"
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <div style={{ marginBottom: 8 }}>标题 *</div>
            <Input
              placeholder="请输入思维导图标题"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
            />
          </div>
          <div>
            <div style={{ marginBottom: 8 }}>描述</div>
            <Input.TextArea
              placeholder="请输入思维导图描述（可选）"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              maxLength={500}
            />
          </div>
        </Space>
      </Modal>
    </PageContainer>
  );
}


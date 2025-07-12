import Editor from '@/components/Editor';
import EditorProfileModal from '@/components/EditorProfileModal';
import PublishDraftModal from '@/components/PublishDraftModal';
import Tags from '@/components/Tags';
import UpdateModal from '@/components/UpdateModal';
import { SaveTip } from '@/components/SaveTip';
import {
  deleteArticle,
  deleteDraft,
  getAbout,
  getArticleById,
  getDraftById,
  updateAbout,
  updateArticle,
  updateDraft,
  getMomentById,
  updateMoment,
  createMoment,
  deleteMoment,
  getDocumentById,
  updateDocument,
  deleteDocument,
} from '@/services/van-blog/api';
import { getPathname } from '@/services/van-blog/getPathname';
import { parseMarkdownFile, parseObjToMarkdown } from '@/services/van-blog/parseMarkdownFile';
import { useCacheState } from '@/services/van-blog/useCacheState';
import { DownOutlined } from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-layout';
import { Button, Dropdown, Input, Menu, message, Modal, Space, Tag, Upload } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { history } from 'umi';
import moment from 'moment';

export default function () {
  const [value, setValue] = useState('');
  const [currObj, setCurrObj] = useState({});
  const [loading, setLoading] = useState(true);
  const [editorConfig, setEditorConfig] = useCacheState(
    { afterSave: 'stay', useLocalCache: 'close' },
    'editorConfig',
  );
  const type = history.location.query?.type || 'article';
  const getCacheKey = () => `${type}-${history.location.query?.id || '0'}`;

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [currObj, value, type]);
  const onKeyDown = (ev) => {
    let save = false;
    if (ev.metaKey == true && ev.key.toLocaleLowerCase() == 's') {
      save = true;
    }
    if (ev.ctrlKey == true && ev.key.toLocaleLowerCase() == 's') {
      save = true;
    }
    if (save) {
      event?.preventDefault();
      ev?.preventDefault();
      handleSave();
    }
    return false;
  };

  const typeMap = {
    article: '文章',
    draft: '草稿',
    about: '关于',
    moment: '动态',
    document: '文档',
  };
  const fetchData = useCallback(
    async (noMessage) => {
      setLoading(true);

      const type = history.location.query?.type || 'article';
      const id = history.location.query?.id;
      const cacheString = window.localStorage.getItem(getCacheKey());
      let cacheObj = {};
      try {
        cacheObj = JSON.parse(cacheString || '{}');
      } catch (err) {
        window.localStorage.removeItem(getCacheKey());
      }
      const checkCache = (data) => {
        const clear = () => {
          window.localStorage.removeItem(getCacheKey());
        };
        if (editorConfig?.useLocalCache == 'close') {
          clear();
          return false;
        }
        if (!cacheObj || !cacheObj?.content) {
          clear();
          return false;
        }
        if (cacheObj?.content == data?.content) {
          clear();
          return false;
        }
        const updatedAt = data?.updatedAt;
        if (!updatedAt) {
          clear();
          return false;
        }
        const cacheTime = cacheObj?.time;
        if (moment(updatedAt).isAfter(cacheTime)) {
          clear();
          return false;
        } else {
          // console.log('[缓存检查] 本地缓存时间晚于服务器更新时间，使用缓存');
          return cacheObj?.content;
        }
      };

      if (type == 'about') {
        const { data } = await getAbout();
        const cache = checkCache(data);
        if (cache) {
          if (!noMessage) {
            message.success('从缓存中恢复状态！');
          }
          setValue(cache);
        } else {
          setValue(data?.content || '');
        }
        document.title = `关于 - VanBlog 编辑器`;
        setCurrObj(data);
      }
      if (type == 'article' && id) {
        const { data } = await getArticleById(id);
        const cache = checkCache(data);
        if (cache) {
          setValue(cache);
          if (!noMessage) {
            message.success('从缓存中恢复状态！');
          }
        } else {
          setValue(data?.content || '');
        }
        document.title = `${data?.title || ''} - VanBlog 编辑器`;
        setCurrObj(data);
      }
      if (type == 'draft' && id) {
        const { data } = await getDraftById(id);
        const cache = checkCache(data);
        if (cache) {
          if (!noMessage) {
            message.success('从缓存中恢复状态！');
          }
          setValue(cache);
        } else {
          setValue(data?.content || '');
        }
        setCurrObj(data);
        document.title = `${data?.title || ''} - VanBlog 编辑器`;
      }
      if (type == 'moment') {
        if (id) {
          // 编辑现有动态
          const { data } = await getMomentById(id);
          const cache = checkCache(data);
          if (cache) {
            if (!noMessage) {
              message.success('从缓存中恢复状态！');
            }
            setValue(cache);
          } else {
            setValue(data?.content || '');
          }
          setCurrObj(data);
          document.title = `编辑动态 - VanBlog 编辑器`;
        } else {
          // 创建新动态
          setValue('');
          setCurrObj({});
          document.title = `创建动态 - VanBlog 编辑器`;
        }
      }
      if (type == 'document' && id) {
        const { data } = await getDocumentById(id);
        const cache = checkCache(data);
        if (cache) {
          setValue(cache);
          if (!noMessage) {
            message.success('从缓存中恢复状态！');
          }
        } else {
          setValue(data?.content || '');
        }
        document.title = `${data?.title || ''} - VanBlog 编辑器`;
        setCurrObj(data);
      }
      setLoading(false);
    },
    [history, setLoading, setValue, type],
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    // 进入默认收起侧边栏
    const el = document.querySelector('.ant-pro-sider-collapsed-button');
    if (el && el.style.paddingLeft != '') {
      el.click();
    }
  }, []);

  const saveFn = async () => {
    const v = value;
    setLoading(true);
    if (type == 'article') {
      await updateArticle(currObj?.id, { content: v });
      await fetchData();
      message.success('保存成功！');
    } else if (type == 'draft') {
      await updateDraft(currObj?.id, { content: v });
      await fetchData();
      message.success('保存成功！');
    } else if (type == 'about') {
      await updateAbout({ content: v });
      await fetchData();
      message.success('保存成功！');
    } else if (type == 'moment') {
      if (currObj?.id) {
        // 更新现有动态
        await updateMoment(currObj.id, { content: v });
        await fetchData();
        message.success('保存成功！');
      } else {
        // 创建新动态
        const newMoment = await createMoment({ content: v });
        message.success('发布成功！');
        // 更新当前页面状态，使其变为编辑模式
        setCurrObj(newMoment.data);
        // 更新URL但不刷新页面
        history.replace(`/editor?type=moment&id=${newMoment.data.id}`);
      }
    } else if (type == 'document') {
      await updateDocument(currObj?.id, { content: v });
      await fetchData();
      message.success('保存成功！');
    }
    if (editorConfig.afterSave && editorConfig.afterSave == 'goBack') {
      history.go(-1);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (location.hostname == 'blog-demo.mereith.com' && type != 'draft') {
      Modal.info({
        title: type == 'moment' ? '确定删除这条动态吗？' : `确定删除 "${currObj.title}" 吗？`,
        content: '本来是可以的，但有个人在演示站首页放黄色信息，所以关了这个权限了。',
      });
      return;
    }
    
    // 对于动态类型，直接保存不需要复杂的检查
    if (type == 'moment') {
      Modal.confirm({
        title: currObj?.id ? '确定保存动态吗？' : '确定发布动态吗？',
        onOk: saveFn,
      });
      return;
    }
    
    // 先检查一下有没有 more .
    let hasMore = true;
    if (['article', 'draft'].includes(history.location.query?.type)) {
      if (!value?.includes('<!-- more -->')) {
        hasMore = false;
      }
    }
    let hasTags =
      ['article', 'draft'].includes(history.location.query?.type) &&
      currObj?.tags &&
      currObj.tags.length > 0;
    if (history.location.query?.type == 'about') {
      hasTags = true;
    }
    Modal.confirm({
      title: `确定保存吗？${hasTags ? '' : '此文章还没设置标签呢'}`,
      content: hasMore ? undefined : (
        <div style={{ marginTop: 8 }}>
          <p>缺少完整的 more 标记！</p>
          <p>这可能会造成阅读全文前的图片语句被截断从而无法正常显示！</p>
          <p>默认将截取指定的字符数量作为阅读全文前的内容。</p>
          <p>
            您可以点击编辑器工具栏最后第一个按钮在合适的地方插入标记。
            <a
              target={'_blank'}
              rel="noreferrer"
              href="https://vanblog.mereith.com/feature/basic/editor.html#%E4%B8%80%E9%94%AE%E6%8F%92%E5%85%A5-more-%E6%A0%87%E8%AE%B0"
            >
              相关文档
            </a>
          </p>
          <img src="/more.png" alt="more" width={200}></img>
        </div>
      ),
      onOk: saveFn,
    });
  };
  const handleExport = async () => {
    const md = parseObjToMarkdown(currObj);
    const data = new Blob([md]);
    const url = URL.createObjectURL(data);
    const link = document.createElement('a');
    link.href = url;
    let filename = '';
    if (type == 'moment') {
      filename = `动态_${currObj?.id || 'new'}.md`;
    } else {
      filename = `${currObj?.title || '关于'}.md`;
    }
    link.download = filename;
    link.click();
  };
  const handleImport = async (file) => {
    setLoading(true);
    try {
      const { content } = await parseMarkdownFile(file);
      Modal.confirm({
        title: '确认内容',
        content: <Input.TextArea value={content} autoSize={{ maxRows: 10, minRows: 5 }} />,
        onOk: () => {
          setValue(content);
          message.success('导入成功！');
        },
      });
    } catch (err) {
      message.error('导入失败！请检查文件格式！');
    }
    setLoading(false);
  };
  const actionMenu = (
    <Menu
      items={[
        // 重置按钮：moment类型不显示
        type != 'moment' ? {
          key: 'resetBtn',
          label: '重置',
          onClick: () => {
            setValue(currObj?.content || '');
            message.success('重置为初始值成功！');
          },
        } : null,
        type != 'about'
          ? {
              key: 'updateModalBtn',
              label: (
                <UpdateModal
                  onFinish={() => {
                    fetchData(true);
                  }}
                  type={type}
                  currObj={currObj}
                  setLoading={setLoading}
                />
              ),
            }
          : null,
        type == 'draft'
          ? {
              key: 'publishBtn',
              label: (
                <PublishDraftModal
                  title={currObj?.title}
                  key="publishModal1"
                  id={currObj?.id}
                  trigger={<a key={'publishBtn' + currObj?.id}>发布草稿</a>}
                  onFinish={() => {
                    history.push(`/article`);
                  }}
                />
              ),
            }
          : null,
        // 导入内容：暂时保留，但有编码问题需要修复
        {
          key: 'importBtn',
          label: '导入内容',
          onClick: () => {
            const el = document.querySelector('#importBtn');
            if (el) {
              el.click();
            }
          },
        },
        {
          key: 'exportBtn',
          label: `导出${typeMap[type]}`,
          onClick: handleExport,
        },
        type != 'draft'
          ? {
              key: 'viewFE',
              label: `查看前台`,
              onClick: () => {
                let url = '';
                if (type == 'article') {
                  if (currObj.hidden) {
                    Modal.confirm({
                      title: '此文章为隐藏文章！',
                      content: (
                        <div>
                          <p>
                            隐藏文章在未开启通过 URL 访问的情况下（默认关闭），会出现 404 页面！
                          </p>
                          <p>
                            您可以在{' '}
                            <a
                              onClick={() => {
                                history.push('/site/setting?subTab=layout');
                              }}
                            >
                              布局配置
                            </a>{' '}
                            中修改此项。
                          </p>
                        </div>
                      ),
                      onOk: () => {
                        window.open(`/post/${getPathname(currObj)}`, '_blank');
                        return true;
                      },
                      okText: '仍然访问',
                      cancelText: '返回',
                    });
                    return;
                  }
                  url = `/post/${getPathname(currObj)}`;
                } else if (type == 'moment') {
                  url = '/moment';
                } else {
                  url = '/about';
                }
                window.open(url, '_blank');
              },
            }
          : undefined,
        type != 'about'
          ? {
              key: 'deleteBtn',
              label: `删除${typeMap[type]}`,
              onClick: () => {
                Modal.confirm({
                  title: `确定删除 “${currObj.title}” 吗？`,
                  onOk: async () => {
                    if (location.hostname == 'blog-demo.mereith.com' && type == 'article') {
                      if ([28, 29].includes(currObj.id)) {
                        message.warn('演示站禁止删除此文章！');
                        return false;
                      }
                    }
                    if (type == 'article') {
                      await deleteArticle(currObj.id);
                      message.success('删除文章成功！返回列表页！');
                      history.push('/article');
                    } else if (type == 'draft') {
                      await deleteDraft(currObj.id);
                      message.success('删除草稿成功！返回列表页！');
                      history.push('/draft');
                    } else if (type == 'moment') {
                      await deleteMoment(currObj.id);
                      message.success('删除动态成功！返回列表页！');
                      history.push('/moment');
                    } else if (type == 'document') {
                      await deleteDocument(currObj.id);
                      message.success('删除文档成功！返回列表页！');
                      history.push('/document');
                    }
                  },
                });
              },
            }
          : undefined,
        {
          key: 'settingBtn',
          label: (
            <EditorProfileModal
              value={editorConfig}
              setValue={setEditorConfig}
              trigger={<a key={'editerConfigBtn'}>偏好设置</a>}
            />
          ),
        },
        {
          key: 'clearCacheBtn',
          label: '清理缓存',
          onClick: () => {
            Modal.confirm({
              title: '清理实时保存缓存',
              content:
                '确定清理当前内容的实时保存缓存吗？清理后未保存的内容将会丢失，编辑器内容将重置为服务端返回的最新数据。',
              okText: '确认清理',
              cancelText: '返回',
              onOk: () => {
                window.localStorage.removeItem(getCacheKey());
                setValue(currObj?.content || '');
                message.success('清除实时保存缓存成功！已重置为服务端返回数据');
              },
            });
          },
        },
        // 帮助文档：moment、draft和article类型不显示
        ['moment', 'draft', 'article'].includes(type) ? null : {
          key: 'helpBtn',
          label: '帮助文档',
          onClick: () => {
            window.open('https://vanblog.mereith.com/feature/basic/editor.html', '_blank');
          },
        },
      ]}
    ></Menu>
  );
  return (
    <PageContainer
      className="editor-full"
      style={{ overflow: 'hidden' }}
      header={{
        title: (
          <Space>
            <span title={type == 'about' ? '关于' : type == 'moment' ? (currObj?.id ? '编辑动态' : '创建动态') : currObj?.title}>
              {type == 'about' ? '关于' : type == 'moment' ? (currObj?.id ? '编辑动态' : '创建动态') : currObj?.title}
            </span>
            {type != 'about' && type != 'moment' && (
              <>
                <Tag color="green">{typeMap[type] || '-'}</Tag>
                <Tag color="blue">{currObj?.category || '-'}</Tag>
                <Tags tags={currObj?.tags} />
              </>
            )}
            {type == 'moment' && (
              <Tag color="orange">{typeMap[type] || '-'}</Tag>
            )}
          </Space>
        ),
        extra: [
          <Button key="extraSaveBtn" type="primary" onClick={handleSave}>
            {<SaveTip />}
          </Button>,
          <Button
            key="backBtn"
            onClick={() => {
              history.go(-1);
            }}
          >
            返回
          </Button>,
          <Dropdown key="moreAction" overlay={actionMenu} trigger={['click']}>
            <Button size="middle">
              操作
              <DownOutlined />
            </Button>
          </Dropdown>,
        ],
        breadcrumb: {},
      }}
      footer={null}
    >
      <div style={{ height: '100%' }}>
        <div style={{ height: '0' }}>
          <Upload
            showUploadList={false}
            multiple={false}
            accept={'.md'}
            beforeUpload={handleImport}
            style={{ display: 'none', height: 0 }}
          >
            <a key="importBtn" type="link" style={{ display: 'none' }} id="importBtn">
              导入内容
            </a>
          </Upload>
        </div>
        <Editor
          loading={loading}
          setLoading={setLoading}
          value={value}
          onChange={(val) => {
            setValue(val);
            if (editorConfig?.useLocalCache && editorConfig?.useLocalCache == 'open') {
              window.localStorage.setItem(
                getCacheKey(),
                JSON.stringify({
                  content: val,
                  time: new Date().valueOf(),
                }),
              );
            }
          }}
        />
      </div>
    </PageContainer>
  );
}

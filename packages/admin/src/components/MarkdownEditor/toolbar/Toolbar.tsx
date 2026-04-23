import type { CustomContainerType } from '../types';

import data from '@emoji-mart/data';
import i18n from '@emoji-mart/data/i18n/zh.json';
import Picker from '@emoji-mart/react';
import {
  BoldOutlined,
  CodeOutlined,
  FontSizeOutlined,
  ItalicOutlined,
  LinkOutlined,
  OrderedListOutlined,
  PictureOutlined,
  RedoOutlined,
  StrikethroughOutlined,
  TableOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import { Button, Dropdown, Popover, Space } from 'antd';
import { useMemo } from 'react';

import type { MenuProps } from 'antd';

import { COMMON_CODE_LANGUAGES, CUSTOM_CONTAINER_TITLES } from '../utils';

type ToolbarProps = {
  loading: boolean;
  currentCodeLanguage: string;
  onUndo: () => void;
  onRedo: () => void;
  onHeading: (level: number) => void;
  onBold: () => void;
  onItalic: () => void;
  onStrike: () => void;
  onInlineCode: () => void;
  onLink: () => void;
  onQuote: () => void;
  onBulletList: () => void;
  onOrderedList: () => void;
  onTaskList: () => void;
  onCodeBlock: () => void;
  onRememberCodeLanguage: (language: string) => void;
  onMath: () => void;
  onTable: () => void;
  onImageUpload: () => void;
  onInsertMore: () => void;
  onInsertContainer: (type: CustomContainerType) => void;
  onInsertEmoji: (emoji: string) => void;
};

const headingItems: MenuProps['items'] = [1, 2, 3, 4, 5, 6].map((level) => ({
  key: String(level),
  label: `标题 ${level}`,
}));

const containerTypes = Object.keys(CUSTOM_CONTAINER_TITLES) as CustomContainerType[];

export default function Toolbar(props: ToolbarProps) {
  const {
    loading,
    currentCodeLanguage,
    onUndo,
    onRedo,
    onHeading,
    onBold,
    onItalic,
    onStrike,
    onInlineCode,
    onLink,
    onQuote,
    onBulletList,
    onOrderedList,
    onTaskList,
    onCodeBlock,
    onRememberCodeLanguage,
    onMath,
    onTable,
    onImageUpload,
    onInsertMore,
    onInsertContainer,
    onInsertEmoji,
  } = props;

  const containerItems = useMemo<MenuProps['items']>(
    () =>
      containerTypes.map((type) => ({
        key: type,
        label: CUSTOM_CONTAINER_TITLES[type],
      })),
    [],
  );

  const codeLanguageItems = useMemo<MenuProps['items']>(
    () => [
      ...COMMON_CODE_LANGUAGES.map((language) => ({
        key: language,
        label: language,
      })),
      {
        key: '__custom__',
        label: '自定义语言…',
      },
    ],
    [],
  );

  return (
    <div className="vb-milkdown-toolbar" data-testid="markdown-editor-toolbar">
      <Space size={8} wrap>
        <Button icon={<UndoOutlined />} onClick={onUndo} disabled={loading} title="撤销">
          撤销
        </Button>
        <Button icon={<RedoOutlined />} onClick={onRedo} disabled={loading} title="重做">
          重做
        </Button>

        <Dropdown
          menu={{
            items: headingItems,
            onClick: ({ key }) => onHeading(Number(key)),
          }}
          trigger={['click']}
        >
          <Button icon={<FontSizeOutlined />} disabled={loading}>
            标题
          </Button>
        </Dropdown>

        <Button icon={<BoldOutlined />} onClick={onBold} disabled={loading} title="加粗">
          加粗
        </Button>
        <Button icon={<ItalicOutlined />} onClick={onItalic} disabled={loading} title="斜体">
          斜体
        </Button>
        <Button
          icon={<StrikethroughOutlined />}
          onClick={onStrike}
          disabled={loading}
          title="删除线"
        >
          删除线
        </Button>
        <Button icon={<CodeOutlined />} onClick={onInlineCode} disabled={loading} title="行内代码">
          行内代码
        </Button>
        <Button icon={<LinkOutlined />} onClick={onLink} disabled={loading} title="链接">
          链接
        </Button>

        <Button onClick={onQuote} disabled={loading} title="引用">
          引用
        </Button>
        <Button onClick={onBulletList} disabled={loading} title="无序列表">
          无序列表
        </Button>
        <Button
          icon={<OrderedListOutlined />}
          onClick={onOrderedList}
          disabled={loading}
          title="有序列表"
        >
          有序列表
        </Button>
        <Button onClick={onTaskList} disabled={loading} title="任务列表">
          任务列表
        </Button>

        <Dropdown
          menu={{
            items: codeLanguageItems,
            onClick: ({ key }) => {
              if (key === '__custom__') {
                const nextLanguage = window.prompt('请输入代码语言', currentCodeLanguage);
                if (nextLanguage && nextLanguage.trim()) {
                  onRememberCodeLanguage(nextLanguage.trim());
                }
                return;
              }

              onRememberCodeLanguage(String(key));
            },
          }}
          trigger={['click']}
        >
          <Button icon={<CodeOutlined />} onClick={onCodeBlock} disabled={loading}>
            代码块
          </Button>
        </Dropdown>

        <Button onClick={onMath} disabled={loading} title="数学公式">
          数学公式
        </Button>
        <Button icon={<TableOutlined />} onClick={onTable} disabled={loading} title="表格">
          表格
        </Button>
        <Button
          icon={<PictureOutlined />}
          onClick={onImageUpload}
          disabled={loading}
          title="图片上传"
        >
          图片
        </Button>
        <Button onClick={onInsertMore} disabled={loading} title="插入 more 标记">
          插入 more
        </Button>

        <Dropdown
          menu={{
            items: containerItems,
            onClick: ({ key }) => onInsertContainer(key as CustomContainerType),
          }}
          trigger={['click']}
        >
          <Button disabled={loading}>自定义容器</Button>
        </Dropdown>

        <Popover
          trigger="click"
          placement="bottomLeft"
          overlayClassName="vb-milkdown-emoji-popover"
          content={
            <Picker
              i18n={i18n}
              data={data}
              onEmojiSelect={(item: { native?: string }) => {
                if (item?.native) {
                  onInsertEmoji(item.native);
                }
              }}
            />
          }
        >
          <Button disabled={loading}>Emoji</Button>
        </Popover>
      </Space>
    </div>
  );
}

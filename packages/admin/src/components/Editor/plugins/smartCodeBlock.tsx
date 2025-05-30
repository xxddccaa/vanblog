import type { BytemdPlugin } from 'bytemd';

// 存储上次使用的代码语言的LocalStorage键
const LAST_CODE_LANGUAGE_KEY = 'vanblog_last_code_language';

// 默认语言
const DEFAULT_LANGUAGE = 'js';

// 常用编程语言列表
const COMMON_LANGUAGES = [
  'js', 'javascript', 'ts', 'typescript', 'python', 'java', 'cpp', 'c', 'go', 
  'rust', 'php', 'html', 'css', 'sql', 'bash', 'shell', 'json', 'xml', 'yaml'
];

// 获取上次使用的语言
const getLastCodeLanguage = (): string => {
  try {
    return localStorage.getItem(LAST_CODE_LANGUAGE_KEY) || DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
};

// 保存当前使用的语言
const saveLastCodeLanguage = (language: string): void => {
  try {
    localStorage.setItem(LAST_CODE_LANGUAGE_KEY, language);
  } catch {
    // 如果localStorage不可用，静默失败
  }
};

// 从代码块内容中提取语言
const extractLanguageFromCodeBlock = (content: string): string | null => {
  const match = content.match(/^```(\w+)/);
  return match ? match[1] : null;
};

// 代码块图标
const CODE_BLOCK_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
  <path d="M5.854 4.854a.5.5 0 1 0-.708-.708l-3.5 3.5a.5.5 0 0 0 0 .708l3.5 3.5a.5.5 0 0 0 .708-.708L2.707 8l3.147-3.146zm4.292 0a.5.5 0 0 1 .708-.708l3.5 3.5a.5.5 0 0 1 0 .708l-3.5 3.5a.5.5 0 0 1-.708-.708L13.293 8l-3.147-3.146z"/>
</svg>`;

// 语言选择图标
const LANG_SELECT_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
  <path d="M2.5 3A1.5 1.5 0 0 0 1 4.5v.793c.026.009.051.02.076.032L7.674 8.51c.206.1.446.1.652 0l6.598-3.185A.755.755 0 0 1 15 5.293V4.5A1.5 1.5 0 0 0 13.5 3h-11Z"/>
  <path d="M15 6.954 8.978 9.86a2.25 2.25 0 0 1-1.956 0L1 6.954V11.5A1.5 1.5 0 0 0 2.5 13h11a1.5 1.5 0 0 0 1.5-1.5V6.954Z"/>
</svg>`;

export function smartCodeBlock(): BytemdPlugin {
  return {
    actions: [
      {
        title: '智能代码块',
        icon: CODE_BLOCK_ICON,
        cheatsheet: '```',
        handler: {
          type: 'action',
          click: ({ editor, appendBlock, codemirror }) => {
            // 获取上次使用的语言
            const lastLanguage = getLastCodeLanguage();
            
            // 创建代码块内容
            const codeBlockContent = `\`\`\`${lastLanguage}\n\n\`\`\``;
            
            // 插入代码块
            const { line } = appendBlock(codeBlockContent);
            
            // 将光标定位到代码块内容区域（第二行开始）
            editor.setSelection(
              codemirror.Pos(line + 1, 0),
              codemirror.Pos(line + 1, 0)
            );
            editor.focus();
          },
        },
      },
      {
        title: '选择代码语言',
        icon: LANG_SELECT_ICON,
        handler: {
          type: 'action',
          click: () => {
            // 创建语言选择对话框
            const currentLang = getLastCodeLanguage();
            const selectedLang = prompt(`请输入代码语言 (当前: ${currentLang}):\n\n常用语言: ${COMMON_LANGUAGES.join(', ')}`, currentLang);
            
            if (selectedLang && selectedLang.trim()) {
              saveLastCodeLanguage(selectedLang.trim().toLowerCase());
              alert(`代码语言已设置为: ${selectedLang.trim().toLowerCase()}`);
            }
          },
        },
      },
    ],
  };
} 
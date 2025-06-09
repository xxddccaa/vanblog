import { getAllCategories } from '@/services/van-blog/api';
import { message, Modal } from 'antd';
import fm from 'front-matter';

// 简化的编码检测（基于字节特征分析）
const detectEncoding = (bytes) => {
  const sample = bytes.slice(0, Math.min(8192, bytes.length)); // 取前8KB作为样本
  
  // 检查BOM
  if (sample.length >= 3 && sample[0] === 0xEF && sample[1] === 0xBB && sample[2] === 0xBF) {
    return 'utf-8';
  }
  if (sample.length >= 2 && sample[0] === 0xFF && sample[1] === 0xFE) {
    return 'utf-16le';
  }
  if (sample.length >= 2 && sample[0] === 0xFE && sample[1] === 0xFF) {
    return 'utf-16be';
  }
  
  // UTF-8检查（严格）
  let utf8Valid = true;
  let i = 0;
  while (i < sample.length && utf8Valid) {
    const byte = sample[i];
    if (byte < 0x80) {
      i++;
    } else if ((byte >> 5) === 0x06) { // 110xxxxx
      if (i + 1 >= sample.length || (sample[i + 1] >> 6) !== 0x02) utf8Valid = false;
      i += 2;
    } else if ((byte >> 4) === 0x0E) { // 1110xxxx
      if (i + 2 >= sample.length || (sample[i + 1] >> 6) !== 0x02 || (sample[i + 2] >> 6) !== 0x02) utf8Valid = false;
      i += 3;
    } else if ((byte >> 3) === 0x1E) { // 11110xxx
      if (i + 3 >= sample.length || (sample[i + 1] >> 6) !== 0x02 || (sample[i + 2] >> 6) !== 0x02 || (sample[i + 3] >> 6) !== 0x02) utf8Valid = false;
      i += 4;
    } else {
      utf8Valid = false;
    }
  }
  if (utf8Valid) return 'utf-8';
  
  // 统计ASCII字符比例
  let asciiCount = 0;
  let totalCount = sample.length;
  for (let i = 0; i < sample.length; i++) {
    if (sample[i] < 0x80) asciiCount++;
  }
  const asciiRatio = asciiCount / totalCount;
  
  // GB2312/GBK检查
  let gbkCount = 0;
  let gbkTotal = 0;
  for (let i = 0; i < sample.length - 1; i++) {
    const byte1 = sample[i];
    const byte2 = sample[i + 1];
    if (byte1 >= 0xA1 && byte1 <= 0xFE && byte2 >= 0xA1 && byte2 <= 0xFE) {
      gbkCount++;
      i++; // 跳过下一个字节
    }
    gbkTotal++;
  }
  const gbkRatio = gbkTotal > 0 ? gbkCount / gbkTotal : 0;
  
  // Big5检查
  let big5Count = 0;
  let big5Total = 0;
  for (let i = 0; i < sample.length - 1; i++) {
    const byte1 = sample[i];
    const byte2 = sample[i + 1];
    if (byte1 >= 0xA4 && byte1 <= 0xFE && 
        ((byte2 >= 0x40 && byte2 <= 0x7E) || (byte2 >= 0xA1 && byte2 <= 0xFE))) {
      big5Count++;
      i++; // 跳过下一个字节
    }
    big5Total++;
  }
  const big5Ratio = big5Total > 0 ? big5Count / big5Total : 0;
  
  // Shift-JIS检查
  let sjisCount = 0;
  let sjisTotal = 0;
  for (let i = 0; i < sample.length - 1; i++) {
    const byte1 = sample[i];
    const byte2 = sample[i + 1];
    if (((byte1 >= 0x81 && byte1 <= 0x9F) || (byte1 >= 0xE0 && byte1 <= 0xFC)) &&
        ((byte2 >= 0x40 && byte2 <= 0x7E) || (byte2 >= 0x80 && byte2 <= 0xFC))) {
      sjisCount++;
      i++; // 跳过下一个字节
    }
    sjisTotal++;
  }
  const sjisRatio = sjisTotal > 0 ? sjisCount / sjisTotal : 0;
  
  // 基于统计结果判断编码
  const threshold = 0.1; // 10%以上的双字节字符才考虑
  
  if (gbkRatio > threshold && gbkRatio > big5Ratio && gbkRatio > sjisRatio) {
    return 'gb18030'; // 使用GB18030兼容GB2312/GBK
  }
  if (big5Ratio > threshold && big5Ratio > sjisRatio) {
    return 'big5';
  }
  if (sjisRatio > threshold) {
    return 'shift_jis';
  }
  
  // 如果ASCII比例很高，可能是Latin编码
  if (asciiRatio > 0.8) {
    return 'iso-8859-1';
  }
  
  // 默认尝试Windows-1252（最兼容的编码）
  return 'windows-1252';
};

// 编码检测和转换函数
const detectAndDecodeFile = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      const arrayBuffer = e.target.result;
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // 使用改进的编码检测
      const detectedEncoding = detectEncoding(uint8Array);
      console.log(`自动检测编码: ${detectedEncoding}`);
      
      // 支持的编码列表（按检测结果优先，然后回退）
      const encodings = [
        detectedEncoding,     // 首先尝试检测到的编码
        'utf-8',             // UTF-8回退
        'gb18030',           // 中文回退
        'windows-1252',      // 西文回退
        'big5',              // 繁体中文回退
        'shift_jis',         // 日文回退
        'iso-8859-1',        // Latin-1回退
      ];
      
      // 去重
      const uniqueEncodings = [...new Set(encodings)];
      
      let decodedText = null;
      let usedEncoding = detectedEncoding;
      
      // 按优先级尝试解码
      for (const encoding of uniqueEncodings) {
        try {
          const decoder = new TextDecoder(encoding, { fatal: false });
          const text = decoder.decode(uint8Array);
          
          // 检查解码结果的质量
          if (text && isValidText(text, encoding)) {
            decodedText = text;
            usedEncoding = encoding;
            break;
          }
        } catch (e) {
          console.log(`编码 ${encoding} 解码失败:`, e.message);
          continue;
        }
      }
      
      if (!decodedText) {
        // 最后的兜底方案：强制UTF-8解码
        try {
          const decoder = new TextDecoder('utf-8', { fatal: false });
          decodedText = decoder.decode(uint8Array);
          usedEncoding = 'utf-8 (强制解码)';
        } catch (error) {
          reject(new Error('无法解析文件编码'));
          return;
        }
      }
      
      console.log(`最终使用编码: ${usedEncoding}`);
      resolve({ text: decodedText, encoding: usedEncoding });
    };
    
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsArrayBuffer(file);
  });
};

// 检查文本解码质量的函数
const isValidText = (text, encoding) => {
  if (!text || text.length < 5) return false;
  
  // 检查是否包含过多的替换字符（乱码标志）
  const replacementChars = /[\ufffd]/g;
  const replacementCount = (text.match(replacementChars) || []).length;
  const replacementRatio = replacementCount / text.length;
  
  // 如果替换字符超过2%，认为解码质量差
  if (replacementRatio > 0.02) return false;
  
  // 检查控制字符（除了常见的换行、制表符等）
  const controlChars = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g;
  const controlCount = (text.match(controlChars) || []).length;
  const controlRatio = controlCount / text.length;
  
  // 如果控制字符超过1%，认为解码质量差
  if (controlRatio > 0.01) return false;
  
  // 检查是否包含合理的文本内容
  const hasValidContent = 
    text.includes('\n') ||           // 换行符
    text.includes(' ') ||            // 空格
    text.includes('#') ||            // markdown标题
    text.includes('```') ||          // 代码块
    text.includes('**') ||           // 粗体
    text.includes('*') ||            // 斜体或列表
    text.includes('-') ||            // 列表或分隔符
    /[\u4e00-\u9fff]/.test(text) ||  // 中文字符
    /[a-zA-Z]{2,}/.test(text);       // 英文单词
  
  return hasValidContent;
};

export const parseMarkdownFile = async (file, allowNotExistCategory) => {
  const name = file.name.split('.')[0];
  const type = file.name.split('.').pop();
  if (type != 'md') {
    Modal.error({ title: '目前仅支持导入 Markdown 文件！' });
    return;
  }
  
  let txt;
  let detectedEncoding;
  try {
    // 使用改进的编码检测和转换
    const result = await detectAndDecodeFile(file);
    txt = result.text;
    detectedEncoding = result.encoding;
    
    // 给用户编码信息提示
    if (detectedEncoding !== 'utf-8') {
      if (detectedEncoding.includes('强制解码')) {
        message.warning('文件编码检测失败，使用UTF-8强制解析，可能存在乱码');
      } else {
        message.success(`检测到文件编码: ${detectedEncoding.toUpperCase()}，已自动转换为UTF-8`);
      }
    } else {
      message.info('文件已是UTF-8编码');
    }
  } catch (error) {
    message.error(`文件解析失败: ${error.message}`);
    return;
  }

  const { attributes, body } = fm(txt);
  const title = attributes?.title || name;
  const categoris = attributes?.categories || [];
  let allCategories = undefined;
  try {
    const { data } = await getAllCategories();
    allCategories = data;
  } catch (err) {
    message.error('获取当前分类信息失败！');
    return;
  }
  let category = undefined;
  if (categoris.length > 0 && allCategories?.length > 0) {
    for (const each of categoris) {
      if (allCategories.includes(each)) {
        category = each;
        break;
      }
    }
  }
  const categoryInFile = attributes?.category;
  if (categoryInFile && allCategories.includes(categoryInFile)) {
    category = categoryInFile;
  }
  if (allowNotExistCategory && !category) {
    category = categoris[0] || attributes?.category;
    if (!category) {
      category = undefined;
    }
  }
  const tags = attributes?.tags || [];
  if (attributes?.tag) {
    tags.push(attributes?.tag);
  }
  const top = attributes?.top || 0;
  let createdAt = new Date().toISOString();
  try {
    if (attributes?.date) {
      createdAt = new Date(attributes?.date).toISOString();
    }
  } catch (err) {}
  let updatedAt = new Date().toISOString();
  try {
    if (attributes?.updated) {
      updatedAt = new Date(attributes?.updated).toISOString();
    }
  } catch (err) {}
  const password = attributes?.password || undefined;
  const privateAttr = password ? true : false;
  const hidden = attributes?.hidden || attributes?.hide || false;
  const vals = {
    title,
    top,
    tags,
    category,
    password,
    private: privateAttr,
    hidden,
    createdAt,
    content: body,
    updatedAt,
  };
  return vals;
};

export const parseObjToMarkdown = (obj) => {
  const frontmatter = {};
  for (const key of [
    'title',
    'category',
    'tags',
    'top',
    'updatedAt',
    'createdAt',
    'hidden',
    'password',
  ]) {
    if (Object.keys(obj).includes(key)) {
      if (['updatedAt', 'createdAt'].includes(key)) {
        let date = obj[key];
        try {
          date = new Date(date).toISOString();
        } catch (err) {}
        frontmatter[key] = date;
      } else if (key == 'tags') {
        if (obj[key] && obj[key].length > 0) {
          frontmatter[key] = obj[key];
        }
      } else {
        if (obj[key]) {
          frontmatter[key] = obj[key];
        }
      }
    }
  }
  let result = '---';
  for (const [k, v] of Object.entries(frontmatter)) {
    result = result + `\n${k}: ${v}`;
  }
  result = result + '\n---\n\n';
  result = result + obj.content;
  return result;
};

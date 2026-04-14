export function wordCount(words?: string | null) {
  const safeWords = typeof words === 'string' ? words : '';
  let iTotal = 0;
  let inum = 0;
  let eTotal = 0;
  let sTotal = 0;
  for (let i = 0; i < safeWords.length; i++) {
    const c = safeWords.charAt(i);
    //基本汉字
    if (c.match(/[\u4e00-\u9fa5]/)) {
      iTotal++;
    }
    //基本汉字补充
    if (c.match(/[\u9FA6-\u9fcb]/)) {
      iTotal++;
    }
    //  中文标点加中文字
    if (c.match(/[^\x00-\xff]/)) {
      sTotal++;
    } else {
      // 英文
      eTotal++;
    }
    // 数字
    if (c.match(/[0-9]/)) {
      inum++;
    }
  }
  return iTotal + eTotal;
}

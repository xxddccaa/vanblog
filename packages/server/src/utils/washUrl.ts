export function washUrl(s: string) {
  const raw = s?.trim?.() || '';
  if (!raw) {
    return '';
  }
  // 先判断一下带不带协议
  let url = raw;
  if (!raw.includes('http')) {
    url = `https://${raw}`;
  }
  // 带反斜杠的
  try {
    const u = new URL(url);
    return u.toString();
  } catch (err) {
    return '';
  }
}
export const encodeQuerystring = (s: string) => {
  return s.replace(/#/g, '%23').replace(/\//g, '%2F');
};

const SITE_ORIGIN_TEXT_PLACEHOLDER = "VANBLOG_SITE_ORIGIN";
const SITE_ORIGIN_URL_PLACEHOLDER = "https://vanblog-site-origin.invalid";

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

export const buildLinkRequirementMarkdown = ({
  siteName,
  description,
  logo,
}: {
  siteName: string;
  description: string;
  logo: string;
}) => `
**[申领要求]**
- [x] 请先添加本站为友链后再申请友链，并通过留言或邮件告知
- [x] 不和剽窃、侵权、无诚信的网站交换，优先和具有原创作品的全站 HTTPS 站点交换
- [x] 原则上要求您的博客主页被百度或者 Google 等搜索引擎收录
- [x] 由于访问安全性问题，请**务必**提供 HTTPS 链接的头像地址（或留言时备注暂无以便本站主动保存）
- [x] 不接受视频站、资源站等非博客类站点交换，原则上只与技术/日志类博客交换友链

**[本站信息]**
> 名称： ${siteName}<br/>
> 简介： ${description}<br/>
> 网址： [${SITE_ORIGIN_TEXT_PLACEHOLDER}](${SITE_ORIGIN_URL_PLACEHOLDER})<br/>
> 头像： [${logo}](${logo})
`;

export const resolveLinkRequirementHtml = (html: string, siteOrigin: string) => {
  const safeOrigin = escapeHtml(siteOrigin);
  return html
    .replaceAll(SITE_ORIGIN_URL_PLACEHOLDER, safeOrigin)
    .replaceAll(SITE_ORIGIN_TEXT_PLACEHOLDER, safeOrigin);
};

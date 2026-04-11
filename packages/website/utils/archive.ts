import { encodeQuerystring } from "./encode";

export const getArchiveBasePath = () => "/archive";

export const getCategoryArchiveBasePath = (category: string) =>
  `/category/${encodeQuerystring(category)}/archive`;

export const getTagArchiveBasePath = (tag: string) =>
  `/tag/${encodeQuerystring(tag)}/archive`;

export const formatArchiveMonthLabel = (year: string, month: string) =>
  `${year} 年 ${month} 月`;

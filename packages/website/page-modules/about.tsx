import React from "react";
import dayjs from "dayjs";
import { DonateItem } from "../api/getAllData";
import AuthorCard, { AuthorCardProps } from "../components/AuthorCard";
import Layout from "../components/Layout";
import RichPostCard from "../components/RichPostCard";
import { LayoutProps } from "../utils/getLayoutProps";
import { getAboutPageProps } from "../utils/getPageProps";
import { revalidate } from "../utils/loadConfig";
import { renderMarkdownToHtml } from "../utils/renderMarkdown";
export interface About {
  updatedAt: string;
  content: string;
}
export interface AboutPageProps {
  layoutProps: LayoutProps;
  authorCardProps: AuthorCardProps;
  donates: DonateItem[];
  about: About;
  pay: string[];
  payDark: string[];
  showDonateInfo: "true" | "false";
  showDonateInAbout: "true" | "false";
}
const getDonateTableMarkdown = (donates: DonateItem[]) => {
  let content = `
## 捐赠信息

| 捐赠人 | 捐赠金额|捐赠时间|
|---|---|---|
  `;
  for (const each of donates) {
    content =
      content +
      `|${each.name}|${each.value} 元|${dayjs(each.updatedAt).format(
        "YYYY-MM-DD HH:mm:ss"
      )}|\n`;
  }
  return content;
};
const AboutPage = (props: AboutPageProps) => {
  const content =
    props.donates.length == 0 || props.showDonateInfo == "false"
      ? props.about.content
      : `${props.about.content}${getDonateTableMarkdown(props.donates)}`;
  const renderedHtml = renderMarkdownToHtml(content, props.layoutProps.codeMaxLines);

  return (
    <Layout
      title="关于我"
      option={props.layoutProps}
      contentWidthMode={props.layoutProps.articleWidthMode}
      includeMarkdownThemeHead={true}
      sideBar={<AuthorCard option={props.authorCardProps} />}
    >
      <RichPostCard
        showExpirationReminder={
          props.layoutProps.showExpirationReminder == "true"
        }
        openArticleLinksInNewWindow={false}
        id={0}
        private={false}
        title={"关于我"}
        updatedAt={new Date(props.about.updatedAt)}
        createdAt={new Date(props.about.updatedAt)}
        pay={props.pay}
        payDark={props.payDark}
        catelog={"about"}
        initialContent={content}
        initialRenderedHtml={renderedHtml}
        type="about"
        enableComment={props.layoutProps.enableComment}
        top={0}
        customCopyRight={null}
        showDonateInAbout={props.showDonateInAbout == "true"}
        copyrightAggreement={props.layoutProps.copyrightAggreement}
        showEditButton={props.layoutProps.showEditButton === "true"}
        codeMaxLines={props.layoutProps.codeMaxLines}
      />
    </Layout>
  );
};

export default AboutPage;
export async function getStaticProps(): Promise<{
  props: AboutPageProps;
  revalidate?: number;
}> {
  return {
    props: await getAboutPageProps(),
    ...revalidate,
  };
}

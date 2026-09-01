'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { LinkItem } from '../api/getAllData';
import AuthorCard, { AuthorCardProps } from '../components/AuthorCard';
import Layout from '../components/Layout';
import LinkCard from '../components/LinkCard';
import RenderedMarkdown from '../components/RenderedMarkdown';
import WaLine from '../components/WaLine';
import { LayoutProps } from '../utils/getLayoutProps';
import { resolveLinkRequirementHtml } from '../utils/linkRequirement';

export interface LinkPageDataProps {
  layoutProps: LayoutProps;
  authorCardProps: AuthorCardProps;
  links: LinkItem[];
  siteUrl: string;
}

export interface LinkPageProps extends LinkPageDataProps {
  initialRenderedHtml: string;
}

export default function LinkPage(props: LinkPageProps) {
  const [url, setUrl] = useState(props.siteUrl || '');

  useEffect(() => {
    if (!props.siteUrl) {
      setUrl(window.location.origin);
    }
  }, [props.siteUrl]);

  const requirementHtml = useMemo(
    () => resolveLinkRequirementHtml(props.initialRenderedHtml, url),
    [props.initialRenderedHtml, url],
  );

  return (
    <Layout
      option={props.layoutProps}
      contentWidthMode={props.layoutProps.articleWidthMode}
      title="友情链接"
      sideBar={<AuthorCard option={props.authorCardProps} />}
      includeMarkdownThemeHead={true}
    >
      <div className="vb-surface-card dark:text-dark card-shadow dark:card-shadow-dark py-4 px-8 md:py-6 md:px-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl md:text-3xl text-gray-700 dark:text-dark font-bold mb-4">
            友情链接
          </h1>
          <div className="text-center text-gray-600 text-sm font-light dark:text-dark mb-6">以下是本站的友情链接，排名不分先后</div>
        </div>
        <div className="flex flex-col mt-6 mb-2">
          <p className="mb-6 ">以下是本站的友情链接，排名不分先后：</p>
          <div className="grid gap-2 sm:gap-4 grid-cols-2 lg:grid-cols-3">
            {props.links.map((link) => (
              <LinkCard key={`${link.url}${link.name}`} link={link} />
            ))}
          </div>
          <hr className="mt-8 dark:border-hr-dark" />
          <div className="mt-4 text-sm md:text-base ">
            <RenderedMarkdown html={requirementHtml} content="" />
          </div>
          <div>
            <blockquote>
              <p></p>
            </blockquote>
          </div>
        </div>
      </div>
      <WaLine enable={props.layoutProps.enableComment} visible={true} />
    </Layout>
  );
}

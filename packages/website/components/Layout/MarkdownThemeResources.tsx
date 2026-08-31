import React from "react";
import {
  MARKDOWN_THEME_HOTFIX_URL,
  withMarkdownThemeAssetVersion,
} from "../../utils/markdownTheme";

const THEME_LINK_SELECTOR =
  "link[rel='stylesheet'][data-vanblog-theme-link='true']";
const HOTFIX_LINK_SELECTOR =
  "link[rel='stylesheet'][data-vanblog-theme-hotfix='true']";

export const MARKDOWN_THEME_PRECEDENCE = "vanblog-markdown-theme";
export const MARKDOWN_THEME_HOTFIX_PRECEDENCE = "vanblog-markdown-hotfix";

type MarkdownThemeResourceProps = {
  enabled?: boolean;
  lightThemeUrl?: string;
  darkThemeUrl?: string;
};

const getAbsoluteHref = (document: Document, href?: string) => {
  if (!href) return null;
  return new URL(href, document.baseURI).href;
};

const setStylesheetEnabled = (link: HTMLLinkElement, enabled: boolean) => {
  link.disabled = !enabled;
  if (enabled) {
    link.removeAttribute("disabled");
  } else {
    link.setAttribute("disabled", "");
  }
};

const enableOnlyMatchingStylesheet = (
  links: HTMLLinkElement[],
  expectedHref: string | null,
) => {
  let hasEnabledMatch = false;

  links.forEach((link) => {
    const isMatch =
      !hasEnabledMatch && expectedHref !== null && link.href === expectedHref;
    setStylesheetEnabled(link, isMatch);
    hasEnabledMatch ||= isMatch;
  });
};

export const syncMarkdownThemeResourceState = (
  document: Document,
  {
    enabled = false,
    lightThemeUrl,
    darkThemeUrl,
  }: MarkdownThemeResourceProps,
) => {
  const lightHref =
    enabled && lightThemeUrl
      ? getAbsoluteHref(
          document,
          withMarkdownThemeAssetVersion(lightThemeUrl),
        )
      : null;
  const darkHref =
    enabled && darkThemeUrl
      ? getAbsoluteHref(
          document,
          withMarkdownThemeAssetVersion(darkThemeUrl),
        )
      : null;
  const usesPlainTheme = [lightThemeUrl, darkThemeUrl].some((href) =>
    href?.includes("/vanblog-plain-")
  );
  const hotfixHref = enabled && !usesPlainTheme
    ? getAbsoluteHref(
        document,
        withMarkdownThemeAssetVersion(MARKDOWN_THEME_HOTFIX_URL),
      )
    : null;

  const themeLinks = Array.from(
    document.head.querySelectorAll<HTMLLinkElement>(THEME_LINK_SELECTOR),
  );
  enableOnlyMatchingStylesheet(
    themeLinks.filter((link) => link.dataset.themeFor === "light"),
    lightHref,
  );
  enableOnlyMatchingStylesheet(
    themeLinks.filter((link) => link.dataset.themeFor === "dark"),
    darkHref,
  );
  enableOnlyMatchingStylesheet(
    Array.from(
      document.head.querySelectorAll<HTMLLinkElement>(HOTFIX_LINK_SELECTOR),
    ),
    hotfixHref,
  );
};

export default function MarkdownThemeResources({
  enabled = false,
  lightThemeUrl,
  darkThemeUrl,
}: MarkdownThemeResourceProps) {
  if (!enabled) return null;

  return (
    <>
      {lightThemeUrl ? (
        <link
          rel="stylesheet"
          href={withMarkdownThemeAssetVersion(lightThemeUrl)}
          precedence={MARKDOWN_THEME_PRECEDENCE}
          data-theme-for="light"
          data-vanblog-theme-link="true"
        />
      ) : null}
      {darkThemeUrl ? (
        <link
          rel="stylesheet"
          href={withMarkdownThemeAssetVersion(darkThemeUrl)}
          precedence={MARKDOWN_THEME_PRECEDENCE}
          data-theme-for="dark"
          data-vanblog-theme-link="true"
        />
      ) : null}
      {[lightThemeUrl, darkThemeUrl].some((href) => href?.includes("/vanblog-plain-")) ? null : (
        <link
          rel="stylesheet"
          href={withMarkdownThemeAssetVersion(MARKDOWN_THEME_HOTFIX_URL)}
          precedence={MARKDOWN_THEME_HOTFIX_PRECEDENCE}
          data-vanblog-theme-hotfix="true"
        />
      )}
    </>
  );
}

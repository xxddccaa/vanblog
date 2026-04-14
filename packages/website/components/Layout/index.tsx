"use client";

import React from "react";
import dynamic from "next/dynamic";
import Head from "next/head";
import BackToTopBtn from "../BackToTop";
import NavBar from "../NavBar";
import MusicPlayer from "../MusicPlayer";
import { useEffect, useRef, useState } from "react";
import BaiduAnalysis from "../BaiduAnalysis";
import GaAnalysis from "../gaAnalysis";
import { LayoutProps } from "../../utils/getLayoutProps";
// import ImageProvider from "../ImageProvider";
import { RealThemeType, ThemeContext } from "../../utils/themeContext";
import { getTheme } from "../../utils/theme";
import CustomLayout from "../CustomLayout";
import { Toaster } from "react-hot-toast";
import Footer from "../Footer";
import LayoutBody from "../LayoutBody";
import { checkLoginAsync } from "../../utils/auth";

const NavBarMobile = dynamic(() => import("../NavBarMobile"), {
  ssr: false,
});

const MANAGED_DESCRIPTION_META = "meta[name='description'][data-vanblog-managed='true']";
const MANAGED_ROBOTS_META = "meta[name='robots'][data-vanblog-managed='true']";
const MANAGED_ICON_LINK = "link[rel='icon'][data-vanblog-managed='true']";
const MANAGED_THEME_LINK = 'link[data-vanblog-theme-link]';

const upsertHeadMeta = (selector: string, name: string, content: string) => {
  let element = document.head.querySelector(selector) as HTMLMetaElement | null;
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute("name", name);
    element.setAttribute("data-vanblog-managed", "true");
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
};

const upsertHeadLink = (
  selector: string,
  rel: string,
  href: string,
  extraAttributes: Record<string, string> = {},
) => {
  let element = document.head.querySelector(selector) as HTMLLinkElement | null;
  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", rel);
    element.setAttribute("data-vanblog-managed", "true");
    document.head.appendChild(element);
  }
  element.setAttribute("href", href);
  Object.entries(extraAttributes).forEach(([key, value]) => {
    element?.setAttribute(key, value);
  });
};

const syncThemeStylesheet = (theme: "light" | "dark", href: string) => {
  const selector = `${MANAGED_THEME_LINK}[data-theme-for='${theme}']`;
  const existing = document.head.querySelector(selector) as HTMLLinkElement | null;

  if (!href) {
    existing?.remove();
    return;
  }

  if (existing) {
    existing.setAttribute("href", href);
    return;
  }

  const link = document.createElement("link");
  link.setAttribute("rel", "stylesheet");
  link.setAttribute("href", href);
  link.setAttribute("data-theme-for", theme);
  link.setAttribute("data-vanblog-theme-link", "true");
  document.head.appendChild(link);
};

export default function (props: {
  option: LayoutProps;
  title: string;
  sideBar: any;
  children: any;
}) {
  // console.log("css", props.option.customCss);
  // console.log("html", props.option.customHtml);
  // console.log("script", decode(props.option.customScript as string));
  const [isOpen, setIsOpen] = useState(false);
  const { current } = useRef({ hasInit: false });
  const [theme, setTheme] = useState<RealThemeType>(getTheme("auto"));
  const handleClose = () => {
    console.log("关闭或刷新页面");
    localStorage.removeItem("saidHello");
  };
  
  // 全站隐私检查
  useEffect(() => {
    const checkPrivateSite = async () => {
      if (props.option.privateSite === "true") {
        const isLoggedIn = await checkLoginAsync();
        if (!isLoggedIn) {
          // 如果启用了全站隐私且用户未登录，重定向到登录页面
          const currentUrl = window.location.href;
          const loginUrl = `/admin/user/login`;
          
          // 避免在登录页面无限重定向
          if (!currentUrl.includes('/admin/user/login')) {
            window.location.href = loginUrl;
            return;
          }
        }
      }
    };
    
    checkPrivateSite();
  }, [props.option.privateSite]);
  
  useEffect(() => {
    if (!current.hasInit && !localStorage.getItem("saidHello")) {
      current.hasInit = true;
      localStorage.setItem("saidHello", "true");
      console.log("🚀欢迎使用 VanBlog 博客系统");
      console.log("当前版本：", props?.option?.version || "未知");
      console.log("开源地址：", "https://github.com/xxddccaa/vanblog");
      console.log("喜欢的话可以给个 star 哦🙏");
      window.onbeforeunload = handleClose;
    }
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [props]);

  useEffect(() => {
    document.title = props.title;

    upsertHeadLink(
      MANAGED_ICON_LINK,
      "icon",
      props.option.favicon || "/favicon.ico",
    );
    upsertHeadMeta(
      MANAGED_DESCRIPTION_META,
      "description",
      props.option.description || props.option.siteDesc || "",
    );
    upsertHeadMeta(MANAGED_ROBOTS_META, "robots", "index, follow");

    const root = document.documentElement;
    root.style.setProperty(
      "--bg-image",
      props.option.backgroundImage ? `url("${props.option.backgroundImage}")` : "none",
    );
    root.style.setProperty(
      "--bg-image-dark",
      props.option.backgroundImageDark || props.option.backgroundImage
        ? `url("${props.option.backgroundImageDark || props.option.backgroundImage}")`
        : "none",
    );

    syncThemeStylesheet("light", props.option.markdownLightThemeUrl || "");
    syncThemeStylesheet("dark", props.option.markdownDarkThemeUrl || "");
  }, [
    props.option.backgroundImage,
    props.option.backgroundImageDark,
    props.option.description,
    props.option.favicon,
    props.option.markdownDarkThemeUrl,
    props.option.markdownLightThemeUrl,
    props.option.siteDesc,
    props.title,
  ]);

  return (
    <>
      <Head>
        <title>{props.title}</title>
        <link rel="icon" href={props.option.favicon}></link>
        <meta name="description" content={props.option.description}></meta>
        <meta name="robots" content="index, follow"></meta>
        <style>{`
          :root {
            --bg-image: url('${props.option.backgroundImage || ''}');
            --bg-image-dark: url('${props.option.backgroundImageDark || props.option.backgroundImage || ''}');
          }
        `}</style>
        {/* Markdown 主题 CSS：同时挂载亮/暗两套，通过 HTML data-theme 属性和 CSS 选择器自动切换 */}
        {props.option.markdownLightThemeUrl && (
          <link
            rel="stylesheet"
            href={props.option.markdownLightThemeUrl}
            key="markdown-light-theme"
            data-theme-for="light"
          />
        )}
        {props.option.markdownDarkThemeUrl && (
          <link
            rel="stylesheet"
            href={props.option.markdownDarkThemeUrl}
            key="markdown-dark-theme"
            data-theme-for="dark"
          />
        )}
      </Head>
      <BackToTopBtn></BackToTopBtn>
      <MusicPlayer />
      {props.option.baiduAnalysisID != "" &&
        process.env.NODE_ENV != "development" && (
          <BaiduAnalysis id={props.option.baiduAnalysisID}></BaiduAnalysis>
        )}

      {props.option.gaAnalysisID != "" &&
        process.env.NODE_ENV != "development" && (
          <GaAnalysis id={props.option.gaAnalysisID}></GaAnalysis>
        )}
      <ThemeContext.Provider
        value={{
          setTheme,
          theme,
        }}
      >
        <Toaster />
        {/* <ImageProvider> */}
          <NavBar
            openArticleLinksInNewWindow={
              props.option.openArticleLinksInNewWindow == "true"
            }
            showRSS={props.option.showRSS}
            defaultTheme={props.option.defaultTheme}
            showSubMenu={props.option.showSubMenu}
            headerLeftContent={props.option.headerLeftContent}
            subMenuOffset={props.option.subMenuOffset}
            showAdminButton={props.option.showAdminButton}
            menus={props.option.menus}
            siteName={props.option.siteName}
            logo={props.option.logo}
            categories={props.option.categories}
            isOpen={isOpen}
            setOpen={setIsOpen}
            logoDark={props.option.logoDark}
            showFriends={props.option.showFriends}
          ></NavBar>
          <NavBarMobile
            isOpen={isOpen}
            setIsOpen={setIsOpen}
            showAdminButton={props.option.showAdminButton}
            showFriends={props.option.showFriends}
            menus={props.option.menus}
          />

          <div className=" mx-auto  lg:px-6  md:py-4 py-2 px-2 md:px-4  text-gray-700 ">
            <LayoutBody children={props.children} sideBar={props.sideBar} />
            <Footer
              ipcHref={props.option.ipcHref}
              ipcNumber={props.option.ipcNumber}
              since={props.option.since}
              version={props.option.version}
              gaBeianLogoUrl={props.option.gaBeianLogoUrl}
              gaBeianNumber={props.option.gaBeianNumber}
              gaBeianUrl={props.option.gaBeianUrl}
              showRunningTime={props.option.showRunningTime}
            />
          </div>
        {/* </ImageProvider> */}
      </ThemeContext.Provider>
      {props.option.enableCustomizing == "true" && (
        <CustomLayout
          customCss={props.option.customCss}
          customHtml={props.option.customHtml}
          customScript={props.option.customScript}
          customHead={props.option.customHead}
        />
      )}
    </>
  );
}

// https://umijs.org/config/
import MonacoWebpackPlugin from 'monaco-editor-webpack-plugin';
import { defineConfig } from '@umijs/max';
import fs from 'node:fs';
import path from 'node:path';
import defaultSettings from './defaultSettings';
import proxy from './proxy';
import routes from './routes';
const { REACT_APP_ENV } = process.env;
const rootPackage = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../../package.json'), 'utf8'),
);
const markdownThemeAssetVersion =
  process.env.VANBLOG_MARKDOWN_THEME_ASSET_VERSION ||
  process.env.VAN_BLOG_VERSION ||
  rootPackage.version ||
  'dev';
export default defineConfig({
  hash: true,
  base: '/admin/',
  publicPath:
    process.env.EEE === 'production' || process.env.NODE_ENV === 'production'
      ? '/admin/'
      : '/',
  antd: {},
  model: {},
  initialState: {},
  request: {},
  define: {
    'process.env.NEXT_PUBLIC_MARKDOWN_THEME_ASSET_VERSION': JSON.stringify(
      markdownThemeAssetVersion,
    ),
  },
  layout: {
    // https://umijs.org/zh-CN/plugins/plugin-layout
    locale: false,
    siderWidth: 208,
    ...defaultSettings,
  },
  // umi routes: https://umijs.org/docs/routing
  routes,
  access: {},
  title: false,
  ignoreMomentLocale: true,
  proxy: proxy[REACT_APP_ENV || 'dev'],
  manifest: {
    basePath: '/admin/',
  },
  esbuildMinifyIIFE: true,
  fastRefresh: true,
  mfsu: {},
  chainWebpack(memo, { env, webpack, createCSSRule }) {
    memo
      .plugin('monaco-editor-webpack-plugin')
      .use(MonacoWebpackPlugin, [
        { languages: ['css', 'json', 'html', 'javascript', 'typescript'] },
      ]);
  },
});

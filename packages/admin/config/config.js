// https://umijs.org/config/
import MonacoWebpackPlugin from 'monaco-editor-webpack-plugin';
import { defineConfig } from '@umijs/max';
import defaultSettings from './defaultSettings';
import proxy from './proxy';
import routes from './routes';
const { REACT_APP_ENV } = process.env;
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

import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  HttpsSetting,
  ISRSetting,
  LayoutSetting,
  LoginSetting,
  MenuSetting,
  StaticSetting,
  VersionSetting,
  WalineSetting,
  defaultStaticSetting,
  AdminLayoutSetting,
  defaultAdminLayoutSetting,
  AutoBackupSetting,
  defaultAutoBackupSetting,
  MusicSetting,
  defaultMusicSetting,
} from 'src/types/setting.dto';
import { SettingDocument } from 'src/scheme/setting.schema';
import { PicgoProvider } from '../static/picgo.provider';
import { encode } from 'js-base64';
import { defaultMenu, MenuItem } from 'src/types/menu.dto';
import { MetaProvider } from '../meta/meta.provider';
import { parseHtmlToHeadTagArr } from 'src/utils/htmlParser';
@Injectable()
export class SettingProvider {
  logger = new Logger(SettingProvider.name);
  constructor(
    @InjectModel('Setting')
    private settingModel: Model<SettingDocument>,
    private readonly picgoProvider: PicgoProvider,
    private readonly metaProvider: MetaProvider,
  ) {}
  async getStaticSetting(): Promise<Partial<StaticSetting>> {
    const res = (await this.settingModel.findOne({ type: 'static' }).exec()) as {
      value: StaticSetting;
    };
    if (res) {
      return res?.value || defaultStaticSetting;
    } else {
      await this.settingModel.create({
        type: 'static',
        value: defaultStaticSetting,
      });
      return defaultStaticSetting;
    }
  }
  async getVersionSetting(): Promise<any> {
    const res = await this.settingModel.findOne({ type: 'version' }).exec();
    if (res) {
      return res?.value;
    }
    return null;
  }
  async getISRSetting(): Promise<any> {
    const res = await this.settingModel.findOne({ type: 'isr' }).exec();
    if (res) {
      return res?.value;
    } else {
      await this.settingModel.create({
        type: 'isr',
        value: {
          mode: 'onDemand',
        },
      });
      return {
        mode: 'onDemand',
      };
    }
  }
  async updateISRSetting(dto: ISRSetting) {
    const oldValue = await this.getISRSetting();
    const newValue = { ...oldValue, ...dto };
    if (!oldValue) {
      return await this.settingModel.create({
        type: 'isr',
        value: newValue,
      });
    }
    const res = await this.settingModel.updateOne({ type: 'isr' }, { value: newValue });
    return res;
  }
  async getMenuSetting(): Promise<any> {
    const res = await this.settingModel.findOne({ type: 'menu' }).exec();
    if (res) {
      return res?.value;
    }
    return null;
  }
  async updateMenuSetting(dto: MenuSetting) {
    const oldValue = await this.getMenuSetting();
    const newValue = { ...oldValue, ...dto };
    if (!oldValue) {
      return await this.settingModel.create({
        type: 'menu',
        value: newValue,
      });
    }
    const res = await this.settingModel.updateOne({ type: 'menu' }, { value: newValue });
    return res;
  }
  async importSetting(setting: any) {
    for (const [k, v] of Object.entries(setting)) {
      if (k == 'static') {
        await this.importStaticSetting(v as any);
      }
    }
  }
  async importStaticSetting(dto: StaticSetting) {
    await this.updateStaticSetting(dto);
  }
  async getHttpsSetting(): Promise<HttpsSetting> {
    const res = await this.settingModel.findOne({ type: 'https' }).exec();
    if (res) {
      return (res?.value as any) || { redirect: false };
    }
    return null;
  }
  async getLayoutSetting(): Promise<LayoutSetting> {
    const res = await this.settingModel.findOne({ type: 'layout' }).exec();
    if (res) {
      return res?.value as any;
    }
    return null;
  }
  async getAdminLayoutSetting(): Promise<AdminLayoutSetting> {
    const res = await this.settingModel.findOne({ type: 'adminLayout' }).exec();
    if (res) {
      return res?.value as any;
    } else {
      await this.settingModel.create({
        type: 'adminLayout',
        value: defaultAdminLayoutSetting,
      });
      return defaultAdminLayoutSetting;
    }
  }
  async getLoginSetting(): Promise<LoginSetting> {
    const res = await this.settingModel.findOne({ type: 'login' }).exec();
    if (res) {
      return (
        (res?.value as any) || {
          enableMaxLoginRetry: false,
          maxRetryTimes: 3,
          durationSeconds: 60,
          expiresIn: 3600 * 24 * 7,
        }
      );
    }
    return null;
  }
  encodeLayoutSetting(dto: LayoutSetting) {
    if (!dto) {
      return null;
    }
    const res: any = {};
    
    // 首先处理动画，生成额外的CSS和Script
    let additionalCss = '';
    let additionalScript = '';
    
    // 如果总开关启用，或者任何子动画启用，都生成动画代码
    const hasAnyAnimationEnabled = dto.animations && (
      dto.animations.enabled || 
      dto.animations.snowflake?.enabled || 
      dto.animations.particles?.enabled || 
      dto.animations.heartClick?.enabled
    );
    
    if (hasAnyAnimationEnabled) {
      const animationCode = this.generateAnimationCode(dto.animations);
      additionalCss = animationCode.css || '';
      additionalScript = animationCode.script || '';
    }
    
    // 然后处理其他字段
    for (const key of Object.keys(dto)) {
      if (key == 'head') {
        res[key] = parseHtmlToHeadTagArr(dto[key]);
      } else if (key == 'animations') {
        // 保存动画配置
        res[key] = dto[key];
      } else if (key == 'css') {
        // 合并原有CSS和动画CSS
        const existingCss = dto[key] || '';
        const finalCss = existingCss + (additionalCss ? '\n' + additionalCss : '');
        res[key] = encode(finalCss);
      } else if (key == 'script') {
        // 合并原有Script和动画Script
        const existingScript = dto[key] || '';
        const finalScript = existingScript + (additionalScript ? '\n' + additionalScript : '');
        res[key] = encode(finalScript);
      } else {
        res[key] = encode(dto[key]);
      }
    }
    
    // 如果没有原始的css/script字段但有动画代码，需要添加它们
    if (additionalCss && !dto.css) {
      res.css = encode(additionalCss);
    }
    if (additionalScript && !dto.script) {
      res.script = encode(additionalScript);
    }
    
    return res;
  }

  private generateAnimationCode(animations: any): { css: string; script: string } {
    let css = '';
    let script = '';

    if (animations.snowflake?.enabled) {
      css += this.generateSnowflakeCSS(animations.snowflake);
      script += this.generateSnowflakeJS(animations.snowflake);
    }

    if (animations.particles?.enabled) {
      css += this.generateParticlesCSS(animations.particles);
      script += this.generateParticlesJS(animations.particles);
    }

    if (animations.heartClick?.enabled) {
      css += this.generateHeartClickCSS(animations.heartClick);
      script += this.generateHeartClickJS(animations.heartClick);
    }

    return { css, script };
  }

  private generateSnowflakeCSS(config: any): string {
    return `
.snow-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: -1;
  overflow: hidden;
}

.snowflake {
  position: absolute;
  will-change: transform;
  user-select: none;
  text-shadow: 0 0 6px ${config.color}88, 0 0 10px ${config.color}66;
  transform: translate3d(0, 0, 0);
  backface-visibility: hidden;
  color: ${config.color};
}
`;
  }

  private generateSnowflakeJS(config: any): string {
    return `
class SnowflakeSystem {
  constructor() {
    this.snowflakes = [];
    this.snowflakeChars = ['❅', '❆', '✻', '✼', '*'];
    this.snowflakeCount = ${config.count};
    this.isRunning = false;
    this.lastUpdateTime = 0;
    this.init();
  }

  init() {
    this.container = document.createElement('div');
    this.container.className = 'snow-container';
    document.body.appendChild(this.container);

    for (let i = 0; i < this.snowflakeCount; i++) {
      this.addSnowflake();
    }
    
    this.start();
  }

  addSnowflake() {
    const snowflake = this.createSnowflake();
    this.snowflakes.push(snowflake);
    this.container.appendChild(snowflake.element);
    return snowflake;
  }

  createSnowflake() {
    const element = document.createElement('div');
    element.className = 'snowflake';
    
    const char = this.snowflakeChars[Math.floor(Math.random() * this.snowflakeChars.length)];
    element.textContent = char;
    
    const size = ${config.size} * (0.5 + Math.random() * 0.5);
    element.style.fontSize = \`\${size}em\`;
    
    const opacity = 0.6 + Math.random() * 0.4;
    element.style.opacity = opacity;
    
    let x;
    const screenThird = window.innerWidth / 3;
    
    if (Math.random() < 0.9) {
      if (Math.random() < 0.5) {
        x = Math.random() * screenThird;
      } else {
        x = screenThird * 2 + Math.random() * screenThird;
      }
    } else {
      x = screenThird + Math.random() * screenThird;
    }
    
    const y = -50 - Math.random() * 100;
    element.style.transform = \`translate3d(\${x}px, \${y}px, 0)\`;
    
    return {
      element: element,
      x: x,
      y: y,
      speed: ${config.speed} * (0.5 + Math.random() * 1.5),
      drift: (Math.random() - 0.5) * 0.8,
      size: size,
      zone: x < screenThird ? 0 : (x > screenThird * 2 ? 2 : 1)
    };
  }

  resetSnowflake(snowflake) {
    const screenThird = window.innerWidth / 3;
    
    if (snowflake.zone === 0) {
      snowflake.x = Math.random() * screenThird;
    } else if (snowflake.zone === 2) {
      snowflake.x = screenThird * 2 + Math.random() * screenThird;
    } else {
      snowflake.x = screenThird + Math.random() * screenThird;
    }
    
    snowflake.y = -50 - Math.random() * 100;
    snowflake.speed = ${config.speed} * (0.5 + Math.random() * 1.5);
    snowflake.drift = (Math.random() - 0.5) * 0.8;
  }

  update(timestamp) {
    if (!this.lastUpdateTime) this.lastUpdateTime = timestamp;
    const deltaTime = timestamp - this.lastUpdateTime;
    this.lastUpdateTime = timestamp;
    
    if (deltaTime > 100) return;
    
    const deltaFactor = Math.min(deltaTime / 16, 2.5);
    
    this.snowflakes.forEach(snowflake => {
      snowflake.y += snowflake.speed * deltaFactor;
      
      if (snowflake.zone === 0 || snowflake.zone === 2) {
        snowflake.x += snowflake.drift * deltaFactor * 1.5;
      } else {
        snowflake.x += snowflake.drift * deltaFactor * 0.5;
      }
      
      if (snowflake.y > window.innerHeight + 50) {
        this.resetSnowflake(snowflake);
      }
      
      if (snowflake.zone !== 1) {
        if (snowflake.x > window.innerWidth + 50) {
          snowflake.x = -50;
        } else if (snowflake.x < -50) {
          snowflake.x = window.innerWidth + 50;
        }
      }
      
      snowflake.element.style.transform = \`translate3d(\${snowflake.x}px, \${snowflake.y}px, 0)\`;
    });
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastUpdateTime = 0;
    
    const animate = (timestamp) => {
      if (!this.isRunning) return;
      this.update(timestamp);
      requestAnimationFrame(animate);
    };
    
    requestAnimationFrame(animate);
  }

  stop() {
    this.isRunning = false;
  }

  handleResize() {
    this.container.style.width = \`\${window.innerWidth}px\`;
    this.container.style.height = \`\${window.innerHeight}px\`;
    
    const screenThird = window.innerWidth / 3;
    
    this.snowflakes.forEach(snowflake => {
      snowflake.zone = snowflake.x < screenThird ? 0 : (snowflake.x > screenThird * 2 ? 2 : 1);
      
      if (snowflake.zone === 1 && Math.random() < 0.3) {
        if (Math.random() < 0.5) {
          snowflake.x = Math.random() * screenThird;
          snowflake.zone = 0;
        } else {
          snowflake.x = screenThird * 2 + Math.random() * screenThird;
          snowflake.zone = 2;
        }
      }
      
      snowflake.element.style.transform = \`translate3d(\${snowflake.x}px, \${snowflake.y}px, 0)\`;
    });
  }

  destroy() {
    this.stop();
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}

let snowSystem;

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    snowSystem = new SnowflakeSystem();
  });

  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      if (snowSystem) snowSystem.handleResize();
    }, 100);
  });

  document.addEventListener('visibilitychange', () => {
    if (snowSystem) {
      document.hidden ? snowSystem.stop() : snowSystem.start();
    }
  });
}
`;
  }

  private generateParticlesCSS(config: any): string {
    // 根据主题模式设置不同的默认颜色
    const lightColor = config.color || '0,0,0';
    const darkColor = config.darkColor || '255,255,255';
    
    return `
.particles-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: -1;
  overflow: hidden;
}

.particles-canvas {
  width: 100%;
  height: 100%;
}
`;
  }

  private generateParticlesJS(config: any): string {
    // 颜色转换函数：十六进制转RGB
    const hexToRgb = (hex: string): string => {
      if (!hex) return '0,0,0';
      
      // 移除#号和空格
      let cleanHex = hex.replace(/[#\s]/g, '');
      
      // 处理3位十六进制颜色（如#fff）
      if (cleanHex.length === 3) {
        cleanHex = cleanHex.split('').map(char => char + char).join('');
      }
      
      // 确保是6位十六进制
      if (cleanHex.length !== 6 || !/^[0-9A-Fa-f]{6}$/.test(cleanHex)) {
        console.warn(`Invalid hex color: ${hex}, using default`);
        return '0,0,0';
      }
      
      // 解析RGB值
      const r = parseInt(cleanHex.substring(0, 2), 16);
      const g = parseInt(cleanHex.substring(2, 4), 16);
      const b = parseInt(cleanHex.substring(4, 6), 16);
      
      return `${r},${g},${b}`;
    };

    // 转换颜色配置
    const lightColor = hexToRgb(config.color || '#000000');
    const darkColor = hexToRgb(config.darkColor || '#ffffff');

    return `
// Canvas-nest.js 粒子连线动画 - 修复版本
(function() {
  'use strict';
  
  // 全局唯一标识符，避免多次初始化
  if (window.CANVAS_NEST_INITIALIZED) {
    return;
  }
  
  // 颜色配置
  const LIGHT_COLOR = '${lightColor}';
  const DARK_COLOR = '${darkColor}';
  
  // 工具函数
  const requestAnimationFrame = window.requestAnimationFrame ||
    window.webkitRequestAnimationFrame ||
    window.mozRequestAnimationFrame ||
    window.msRequestAnimationFrame ||
    window.oRequestAnimationFrame ||
    function(func) { return window.setTimeout(func, 1000 / 60); };

  const cancelAnimationFrame = window.cancelAnimationFrame ||
    window.webkitCancelAnimationFrame ||
    window.mozCancelAnimationFrame ||
    window.msCancelAnimationFrame ||
    window.oCancelAnimationFrame ||
    window.clearTimeout;

  const range = n => new Array(n).fill(0).map((e, idx) => idx);

  const canvasStyle = config => 
    \`display:block;position:absolute;top:0;left:0;height:100%;width:100%;overflow:hidden;pointer-events:none;z-index:\${config.zIndex};opacity:\${config.opacity}\`;

  // 获取当前主题颜色
  const getCurrentThemeColor = () => {
    if (typeof document !== 'undefined') {
      // 优先检查VanBlog的主题设置
      const htmlClass = document.documentElement.className;
      const dataTheme = document.documentElement.getAttribute('data-theme');
      const bodyClass = document.body.className;
      
      // VanBlog通过html class控制主题，优先级最高
      if (htmlClass.includes('dark')) {
        return DARK_COLOR;
      } else if (htmlClass.includes('light')) {
        return LIGHT_COLOR;
      }
      
      // 其次检查data-theme属性
      if (dataTheme === 'dark') {
        return DARK_COLOR;
      } else if (dataTheme === 'light') {
        return LIGHT_COLOR;
      }
      
      // 再检查body class
      if (bodyClass.includes('dark')) {
        return DARK_COLOR;
      } else if (bodyClass.includes('light')) {
        return LIGHT_COLOR;
      }
      
      // 最后才回退到系统偏好
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      return systemPrefersDark ? DARK_COLOR : LIGHT_COLOR;
    }
    return LIGHT_COLOR;
  };

  // 简化的size-sensor绑定
  const bindResize = (el, callback) => {
    const resizeHandler = () => callback();
    window.addEventListener('resize', resizeHandler);
    return () => window.removeEventListener('resize', resizeHandler);
  };

  // CanvasNest 类实现 - 修复版本
  class CanvasNest {
    constructor(el, config) {
      this.el = el;
      this.c = {
        zIndex: -1,
        opacity: 0.5,
        color: '0,0,0',
        pointColor: '0,0,0',
        count: 99,
        ...config,
      };

      this.destroyed = false;
      this.canvas = this.newCanvas();
      this.context = this.canvas.getContext('2d');
      this.points = this.randomPoints();
      this.current = {
        x: null,
        y: null,
        max: 20000
      };
      this.all = this.points.concat([this.current]);

      this.bindEvent();
      this.requestFrame(this.drawCanvas);
    }

    bindEvent() {
      this.unbindResize = bindResize(this.el, () => {
        if (!this.destroyed) {
          this.canvas.width = this.el.clientWidth;
          this.canvas.height = this.el.clientHeight;
          // 重新生成粒子点以适应新的尺寸
          this.points = this.randomPoints();
          this.all = this.points.concat([this.current]);
        }
      });

      this.onmousemove = window.onmousemove;
      window.onmousemove = e => {
        if (!this.destroyed) {
          try {
            this.current.x = e.clientX - this.el.offsetLeft + (document.scrollingElement?.scrollLeft || 0);
            this.current.y = e.clientY - this.el.offsetTop + (document.scrollingElement?.scrollTop || 0);
          } catch (err) {
            // 防止错误导致动画崩溃
            this.current.x = null;
            this.current.y = null;
          }
        }
        this.onmousemove && this.onmousemove(e);
      };

      this.onmouseout = window.onmouseout;
      window.onmouseout = () => {
        if (!this.destroyed) {
          this.current.x = null;
          this.current.y = null;
        }
        this.onmouseout && this.onmouseout();
      };
    }

    randomPoints() {
      const width = this.canvas.width;
      const height = this.canvas.height;
      
      return range(this.c.count).map(() => ({
        x: Math.random() * width,
        y: Math.random() * height,
        xa: (Math.random() - 0.5) * 2,  // 范围 -1 到 1
        ya: (Math.random() - 0.5) * 2,
        max: 6000
      }));
    }

    newCanvas() {
      if (getComputedStyle(this.el).position === 'static') {
        this.el.style.position = 'relative';
      }
      const canvas = document.createElement('canvas');
      canvas.style.cssText = canvasStyle(this.c);
      canvas.width = this.el.clientWidth;
      canvas.height = this.el.clientHeight;
      this.el.appendChild(canvas);
      return canvas;
    }

    requestFrame(func) {
      if (!this.destroyed) {
        this.tid = requestAnimationFrame(() => func.call(this));
      }
    }

    drawCanvas() {
      if (this.destroyed) return;
      
      try {
        const context = this.context;
        const width = this.canvas.width;
        const height = this.canvas.height;
        const current = this.current;
        const points = this.points;
        const all = this.all;
        
        // 检查canvas是否有效
        if (!context || width <= 0 || height <= 0) {
          this.requestFrame(this.drawCanvas);
          return;
        }

        context.clearRect(0, 0, width, height);

        // 每帧获取当前主题颜色
        const currentColor = getCurrentThemeColor();

        let e, i, d, x_dist, y_dist, dist;
        points.forEach((r, idx) => {
          // 移动粒子
          r.x += r.xa;
          r.y += r.ya;
          
          // 边界检查和反弹 - 增强版
          if (r.x >= width || r.x <= 0) {
            r.xa = -r.xa;
            r.x = Math.max(0, Math.min(width, r.x));
          }
          if (r.y >= height || r.y <= 0) {
            r.ya = -r.ya;
            r.y = Math.max(0, Math.min(height, r.y));
          }
          
          // 数值稳定性检查
          if (Math.abs(r.xa) > 3) r.xa = (r.xa > 0 ? 1 : -1) * Math.random() * 2;
          if (Math.abs(r.ya) > 3) r.ya = (r.ya > 0 ? 1 : -1) * Math.random() * 2;
          
          // 绘制粒子点
          context.fillStyle = \`rgba(\${currentColor}, 0.8)\`;
          context.fillRect(r.x - 0.5, r.y - 0.5, 1, 1);

          // 绘制连线
          for (i = idx + 1; i < all.length; i++) {
            e = all[i];
            if (null !== e.x && null !== e.y) {
              x_dist = r.x - e.x;
              y_dist = r.y - e.y;
              dist = x_dist * x_dist + y_dist * y_dist;

              if (dist < e.max && dist > 0) {
                if (e === current && dist >= e.max / 2) {
                  r.x -= 0.03 * x_dist;
                  r.y -= 0.03 * y_dist;
                }
                d = (e.max - dist) / e.max;
                
                // 确保透明度在合理范围内
                const opacity = Math.max(0, Math.min(1, d + 0.2));
                
                context.beginPath();
                context.lineWidth = Math.max(0.1, d / 2);
                context.strokeStyle = \`rgba(\${currentColor}, \${opacity})\`;
                context.moveTo(r.x, r.y);
                context.lineTo(e.x, e.y);
                context.stroke();
              }
            }
          }
        });
        
        this.requestFrame(this.drawCanvas);
      } catch (err) {
        console.warn('Canvas-nest animation error:', err);
        // 发生错误时重新初始化
        setTimeout(() => {
          if (!this.destroyed) {
            this.points = this.randomPoints();
            this.all = this.points.concat([this.current]);
            this.requestFrame(this.drawCanvas);
          }
        }, 1000);
      }
    }

    destroy() {
      this.destroyed = true;
      
      // 清除事件监听器
      if (this.unbindResize) {
        this.unbindResize();
        this.unbindResize = null;
      }
      
      // 恢复原始的鼠标事件处理器
      window.onmousemove = this.onmousemove;
      window.onmouseout = this.onmouseout;
      
      // 清除动画循环
      if (this.tid) {
        cancelAnimationFrame(this.tid);
        this.tid = null;
      }
      
      // 移除canvas元素
      if (this.canvas && this.canvas.parentNode) {
        this.canvas.parentNode.removeChild(this.canvas);
      }
      
      // 清除引用
      this.canvas = null;
      this.context = null;
      this.points = null;
      this.all = null;
    }
  }

  // 全局状态管理
  let canvasNestInstance = null;
  let themeObserver = null;
  let systemThemeMediaQuery = null;
  let lastThemeState = null;
  let initializationTimeout = null;
  
  function getCurrentThemeState() {
    const htmlClass = document.documentElement.className;
    const dataTheme = document.documentElement.getAttribute('data-theme');
    const bodyClass = document.body.className;
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    return {
      htmlClass,
      dataTheme,
      bodyClass,
      systemPrefersDark
    };
  }
  
  function hasThemeChanged() {
    const currentState = getCurrentThemeState();
    if (!lastThemeState) {
      lastThemeState = currentState;
      return true;
    }
    
    const changed = JSON.stringify(currentState) !== JSON.stringify(lastThemeState);
    if (changed) {
      lastThemeState = currentState;
    }
    return changed;
  }
  
  function initCanvasNest() {
    // 防止重复初始化
    if (initializationTimeout) {
      clearTimeout(initializationTimeout);
    }
    
    initializationTimeout = setTimeout(() => {
      // 清理之前的实例
      if (canvasNestInstance) {
        canvasNestInstance.destroy();
        canvasNestInstance = null;
      }
      
      const config = {
        zIndex: ${config.zIndex || -1},
        opacity: ${config.opacity || 0.5},
        color: getCurrentThemeColor(),
        pointColor: getCurrentThemeColor(),
        count: ${config.count || 99}
      };
      
      canvasNestInstance = new CanvasNest(document.body, config);
      initializationTimeout = null;
    }, 100);
  }

  function setupThemeObserver() {
    // 清理之前的观察器
    if (themeObserver) {
      themeObserver.disconnect();
    }
    
    if (systemThemeMediaQuery) {
      systemThemeMediaQuery.removeEventListener('change', handleSystemThemeChange);
    }
    
    // 设置DOM变化观察器
    if (typeof MutationObserver !== 'undefined') {
      themeObserver = new MutationObserver((mutations) => {
        let shouldUpdate = false;
        
        mutations.forEach((mutation) => {
          if (mutation.type === 'attributes' && 
              (mutation.attributeName === 'class' || mutation.attributeName === 'data-theme')) {
            shouldUpdate = true;
          }
        });
        
        if (shouldUpdate && hasThemeChanged()) {
          initCanvasNest();
        }
      });
      
      // 观察html和body元素的属性变化
      themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class', 'data-theme']
      });
      
      if (document.body) {
        themeObserver.observe(document.body, {
          attributes: true,
          attributeFilter: ['class']
        });
      }
    }
    
    // 设置系统主题变化监听
    if (window.matchMedia) {
      systemThemeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      systemThemeMediaQuery.addEventListener('change', handleSystemThemeChange);
    }
  }
  
  function handleSystemThemeChange() {
    if (hasThemeChanged()) {
      initCanvasNest();
    }
  }
  
  function cleanup() {
    if (canvasNestInstance) {
      canvasNestInstance.destroy();
      canvasNestInstance = null;
    }
    
    if (themeObserver) {
      themeObserver.disconnect();
      themeObserver = null;
    }
    
    if (systemThemeMediaQuery) {
      systemThemeMediaQuery.removeEventListener('change', handleSystemThemeChange);
      systemThemeMediaQuery = null;
    }
    
    if (initializationTimeout) {
      clearTimeout(initializationTimeout);
      initializationTimeout = null;
    }
  }
  
  // 页面卸载时清理资源
  window.addEventListener('beforeunload', cleanup);
  
  // 初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setupThemeObserver();
      initCanvasNest();
    });
  } else {
    setupThemeObserver();
    initCanvasNest();
  }
  
  // 标记已初始化
  window.CANVAS_NEST_INITIALIZED = true;
  
  // 提供全局清理方法
  window.CANVAS_NEST_CLEANUP = cleanup;
})();
`;
  }

  private generateHeartClickCSS(config: any): string {
    return `
/* 心形点击爆炸效果样式 */
.heart {
  width: 12px;
  height: 12px;
  position: fixed;
  background: #ff1744;
  transform: rotate(45deg);
  -webkit-transform: rotate(45deg);
  -moz-transform: rotate(45deg);
  pointer-events: none;
  z-index: 9999;
  animation: heartBeat 0.1s ease-out;
}

.heart:after,
.heart:before {
  content: '';
  width: inherit;
  height: inherit;
  background: inherit;
  border-radius: 50%;
  -webkit-border-radius: 50%;
  -moz-border-radius: 50%;
  position: absolute;
}

.heart:after {
  top: -6px;
}

.heart:before {
  left: -6px;
}

@keyframes heartBeat {
  0% { transform: scale(0) rotate(45deg); }
  50% { transform: scale(1.3) rotate(45deg); }
  100% { transform: scale(1) rotate(45deg); }
}

/* 爆炸粒子效果 */
.heart-particle {
  position: fixed;
  width: 6px;
  height: 6px;
  background: #ff1744;
  border-radius: 50%;
  pointer-events: none;
  z-index: 9998;
}
`;
  }

  private generateHeartClickJS(config: any): string {
    return `
// 心形点击爆炸效果系统 - 增强版粒子爆炸
(function(window, document, undefined) {
  'use strict';
  
  var hearts = [];
  var particles = [];
  
  // requestAnimationFrame 兼容性处理
  window.requestAnimationFrame = (function() {
    return window.requestAnimationFrame || 
           window.webkitRequestAnimationFrame ||
           window.mozRequestAnimationFrame ||
           window.oRequestAnimationFrame ||
           window.msRequestAnimationFrame ||
           function (callback) {
             setTimeout(callback, 1000/60);
           }
  })();
  
  init();
  
  function init() {
    addHeartStyles();
    attachEvent();
    gameloop();
  }
  
  function addHeartStyles() {
    var style = document.createElement("style");
    style.type = "text/css";
    var css = \`.heart{width: 10px;height: 10px;position: fixed;background: #f00;transform: rotate(45deg);-webkit-transform: rotate(45deg);-moz-transform: rotate(45deg);pointer-events: none;z-index: 9999;}
.heart:after,.heart:before{content: '';width: inherit;height: inherit;background: inherit;border-radius: 50%;-webkit-border-radius: 50%;-moz-border-radius: 50%;position: absolute;}
.heart:after{top: -5px;}
.heart:before{left: -5px;}
.heart-particle{position: fixed;width: 4px;height: 4px;border-radius: 50%;pointer-events: none;z-index: 9998;}
.heart-particle.small{width: 2px;height: 2px;}
.heart-particle.large{width: 6px;height: 6px;}\`;
    
    try {
      style.appendChild(document.createTextNode(css));
    } catch(ex) {
      style.styleSheet.cssText = css;
    }
    document.getElementsByTagName('head')[0].appendChild(style);
  }
  
  function gameloop() {
    // 处理心形动画
    for(var i = 0; i < hearts.length; i++) {
      if(hearts[i].alpha <= 0) {
        document.body.removeChild(hearts[i].el);
        hearts.splice(i, 1);
        i--;
        continue;
      }
      
      // 向上飘动
      hearts[i].y--;
      // 逐渐放大
      hearts[i].scale += 0.004;
      // 透明度逐渐减少
      hearts[i].alpha -= 0.013;
      
      // 更新样式
      hearts[i].el.style.cssText = 
        "left:" + hearts[i].x + "px;" +
        "top:" + hearts[i].y + "px;" +
        "opacity:" + hearts[i].alpha + ";" +
        "transform:scale(" + hearts[i].scale + "," + hearts[i].scale + ") rotate(45deg);" +
        "background:" + hearts[i].color + ";" +
        "pointer-events:none;" +
        "z-index:9999;";
    }
    
    // 处理爆炸粒子动画
    for(var j = 0; j < particles.length; j++) {
      if(particles[j].alpha <= 0 || particles[j].life <= 0) {
        document.body.removeChild(particles[j].el);
        particles.splice(j, 1);
        j--;
        continue;
      }
      
      // 粒子运动
      particles[j].x += particles[j].vx;
      particles[j].y += particles[j].vy;
      particles[j].vy += particles[j].gravity; // 重力效果
      particles[j].vx *= 0.98; // 空气阻力
      particles[j].alpha -= particles[j].fadeSpeed;
      particles[j].life--;
      
      // 更新粒子样式
      particles[j].el.style.cssText = 
        "left:" + particles[j].x + "px;" +
        "top:" + particles[j].y + "px;" +
        "opacity:" + particles[j].alpha + ";" +
        "background:" + particles[j].color + ";" +
        "transform:scale(" + (particles[j].scale * (particles[j].life / particles[j].maxLife)) + ");" +
        "border-radius: 50%;" +
        "pointer-events:none;" +
        "z-index:9998;";
    }
    
    requestAnimationFrame(gameloop);
  }
  
  function attachEvent() {
    var old = typeof window.onclick === "function" && window.onclick;
    window.onclick = function(event) {
      old && old();
      createHeartExplosion(event);
    }
  }
  
  function createHeartExplosion(event) {
    var clickX = event.clientX;
    var clickY = event.clientY;
    
    // 创建主心形
    createHeart(clickX, clickY);
    
    // 创建大量爆炸粒子效果
    createExplosionParticles(clickX, clickY);
  }
  
  function createHeart(x, y) {
    var heart = document.createElement("div");
    heart.className = "heart";
    hearts.push({
      el: heart,
      x: x - 5,
      y: y - 5,
      scale: 1,
      alpha: 1,
      color: getRandomHeartColor()
    });
    document.body.appendChild(heart);
  }
  
  function createExplosionParticles(centerX, centerY) {
    // 创建第一圈粒子 - 大粒子，速度快
    for(var i = 0; i < 12; i++) {
      createParticle(centerX, centerY, {
        angle: (i * 30) * Math.PI / 180,
        speed: 4 + Math.random() * 3,
        size: 'large',
        gravity: 0.2,
        fadeSpeed: 0.02,
        life: 80
      });
    }
    
    // 创建第二圈粒子 - 中等粒子，速度中等
    for(var j = 0; j < 16; j++) {
      createParticle(centerX, centerY, {
        angle: (j * 22.5) * Math.PI / 180,
        speed: 2.5 + Math.random() * 2,
        size: 'medium',
        gravity: 0.15,
        fadeSpeed: 0.025,
        life: 60
      });
    }
    
    // 创建第三圈粒子 - 小粒子，速度慢，数量多
    for(var k = 0; k < 20; k++) {
      createParticle(centerX, centerY, {
        angle: Math.random() * 2 * Math.PI,
        speed: 1 + Math.random() * 2,
        size: 'small',
        gravity: 0.1,
        fadeSpeed: 0.03,
        life: 50
      });
    }
    
    // 创建随机散射粒子
    for(var l = 0; l < 8; l++) {
      createParticle(centerX, centerY, {
        angle: Math.random() * 2 * Math.PI,
        speed: 5 + Math.random() * 4,
        size: Math.random() > 0.5 ? 'medium' : 'large',
        gravity: 0.25,
        fadeSpeed: 0.015,
        life: 90
      });
    }
  }
  
  function createParticle(centerX, centerY, options) {
    var particle = document.createElement("div");
    particle.className = "heart-particle " + (options.size || 'medium');
    
    var scale = options.size === 'large' ? 1.5 : (options.size === 'small' ? 0.7 : 1);
    
    particles.push({
      el: particle,
      x: centerX - 2,
      y: centerY - 2,
      vx: Math.cos(options.angle) * options.speed,
      vy: Math.sin(options.angle) * options.speed,
      gravity: options.gravity,
      fadeSpeed: options.fadeSpeed,
      alpha: 1,
      life: options.life,
      maxLife: options.life,
      scale: scale,
      color: getRandomParticleColor()
    });
    document.body.appendChild(particle);
  }
  
  function getRandomHeartColor() {
    var colors = [
      "rgb(255,20,147)", "rgb(255,105,180)", "rgb(255,69,0)", "rgb(255,140,0)",
      "rgb(255,215,0)", "rgb(50,205,50)", "rgb(0,191,255)", "rgb(138,43,226)",
      "rgb(255,0,255)", "rgb(220,20,60)"
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }
  
  function getRandomParticleColor() {
    var colors = [
      "rgb(255,20,147)", "rgb(255,105,180)", "rgb(255,69,0)", "rgb(255,140,0)",
      "rgb(255,215,0)", "rgb(50,205,50)", "rgb(0,191,255)", "rgb(138,43,226)",
      "rgb(255,0,255)", "rgb(220,20,60)", "rgb(255,192,203)", "rgb(255,160,122)",
      "rgb(173,216,230)", "rgb(221,160,221)", "rgb(240,230,140)", "rgb(255,218,185)"
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }
  
})(window, document);
`;
  }
  async getWalineSetting(): Promise<WalineSetting> {
    const res = await this.settingModel.findOne({ type: 'waline' }).exec();
    if (res) {
      return (
        (res?.value as any) || {
          email: process.env.EMAIL || undefined,
          'smtp.enabled': false,
          forceLoginComment: false,
        }
      );
    }
    return null;
  }
  async updateLoginSetting(dto: LoginSetting) {
    const oldValue = await this.getLoginSetting();
    const newValue = { ...oldValue, ...dto };
    if (!oldValue) {
      return await this.settingModel.create({
        type: 'login',
        value: newValue,
      });
    }
    const res = await this.settingModel.updateOne({ type: 'login' }, { value: newValue });
    return res;
  }
  async updateVersionSetting(dto: VersionSetting) {
    const oldValue = await this.getVersionSetting();
    const newValue = { ...oldValue, ...dto };
    if (!oldValue) {
      return await this.settingModel.create({
        type: 'version',
        value: newValue,
      });
    }
    const res = await this.settingModel.updateOne({ type: 'version' }, { value: newValue });
    return res;
  }

  async updateWalineSetting(dto: WalineSetting) {
    const oldValue = await this.getWalineSetting();
    const newValue = { ...oldValue, ...dto };
    if (!oldValue) {
      return await this.settingModel.create({
        type: 'waline',
        value: newValue,
      });
    }
    const res = await this.settingModel.updateOne({ type: 'waline' }, { value: newValue });
    return res;
  }
  async updateLayoutSetting(dto: LayoutSetting) {
    const oldValue = await this.getLayoutSetting();
    const newValue = { ...(oldValue || {}), ...dto };
    if (!oldValue) {
      return await this.settingModel.create({
        type: 'layout',
        value: newValue,
      });
    }
    const res = await this.settingModel.updateOne({ type: 'layout' }, { value: newValue });
    return res;
  }
  async updateAdminLayoutSetting(dto: AdminLayoutSetting) {
    const oldValue = await this.getAdminLayoutSetting();
    const newValue = { ...oldValue, ...dto };
    if (!oldValue) {
      return await this.settingModel.create({
        type: 'adminLayout',
        value: newValue,
      });
    }
    const res = await this.settingModel.updateOne({ type: 'adminLayout' }, { value: newValue });
    return res;
  }
  async updateHttpsSetting(dto: HttpsSetting) {
    const oldValue = await this.getHttpsSetting();
    const newValue = { ...oldValue, ...dto };
    if (!oldValue) {
      return await this.settingModel.create({
        type: 'https',
        value: newValue,
      });
    }
    const res = await this.settingModel.updateOne({ type: 'https' }, { value: newValue });
    return res;
  }
  async updateStaticSetting(dto: Partial<StaticSetting>) {
    const oldValue = await this.getStaticSetting();
    const newValue = { ...oldValue, ...dto };
    if (!oldValue) {
      return await this.settingModel.create({
        type: 'static',
        value: newValue,
      });
    }
    const res = await this.settingModel.updateOne({ type: 'static' }, { value: newValue });

    await this.picgoProvider.initDriver();
    return res;
  }
  async washDefaultMenu() {
    const r = await this.settingModel.findOne({ type: 'menu' });
    if (!r) {
      // 没有的话需要清洗
      const toInsert: MenuItem[] = defaultMenu;
      const meta = await this.metaProvider.getAll();
      const oldMenus = meta.menus;
      const d = Date.now();
      oldMenus.forEach((item: any, index: number) => {
        toInsert.push({
          id: d + index,
          level: 0,
          name: item.name,
          value: item.value,
        });
      });
      await this.updateMenuSetting({ data: toInsert });
      this.logger.log('清洗老 menu 数据成功！');
    }
  }

  async getAutoBackupSetting(): Promise<AutoBackupSetting> {
    const setting = await this.settingModel.findOne({ type: 'autoBackup' });
    if (!setting || !setting.value) {
      return defaultAutoBackupSetting;
    }
    
    // 类型断言，因为我们知道这是 AutoBackupSetting 类型
    const autoBackupValue = setting.value as AutoBackupSetting;
    
    // 合并默认设置以确保新增字段有默认值
    return {
      ...defaultAutoBackupSetting,
      ...autoBackupValue,
      aliyunpan: {
        ...defaultAutoBackupSetting.aliyunpan,
        ...(autoBackupValue.aliyunpan || {}),
      },
    };
  }

  async updateAutoBackupSetting(setting: AutoBackupSetting): Promise<void> {
    await this.settingModel.updateOne(
      { type: 'autoBackup' },
      { 
        type: 'autoBackup',
        value: setting,
        updatedAt: new Date(),
      },
      { upsert: true }
    );
  }

  async getMusicSetting(): Promise<MusicSetting> {
    const res = await this.settingModel.findOne({ type: 'music' }).exec();
    if (res) {
      return res?.value as any;
    } else {
      await this.settingModel.create({
        type: 'music',
        value: defaultMusicSetting,
      });
      return defaultMusicSetting;
    }
  }

  async updateMusicSetting(dto: Partial<MusicSetting>) {
    const oldValue = await this.getMusicSetting();
    const newValue = { ...oldValue, ...dto };
    
    const existingSetting = await this.settingModel.findOne({ type: 'music' }).exec();
    if (existingSetting) {
      const res = await this.settingModel.updateOne({ type: 'music' }, { value: newValue });
      this.logger.log('音乐设置已更新');
      return res;
    } else {
      const res = await this.settingModel.create({
        type: 'music',
        value: newValue,
      });
      this.logger.log('音乐设置已创建');
      return res;
    }
  }
}

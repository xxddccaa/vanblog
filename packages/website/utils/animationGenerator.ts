export interface AnimationConfig {
  enabled: boolean;
  snowflake?: {
    enabled: boolean;
    color: string;
    count: number;
    speed: number;
    size: number;
  };
  particles?: {
    enabled: boolean;
    color: string;
    lineColor: string;
    count: number;
    speed: number;
    maxDistance: number;
  };
  mouseDrag?: {
    enabled: boolean;
    color: string;
    darkColor: string;
    particleCount: number;
    particleSize: number;
    trailLength: number;
    speed: number;
    opacity: number;
    intensity: number;
  };
}

export function generateSnowflakeCSS(config: AnimationConfig['snowflake']) {
  if (!config?.enabled) return '';
  
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

export function generateSnowflakeJS(config: AnimationConfig['snowflake']) {
  if (!config?.enabled) return '';
  
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

export function generateParticlesCSS(config: AnimationConfig['particles']) {
  if (!config?.enabled) return '';
  
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

export function generateParticlesJS(config: AnimationConfig['particles']) {
  if (!config?.enabled) return '';
  
  return `
class ParticleSystem {
  constructor() {
    this.particles = [];
    this.particleCount = ${config.count};
    this.maxDistance = ${config.maxDistance};
    this.particleSpeed = ${config.speed};
    this.mouseX = 0;
    this.mouseY = 0;
    this.init();
  }

  init() {
    this.container = document.createElement('div');
    this.container.className = 'particles-container';
    
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'particles-canvas';
    this.ctx = this.canvas.getContext('2d');
    
    this.container.appendChild(this.canvas);
    document.body.appendChild(this.container);
    
    this.resize();
    this.createParticles();
    this.bindEvents();
    this.animate();
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  createParticles() {
    for (let i = 0; i < this.particleCount; i++) {
      this.particles.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        vx: (Math.random() - 0.5) * this.particleSpeed,
        vy: (Math.random() - 0.5) * this.particleSpeed,
        opacity: Math.random() * 0.5 + 0.5
      });
    }
  }

  bindEvents() {
    document.addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    });

    window.addEventListener('resize', () => {
      this.resize();
    });
  }

  drawParticle(particle) {
    this.ctx.beginPath();
    this.ctx.arc(particle.x, particle.y, 2, 0, Math.PI * 2);
    this.ctx.fillStyle = \`rgba(\${this.hexToRgb('${config.color}')}, \${particle.opacity})\`;
    this.ctx.fill();
  }

  drawConnection(p1, p2, distance) {
    const opacity = 1 - distance / this.maxDistance;
    this.ctx.beginPath();
    this.ctx.moveTo(p1.x, p1.y);
    this.ctx.lineTo(p2.x, p2.y);
    this.ctx.strokeStyle = \`rgba(\${this.hexToRgb('${config.lineColor}')}, \${opacity * 0.3})\`;
    this.ctx.lineWidth = 0.5;
    this.ctx.stroke();
  }

  hexToRgb(hex) {
    const result = /^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(hex);
    return result ? 
      \`\${parseInt(result[1], 16)}, \${parseInt(result[2], 16)}, \${parseInt(result[3], 16)}\` : 
      '255, 255, 255';
  }

  update() {
    this.particles.forEach(particle => {
      particle.x += particle.vx;
      particle.y += particle.vy;

      if (particle.x < 0 || particle.x > this.canvas.width) particle.vx *= -1;
      if (particle.y < 0 || particle.y > this.canvas.height) particle.vy *= -1;

      particle.x = Math.max(0, Math.min(this.canvas.width, particle.x));
      particle.y = Math.max(0, Math.min(this.canvas.height, particle.y));

      const dx = this.mouseX - particle.x;
      const dy = this.mouseY - particle.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < this.maxDistance) {
        const force = (this.maxDistance - distance) / this.maxDistance;
        particle.vx += dx * force * 0.001;
        particle.vy += dy * force * 0.001;
      }

      particle.vx *= 0.99;
      particle.vy *= 0.99;
    });
  }

  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (let i = 0; i < this.particles.length; i++) {
      this.drawParticle(this.particles[i]);

      for (let j = i + 1; j < this.particles.length; j++) {
        const dx = this.particles[i].x - this.particles[j].x;
        const dy = this.particles[i].y - this.particles[j].y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < this.maxDistance) {
          this.drawConnection(this.particles[i], this.particles[j], distance);
        }
      }
    }
  }

  animate() {
    this.update();
    this.draw();
    requestAnimationFrame(() => this.animate());
  }

  destroy() {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}

let particleSystem;

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    particleSystem = new ParticleSystem();
  });
}
`;
}

export function generateMouseDragCSS(config: AnimationConfig['mouseDrag']) {
  if (!config?.enabled) return '';
  
  return `
.mouse-drag-canvas {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1000;
  opacity: ${config.opacity || 0.8};
}
`;
}

export function generateMouseDragJS(config: AnimationConfig['mouseDrag']) {
  if (!config?.enabled) return '';
  
  return `
// GPU检测和多方案支持的炫酷鼠标拖动特效
class AdvancedMouseDragSystem {
  constructor() {
    this.canvas = null;
    this.particles = [];
    this.trails = [];
    this.mouseX = 0;
    this.mouseY = 0;
    this.lastMouseX = 0;
    this.lastMouseY = 0;
    this.isMouseDown = false;
    this.isRunning = false;
    this.animationId = null;
    this.time = 0;
    this.useWebGL = false;
    this.gl = null;
    this.ctx = null;
    
    this.config = {
      particleCount: ${config.particleCount || 30},
      particleSize: ${config.particleSize || 2},
      trailLength: ${config.trailLength || 20},
      speed: ${config.speed || 1},
      color: '${config.darkColor || '#ffffff'}',
      intensity: ${config.intensity || 3}
    };
    
    // 调试信息 - 验证粒子数量设置
    console.log('🎆 鼠标拖动特效配置:', this.config);
    console.log('🎯 粒子数量设置:', this.config.particleCount);
    console.log('💫 最大粒子数量:', Math.max(this.config.particleCount * 100, 50000));
    
    this.init();
  }

  // 检测WebGL支持
  detectWebGL() {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      return !!gl;
    } catch (e) {
      return false;
    }
  }

  init() {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'mouse-drag-canvas';
    
    // 设置Canvas样式，参考 particle-love.com 的效果
    this.canvas.style.position = 'fixed';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = '9999';
    this.canvas.style.mixBlendMode = 'screen';
    this.canvas.style.opacity = '0.8';
    
    this.updateCanvasSize();
    document.body.appendChild(this.canvas);
    
    // 尝试使用WebGL
    this.useWebGL = this.detectWebGL();
    
    if (this.useWebGL) {
      this.initWebGL();
    } else {
      this.initCanvas2D();
    }
    
    this.bindEvents();
    this.start();
  }

  initWebGL() {
    console.log('🚀 使用WebGL高性能模式');
    this.gl = this.canvas.getContext('webgl') || this.canvas.getContext('experimental-webgl');
    if (!this.gl) {
      this.useWebGL = false;
      this.initCanvas2D();
      return;
    }
    // WebGL初始化逻辑
    this.setupWebGLShaders();
  }

  initCanvas2D() {
    console.log('🎨 使用Canvas 2D兼容模式');
    this.ctx = this.canvas.getContext('2d');
    this.ctx.globalCompositeOperation = 'lighter';
  }

  setupWebGLShaders() {
    const vertexShaderSource = \`
      attribute vec2 a_position;
      attribute float a_size;
      attribute float a_alpha;
      attribute vec3 a_color;
      
      varying float v_alpha;
      varying vec3 v_color;
      
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        gl_PointSize = a_size;
        v_alpha = a_alpha;
        v_color = a_color;
      }
    \`;
    
    const fragmentShaderSource = \`
      precision mediump float;
      
      varying float v_alpha;
      varying vec3 v_color;
      
      void main() {
        vec2 center = gl_PointCoord - 0.5;
        float dist = length(center);
        
        if (dist > 0.5) discard;
        
        float intensity = 1.0 - (dist * 2.0);
        intensity = pow(intensity, 2.0);
        
        gl_FragColor = vec4(v_color, v_alpha * intensity);
      }
    \`;
    
    this.program = this.createShaderProgram(vertexShaderSource, fragmentShaderSource);
  }

  createShaderProgram(vertexSource, fragmentSource) {
    const vertexShader = this.createShader(this.gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, fragmentSource);
    
    const program = this.gl.createProgram();
    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);
    
    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      console.error('WebGL程序链接失败');
      this.useWebGL = false;
      this.initCanvas2D();
      return null;
    }
    
    return program;
  }

  createShader(type, source) {
    const shader = this.gl.createShader(type);
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.error('着色器编译失败:', this.gl.getShaderInfoLog(shader));
      return null;
    }
    
    return shader;
  }

  updateCanvasSize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    
    if (this.gl) {
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  bindEvents() {
    const self = this;
    
    document.addEventListener('mousemove', function(e) {
      self.lastMouseX = self.mouseX;
      self.lastMouseY = self.mouseY;
      self.mouseX = e.clientX;
      self.mouseY = e.clientY;
      
      // 添加轨迹点
      self.addTrailPoint(self.mouseX, self.mouseY);
      
      if (self.isMouseDown) {
        self.emitParticles(1.0);
      } else {
        // 鼠标移动时也发射少量粒子
        self.emitParticles(0.2);
      }
    });

    document.addEventListener('mousedown', function(e) {
      self.isMouseDown = true;
      self.mouseX = e.clientX;
      self.mouseY = e.clientY;
      console.log('🖱️ 鼠标按下 - 发射大量粒子');
      self.emitParticles(2.0);
    });

    document.addEventListener('mouseup', function() {
      self.isMouseDown = false;
    });

    window.addEventListener('resize', function() {
      self.updateCanvasSize();
    });
  }

  addTrailPoint(x, y) {
    this.trails.push({
      x: x,
      y: y,
      life: 30,
      maxLife: 30
    });
    
    // 限制轨迹点数量
    if (this.trails.length > 50) {
      this.trails.shift();
    }
  }

  emitParticles(multiplier = 1) {
    const distance = Math.sqrt(
      Math.pow(this.mouseX - this.lastMouseX, 2) + 
      Math.pow(this.mouseY - this.lastMouseY, 2)
    );
    
    // 重新设计粒子发射逻辑 - 让用户配置的粒子数量真正生效
    let particleCount;
    if (this.isMouseDown) {
      // 鼠标按下时：根据配置的粒子数量和移动距离发射
      particleCount = Math.floor(this.config.particleCount * 0.01 * multiplier * Math.max(1, distance / 10));
    } else {
      // 鼠标移动时：发射配置数量的一小部分
      particleCount = Math.floor(this.config.particleCount * 0.001 * multiplier);
    }
    
    // 确保至少有一些粒子
    particleCount = Math.max(1, particleCount);
    
    // 调试信息 - 显示本次发射的粒子数量
    if (particleCount > 10) {
      console.log('✨ 发射粒子数量:', particleCount, '总粒子数:', this.particles.length);
    }
    
    const color = this.hexToRgb(this.config.color);
    
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 20;
      const speed = this.config.speed * (0.3 + Math.random() * 1.2);
      
      this.particles.push({
        x: this.mouseX + Math.cos(angle) * radius,
        y: this.mouseY + Math.sin(angle) * radius,
        vx: (Math.random() - 0.5) * 4 * speed + Math.cos(angle) * 1.5,
        vy: (Math.random() - 0.5) * 4 * speed + Math.sin(angle) * 1.5,
        life: this.config.trailLength * (0.5 + Math.random() * 1.0),
        maxLife: this.config.trailLength,
        size: this.config.particleSize * (0.3 + Math.random() * 0.7),
        color: color,
        brightness: 0.4 + Math.random() * 0.6,
        spin: (Math.random() - 0.5) * 0.1
      });
    }
    
    // 大幅提高粒子数量限制，让大量粒子设置生效
    const maxParticles = Math.max(this.config.particleCount * 100, 50000);
    if (this.particles.length > maxParticles) {
      this.particles = this.particles.slice(-Math.floor(maxParticles * 0.8));
    }
  }

  hexToRgb(hex) {
    const result = /^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 255, g: 255, b: 255 };
  }

  updateWebGL() {
    if (!this.gl || !this.program) return;
    
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    this.gl.useProgram(this.program);
    
    // WebGL粒子渲染逻辑
    // 这里可以添加更复杂的GPU粒子计算
  }

  updateCanvas2D() {
    // 创建更柔和的模糊效果
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.02)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    this.ctx.globalCompositeOperation = 'lighter';
    
    // 绘制轨迹
    this.drawTrails();
    
    // 持续在鼠标附近生成环境粒子（像 particle-love.com）
    if (Math.random() < 0.3) {
      this.generateAmbientParticles();
    }
    
    // 更新和绘制粒子
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];
      
      // 更柔和的物理更新
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vx *= 0.995; // 更小的阻力
      particle.vy *= 0.995;
      particle.vy += 0.02; // 更小的重力
      particle.life--;
      
      if (particle.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      
      // 计算透明度和大小 - 更柔和的过渡
      const alpha = Math.pow(particle.life / particle.maxLife, 0.5) * particle.brightness;
      const size = particle.size * (0.3 + alpha * 0.7);
      
      // 绘制更大更柔和的光晕效果
      const gradient = this.ctx.createRadialGradient(
        particle.x, particle.y, 0,
        particle.x, particle.y, size * 5
      );
      
      gradient.addColorStop(0, \`rgba(\${particle.color.r}, \${particle.color.g}, \${particle.color.b}, \${alpha * 0.8})\`);
      gradient.addColorStop(0.2, \`rgba(\${particle.color.r}, \${particle.color.g}, \${particle.color.b}, \${alpha * 0.4})\`);
      gradient.addColorStop(0.6, \`rgba(\${particle.color.r}, \${particle.color.g}, \${particle.color.b}, \${alpha * 0.1})\`);
      gradient.addColorStop(1, \`rgba(\${particle.color.r}, \${particle.color.g}, \${particle.color.b}, 0)\`);
      
      this.ctx.save();
      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.arc(particle.x, particle.y, size * 5, 0, Math.PI * 2);
      this.ctx.fill();
      
      // 绘制更小更柔和的核心粒子
      this.ctx.fillStyle = \`rgba(\${particle.color.r}, \${particle.color.g}, \${particle.color.b}, \${alpha * 0.6})\`;
      this.ctx.beginPath();
      this.ctx.arc(particle.x, particle.y, size * 0.5, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }
    
    this.ctx.globalCompositeOperation = 'source-over';
  }
  
  // 生成环境粒子，让效果更丰富
  generateAmbientParticles() {
    const color = this.hexToRgb(this.config.color);
    const count = Math.max(1, Math.floor(this.config.particleCount * 0.0001)); // 至少1个环境粒子
    
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 50 + Math.random() * 100;
      
      this.particles.push({
        x: this.mouseX + Math.cos(angle) * radius,
        y: this.mouseY + Math.sin(angle) * radius,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        life: this.config.trailLength * (2 + Math.random() * 2),
        maxLife: this.config.trailLength * 3,
        size: this.config.particleSize * (0.1 + Math.random() * 0.3),
        color: color,
        brightness: 0.1 + Math.random() * 0.2,
        spin: (Math.random() - 0.5) * 0.05
      });
    }
  }

  drawTrails() {
    if (this.trails.length < 2) return;
    
    this.ctx.strokeStyle = \`rgba(\${this.hexToRgb(this.config.color).r}, \${this.hexToRgb(this.config.color).g}, \${this.hexToRgb(this.config.color).b}, 0.3)\`;
    this.ctx.lineWidth = 2;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    
    this.ctx.beginPath();
    this.ctx.moveTo(this.trails[0].x, this.trails[0].y);
    
    for (let i = 1; i < this.trails.length; i++) {
      const trail = this.trails[i];
      const alpha = trail.life / trail.maxLife;
      
      if (alpha > 0.1) {
        this.ctx.lineTo(trail.x, trail.y);
      }
      
      trail.life--;
    }
    
    this.ctx.stroke();
    
    // 清理过期轨迹点
    this.trails = this.trails.filter(trail => trail.life > 0);
  }

  update() {
    this.time += 16.67; // 假设60fps
    
    // 每隔5秒输出一次粒子数量调试信息
    if (Math.floor(this.time / 5000) !== Math.floor((this.time - 16.67) / 5000)) {
      console.log('🎨 当前粒子数量:', this.particles.length, '配置的粒子数量:', this.config.particleCount);
    }
    
    if (this.useWebGL) {
      this.updateWebGL();
    } else {
      this.updateCanvas2D();
    }
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    
    const animate = () => {
      if (!this.isRunning) return;
      this.update();
      this.animationId = requestAnimationFrame(animate);
    };
    
    animate();
  }

  stop() {
    this.isRunning = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  destroy() {
    this.stop();
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
  }
}

let mouseDragSystem;

if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', function() {
    if (window.mouseDragSystem) {
      window.mouseDragSystem.destroy();
    }
    mouseDragSystem = new AdvancedMouseDragSystem();
    window.mouseDragSystem = mouseDragSystem;
    
    // 添加测试函数到全局，方便调试
    window.testParticleSettings = function() {
      console.log('🔍 测试粒子设置:');
      console.log('配置的粒子数量:', mouseDragSystem.config.particleCount);
      console.log('当前粒子数量:', mouseDragSystem.particles.length);
      console.log('是否使用WebGL:', mouseDragSystem.useWebGL);
    };
    
    console.log('🎯 输入 testParticleSettings() 来查看粒子设置');
  });
}
`;
}

export function generateAnimationCode(config: AnimationConfig) {
  if (!config?.enabled) return { css: '', script: '' };
  
  let css = '';
  let script = '';
  
  if (config.snowflake?.enabled) {
    css += generateSnowflakeCSS(config.snowflake);
    script += generateSnowflakeJS(config.snowflake);
  }
  
  if (config.particles?.enabled) {
    css += generateParticlesCSS(config.particles);
    script += generateParticlesJS(config.particles);
  }

  if (config.mouseDrag?.enabled) {
    css += generateMouseDragCSS(config.mouseDrag);
    script += generateMouseDragJS(config.mouseDrag);
  }
  
  return { css, script };
} 
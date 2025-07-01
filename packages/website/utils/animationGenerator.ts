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
  
  return { css, script };
} 
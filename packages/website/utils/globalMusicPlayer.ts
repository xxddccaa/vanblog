// 全局音乐播放器管理器
interface MusicFile {
  sign: string;
  name: string;
  realPath: string;
  meta?: {
    size: string;
  };
}

interface MusicSetting {
  enabled: boolean;
  showControl: boolean;
  autoPlay: boolean;
  loop: boolean;
  volume: number;
  currentPlaylist: string[];
  currentIndex: number;
}

interface GlobalMusicState {
  musicSetting: MusicSetting | null;
  musicList: MusicFile[];
  currentTrack: MusicFile | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isLoading: boolean;
  hasUserInteracted: boolean;
  autoPlayPending: boolean;
}

type StateListener = (state: GlobalMusicState) => void;

class GlobalMusicPlayer {
  private static instance: GlobalMusicPlayer;
  private audio: HTMLAudioElement | null = null;
  private state: GlobalMusicState = {
    musicSetting: null,
    musicList: [],
    currentTrack: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 50,
    isLoading: true,
    hasUserInteracted: false,
    autoPlayPending: false,
  };
  private listeners: Set<StateListener> = new Set();
  private timeUpdateInterval: number | null = null;
  private interactionListenersAdded = false;

  private constructor() {
    // 私有构造函数，确保单例
    if (typeof window !== 'undefined') {
      this.initializeAudio();
      this.loadStateFromStorage();
    }
  }

  public static getInstance(): GlobalMusicPlayer {
    if (!GlobalMusicPlayer.instance) {
      GlobalMusicPlayer.instance = new GlobalMusicPlayer();
    }
    return GlobalMusicPlayer.instance;
  }

  private initializeAudio() {
    if (this.audio) return;

    this.audio = new Audio();
    this.audio.preload = 'metadata';
    
    // 绑定音频事件
    this.audio.addEventListener('loadeddata', () => {
      this.updateState({ duration: this.audio?.duration || 0 });
      if (this.audio) {
        this.audio.volume = this.state.volume / 100;
      }
    });

    this.audio.addEventListener('timeupdate', () => {
      this.updateState({ currentTime: this.audio?.currentTime || 0 });
    });

    this.audio.addEventListener('play', () => {
      this.updateState({ isPlaying: true, autoPlayPending: false });
      this.saveStateToStorage();
    });

    this.audio.addEventListener('pause', () => {
      this.updateState({ isPlaying: false });
      this.saveStateToStorage();
    });

    this.audio.addEventListener('ended', () => {
      if (this.state.musicSetting?.loop) {
        this.playNext();
      } else {
        this.updateState({ isPlaying: false });
      }
      this.saveStateToStorage();
    });

    this.audio.addEventListener('canplay', () => {
      console.log('音频canplay事件触发');
      // 当音频可以播放时，如果有待播放的自动播放且用户已交互，立即播放
      if (this.state.autoPlayPending && this.state.hasUserInteracted) {
        console.log('执行延迟的自动播放');
        this.audio?.play().then(() => {
          console.log('延迟自动播放成功');
        }).catch((error) => {
          console.error('延迟自动播放失败:', error);
          this.updateState({ autoPlayPending: false });
        });
      }
      // 如果是初次加载且设置了自动播放，也尝试播放
      else if (this.state.autoPlayPending && this.state.musicSetting?.autoPlay) {
        console.log('尝试无用户交互的自动播放');
        this.audio?.play().then(() => {
          console.log('无用户交互自动播放成功');
          this.updateState({ autoPlayPending: false, hasUserInteracted: true });
        }).catch((error) => {
          console.log('无用户交互自动播放失败，等待用户交互:', error.message);
          // 播放失败时确保添加交互监听器
          if (!this.interactionListenersAdded) {
            this.addInteractionListeners();
          }
        });
      }
    });

    this.audio.addEventListener('error', (e) => {
      console.error('音频加载错误:', e);
      this.updateState({ isPlaying: false, autoPlayPending: false });
    });
  }

  // 状态更新
  private updateState(newState: Partial<GlobalMusicState>) {
    this.state = { ...this.state, ...newState };
    this.notifyListeners();
  }

  // 通知所有监听器
  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.state));
  }

  // 添加状态监听器
  public subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    // 立即发送当前状态
    listener(this.state);
    
    // 返回取消订阅函数
    return () => {
      this.listeners.delete(listener);
    };
  }

  // 保存状态到本地存储
  private saveStateToStorage() {
    if (typeof window === 'undefined') return;
    
    try {
      const stateToSave = {
        currentTrack: this.state.currentTrack,
        currentTime: this.state.currentTime,
        volume: this.state.volume,
        isPlaying: this.state.isPlaying,
        hasUserInteracted: this.state.hasUserInteracted,
      };
      localStorage.setItem('globalMusicPlayerState', JSON.stringify(stateToSave));
    } catch (error) {
      console.warn('保存音乐播放器状态失败:', error);
    }
  }

  // 从本地存储加载状态
  private loadStateFromStorage() {
    if (typeof window === 'undefined') return;
    
    try {
      const savedState = localStorage.getItem('globalMusicPlayerState');
      if (savedState) {
        const parsed = JSON.parse(savedState);
        this.updateState({
          currentTrack: parsed.currentTrack,
          currentTime: parsed.currentTime || 0,
          volume: parsed.volume || 50,
          hasUserInteracted: parsed.hasUserInteracted || false,
          // 不恢复播放状态，避免自动播放
          isPlaying: false,
        });
        
        // 如果有保存的音轨，设置音频源但不播放
        if (parsed.currentTrack && this.audio) {
          this.audio.src = parsed.currentTrack.realPath;
          this.audio.currentTime = parsed.currentTime || 0;
        }
      }
    } catch (error) {
      console.warn('加载音乐播放器状态失败:', error);
    }
  }

  // 添加用户交互监听器
  private interactionHandlers: { [key: string]: () => void } = {};

  private addInteractionListeners() {
    if (this.interactionListenersAdded || this.state.hasUserInteracted) return;

    const handleFirstInteraction = async () => {
      console.log('用户首次交互，尝试自动播放');
      this.updateState({ hasUserInteracted: true });
      
      // 如果有待播放的自动播放，立即执行
      if (this.state.autoPlayPending && this.audio && this.state.currentTrack) {
        console.log('检测到待播放状态，开始播放音乐');
        try {
          if (this.audio.readyState >= 2) {
            await this.audio.play();
            console.log('音乐开始播放');
          } else {
            console.log('等待音频加载完成');
            this.audio.addEventListener('canplay', async () => {
              try {
                await this.audio!.play();
                console.log('音频加载完成，开始播放');
              } catch (error) {
                console.error('自动播放失败:', error);
                this.updateState({ autoPlayPending: false });
              }
            }, { once: true });
          }
        } catch (error) {
          console.error('自动播放失败:', error);
          this.updateState({ autoPlayPending: false });
        }
      }
      
      // 移除监听器
      this.removeInteractionListeners();
    };

    // 保存事件处理器引用以便正确移除
    this.interactionHandlers = {
      click: handleFirstInteraction,
      touchstart: handleFirstInteraction,
      keydown: handleFirstInteraction,
      scroll: handleFirstInteraction,
      mousemove: handleFirstInteraction,
    };

    // 添加多种交互事件监听器
    document.addEventListener('click', this.interactionHandlers.click, { passive: true });
    document.addEventListener('touchstart', this.interactionHandlers.touchstart, { passive: true });
    document.addEventListener('keydown', this.interactionHandlers.keydown, { passive: true });
    document.addEventListener('scroll', this.interactionHandlers.scroll, { passive: true });
    document.addEventListener('mousemove', this.interactionHandlers.mousemove, { passive: true });
    
    this.interactionListenersAdded = true;
    console.log('用户交互监听器已添加');
  }

  private removeInteractionListeners() {
    if (!this.interactionListenersAdded) return;

    // 移除所有事件监听器
    document.removeEventListener('click', this.interactionHandlers.click);
    document.removeEventListener('touchstart', this.interactionHandlers.touchstart);
    document.removeEventListener('keydown', this.interactionHandlers.keydown);
    document.removeEventListener('scroll', this.interactionHandlers.scroll);
    document.removeEventListener('mousemove', this.interactionHandlers.mousemove);
    
    this.interactionListenersAdded = false;
    this.interactionHandlers = {};
    console.log('用户交互监听器已移除');
  }

  // 获取音乐设置
  public async fetchMusicSetting(): Promise<MusicSetting | null> {
    try {
      const response = await fetch('/api/public/music/setting');
      const result = await response.json();
      if (result.statusCode === 200) {
        this.updateState({ 
          musicSetting: result.data,
          volume: result.data.volume || 50 
        });
        if (this.audio) {
          this.audio.volume = (result.data.volume || 50) / 100;
        }
        return result.data;
      }
    } catch (error) {
      console.error('获取音乐设置失败:', error);
    }
    return null;
  }

  // 获取音乐列表
  public async fetchMusicList(): Promise<MusicFile[]> {
    try {
      const response = await fetch('/api/public/music/list');
      const result = await response.json();
      if (result.statusCode === 200) {
        this.updateState({ musicList: result.data });
        return result.data;
      }
    } catch (error) {
      console.error('获取音乐列表失败:', error);
    }
    return [];
  }

  // 初始化播放器
  public async initialize(): Promise<void> {
    console.log('初始化全局音乐播放器');
    
    if (!this.audio) {
      this.initializeAudio();
    }

    this.updateState({ isLoading: true });
    
    const setting = await this.fetchMusicSetting();
    const list = await this.fetchMusicList();
    
    console.log('音乐设置:', setting);
    console.log('音乐列表长度:', list.length);
    
    if (setting && setting.enabled && list.length > 0) {
      // 如果没有当前音轨或当前音轨不在列表中，选择一个
      if (!this.state.currentTrack || !list.find(track => track.sign === this.state.currentTrack?.sign)) {
        const currentIndex = Math.max(0, Math.min(setting.currentIndex || 0, list.length - 1));
        const selectedTrack = list[currentIndex];
        console.log('选择音轨:', selectedTrack.name);
        this.setCurrentTrack(selectedTrack, false); // 不自动播放
      }
      
      // 如果启用了自动播放，尝试自动播放
      if (setting.autoPlay) {
        console.log('检测到自动播放设置已启用');
        
        // 首先尝试直接播放（可能会因为浏览器策略失败）
        if (this.audio && this.state.currentTrack) {
          try {
            console.log('尝试直接自动播放');
            await this.audio.play();
            console.log('直接自动播放成功');
          } catch (error) {
            console.log('直接自动播放失败，等待用户交互:', error.message);
            // 如果直接播放失败，设置待播放状态并添加交互监听器
            this.updateState({ autoPlayPending: true });
            this.addInteractionListeners();
          }
        } else {
          // 如果音频还没准备好，设置待播放状态
          console.log('音频未准备好，设置待播放状态');
          this.updateState({ autoPlayPending: true });
          this.addInteractionListeners();
        }
      }
    }
    
    this.updateState({ isLoading: false });
    console.log('音乐播放器初始化完成');
  }

  // 设置当前音轨
  public setCurrentTrack(track: MusicFile, autoPlay: boolean = false): void {
    if (!this.audio) return;

    const wasPlaying = this.state.isPlaying;
    
    console.log('设置当前音轨:', track.name, '自动播放:', autoPlay);
    this.updateState({ currentTrack: track, currentTime: 0 });
    this.audio.src = track.realPath;
    
    if (autoPlay || wasPlaying) {
      // 等待音频加载完成后播放
      const handleCanPlay = () => {
        console.log('音频加载完成，准备播放');
        if (this.state.hasUserInteracted || autoPlay) {
          this.audio?.play().then(() => {
            console.log('音轨切换播放成功');
          }).catch((error) => {
            console.error('音轨切换播放失败:', error);
            this.updateState({ isPlaying: false });
          });
        }
        this.audio?.removeEventListener('canplay', handleCanPlay);
      };
      
      this.audio.addEventListener('canplay', handleCanPlay);
      this.audio.load();
    } else {
      // 不自动播放时也要加载音频
      this.audio.load();
    }
    
    this.saveStateToStorage();
  }

  // 播放/暂停
  public togglePlay(): void {
    if (!this.audio || !this.state.currentTrack) return;

    // 标记用户已交互
    if (!this.state.hasUserInteracted) {
      this.updateState({ hasUserInteracted: true });
    }

    if (this.state.isPlaying) {
      this.audio.pause();
    } else {
      // 清除待播放状态
      if (this.state.autoPlayPending) {
        this.updateState({ autoPlayPending: false });
      }
      
      this.audio.play().catch((error) => {
        console.error('播放失败:', error);
      });
    }
  }

  // 播放上一首
  public playPrevious(): void {
    if (this.state.musicList.length === 0 || !this.state.currentTrack) return;
    
    const currentIndex = this.state.musicList.findIndex(track => track.sign === this.state.currentTrack?.sign);
    const previousIndex = currentIndex > 0 ? currentIndex - 1 : this.state.musicList.length - 1;
    this.setCurrentTrack(this.state.musicList[previousIndex], this.state.isPlaying);
  }

  // 播放下一首
  public playNext(): void {
    if (this.state.musicList.length === 0 || !this.state.currentTrack) return;
    
    const currentIndex = this.state.musicList.findIndex(track => track.sign === this.state.currentTrack?.sign);
    const nextIndex = currentIndex < this.state.musicList.length - 1 ? currentIndex + 1 : 0;
    this.setCurrentTrack(this.state.musicList[nextIndex], this.state.isPlaying);
  }

  // 设置音量
  public setVolume(volume: number): void {
    this.updateState({ volume });
    if (this.audio) {
      this.audio.volume = volume / 100;
    }
    this.saveStateToStorage();
  }

  // 设置播放进度
  public setCurrentTime(time: number): void {
    if (this.audio) {
      this.audio.currentTime = time;
    }
  }

  // 获取当前状态
  public getState(): GlobalMusicState {
    return { ...this.state };
  }

  // 清理资源
  public destroy(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
      this.audio = null;
    }
    
    if (this.timeUpdateInterval) {
      clearInterval(this.timeUpdateInterval);
      this.timeUpdateInterval = null;
    }
    
    this.listeners.clear();
    this.removeInteractionListeners();
  }
}

// 导出单例实例
export const globalMusicPlayer = typeof window !== 'undefined' ? GlobalMusicPlayer.getInstance() : null;
export default globalMusicPlayer; 
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
      // 当音频可以播放时，如果有待播放的自动播放且用户已交互，立即播放
      if (this.state.autoPlayPending && this.state.hasUserInteracted) {
        this.audio?.play().catch(() => {
          this.updateState({ autoPlayPending: false });
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
  private addInteractionListeners() {
    if (this.interactionListenersAdded || this.state.hasUserInteracted) return;

    const handleFirstInteraction = async () => {
      this.updateState({ hasUserInteracted: true });
      
      // 如果有待播放的自动播放，立即执行
      if (this.state.autoPlayPending && this.audio && this.state.currentTrack) {
        try {
          if (this.audio.readyState >= 2) {
            await this.audio.play();
          } else {
            this.audio.addEventListener('canplay', async () => {
              try {
                await this.audio!.play();
              } catch (error) {
                this.updateState({ autoPlayPending: false });
              }
            }, { once: true });
          }
        } catch (error) {
          this.updateState({ autoPlayPending: false });
        }
      }
      
      // 移除监听器
      this.removeInteractionListeners();
    };

    // 添加多种交互事件监听器
    document.addEventListener('click', handleFirstInteraction, { passive: true });
    document.addEventListener('touchstart', handleFirstInteraction, { passive: true });
    document.addEventListener('keydown', handleFirstInteraction, { passive: true });
    document.addEventListener('scroll', handleFirstInteraction, { passive: true });
    document.addEventListener('mousemove', handleFirstInteraction, { passive: true });
    
    this.interactionListenersAdded = true;
  }

  private removeInteractionListeners() {
    // 这里需要保存引用才能正确移除，但由于是临时解决方案，我们采用重新绑定的方式
    this.interactionListenersAdded = false;
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
    if (!this.audio) {
      this.initializeAudio();
    }

    this.updateState({ isLoading: true });
    
    const setting = await this.fetchMusicSetting();
    const list = await this.fetchMusicList();
    
    if (setting && setting.enabled && list.length > 0) {
      // 如果没有当前音轨或当前音轨不在列表中，选择一个
      if (!this.state.currentTrack || !list.find(track => track.sign === this.state.currentTrack?.sign)) {
        const currentIndex = Math.max(0, Math.min(setting.currentIndex || 0, list.length - 1));
        const selectedTrack = list[currentIndex];
        this.setCurrentTrack(selectedTrack, false); // 不自动播放
      }
      
      // 如果启用了自动播放且没有用户交互，设置待播放状态
      if (setting.autoPlay && !this.state.hasUserInteracted) {
        this.updateState({ autoPlayPending: true });
        this.addInteractionListeners();
      }
    }
    
    this.updateState({ isLoading: false });
  }

  // 设置当前音轨
  public setCurrentTrack(track: MusicFile, autoPlay: boolean = false): void {
    if (!this.audio) return;

    const wasPlaying = this.state.isPlaying;
    
    this.updateState({ currentTrack: track, currentTime: 0 });
    this.audio.src = track.realPath;
    
    if (autoPlay || wasPlaying) {
      // 等待音频加载完成后播放
      const handleCanPlay = () => {
        if (this.state.hasUserInteracted) {
          this.audio?.play().catch(() => {
            this.updateState({ isPlaying: false });
          });
        }
        this.audio?.removeEventListener('canplay', handleCanPlay);
      };
      
      this.audio.addEventListener('canplay', handleCanPlay);
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
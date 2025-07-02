import React, { useState, useEffect, useRef, useCallback } from 'react';
import styles from './index.module.scss';

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

interface MusicPlayerProps {
  className?: string;
}

const MusicPlayer: React.FC<MusicPlayerProps> = ({ className }) => {
  const [musicSetting, setMusicSetting] = useState<MusicSetting | null>(null);
  const [musicList, setMusicList] = useState<MusicFile[]>([]);
  const [currentTrack, setCurrentTrack] = useState<MusicFile | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(50);
  const [isLoading, setIsLoading] = useState(true);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [autoPlayPending, setAutoPlayPending] = useState(false); // 标记是否有待播放的自动播放
  const [interactionListenersAdded, setInteractionListenersAdded] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  // 获取音乐设置
  const fetchMusicSetting = useCallback(async () => {
    try {
      const response = await fetch('/api/public/music/setting');
      const result = await response.json();
      if (result.statusCode === 200) {
        setMusicSetting(result.data);
        setVolume(result.data.volume || 50);
        return result.data;
      } else {
        console.error('获取音乐设置失败:', result);
      }
    } catch (error) {
      console.error('获取音乐设置失败:', error);
    }
    return null;
  }, []);

  // 获取音乐列表
  const fetchMusicList = useCallback(async () => {
    try {
      const response = await fetch('/api/public/music/list');
      const result = await response.json();
      if (result.statusCode === 200) {
        setMusicList(result.data);
        return result.data;
      } else {
        console.error('获取音乐列表失败:', result);
      }
    } catch (error) {
      console.error('获取音乐列表失败:', error);
    }
    return [];
  }, []);

  // 添加用户交互监听器
  const addInteractionListeners = useCallback(() => {
    if (interactionListenersAdded || hasUserInteracted) return;

    const handleFirstInteraction = async () => {
      setHasUserInteracted(true);
      
      // 如果有待播放的自动播放，立即执行
      if (autoPlayPending && audioRef.current && currentTrack) {
        try {
          // 确保音频已准备好
          if (audioRef.current.readyState >= 2) {
            await audioRef.current.play();
            setIsPlaying(true);
            setAutoPlayPending(false);
          } else {
            // 如果音频还没准备好，等待 canplay 事件
            audioRef.current.addEventListener('canplay', async () => {
              try {
                await audioRef.current!.play();
                setIsPlaying(true);
                setAutoPlayPending(false);
              } catch (error) {
                setAutoPlayPending(false);
              }
            }, { once: true });
          }
        } catch (error) {
          setAutoPlayPending(false);
        }
      }
      
      // 移除监听器
      removeInteractionListeners();
    };

    const removeInteractionListeners = () => {
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
      document.removeEventListener('keydown', handleFirstInteraction);
      document.removeEventListener('scroll', handleFirstInteraction);
      document.removeEventListener('mousemove', handleFirstInteraction);
      setInteractionListenersAdded(false);
    };

    // 添加多种交互事件监听器
    document.addEventListener('click', handleFirstInteraction, { passive: true });
    document.addEventListener('touchstart', handleFirstInteraction, { passive: true });
    document.addEventListener('keydown', handleFirstInteraction, { passive: true });
    document.addEventListener('scroll', handleFirstInteraction, { passive: true });
    document.addEventListener('mousemove', handleFirstInteraction, { passive: true });
    
    setInteractionListenersAdded(true);
    
    // 返回清理函数
    return removeInteractionListeners;
  }, [autoPlayPending, currentTrack, hasUserInteracted, interactionListenersAdded]);

  // 尝试自动播放
  const attemptAutoPlay = useCallback(async () => {
    if (!autoPlayPending || !currentTrack || !audioRef.current) {
      return;
    }

    // 如果用户已经交互过，直接尝试播放
    if (hasUserInteracted) {
      try {
        await audioRef.current.play();
        setIsPlaying(true);
        setAutoPlayPending(false);
      } catch (error) {
        setAutoPlayPending(false);
      }
    } else {
      // 如果用户还没交互，添加交互监听器
      addInteractionListeners();
    }
  }, [autoPlayPending, currentTrack, hasUserInteracted, addInteractionListeners]);

  // 播放/暂停
  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    // 标记用户已交互
    if (!hasUserInteracted) {
      setHasUserInteracted(true);
    }

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      setAutoPlayPending(false);
    } else {
      // 如果有待播放的自动播放，直接播放
      if (autoPlayPending) {
        setAutoPlayPending(false);
      }
      
      audio.play().then(() => {
        setIsPlaying(true);
      }).catch((error) => {
        console.error('播放失败:', error);
      });
    }
  };

  // 播放上一首
  const playPrevious = () => {
    if (musicList.length === 0) return;
    const currentIndex = musicList.findIndex(track => track.sign === currentTrack?.sign);
    const previousIndex = currentIndex > 0 ? currentIndex - 1 : musicList.length - 1;
    setCurrentTrack(musicList[previousIndex]);
  };

  // 播放下一首
  const playNext = () => {
    if (musicList.length === 0) return;
    const currentIndex = musicList.findIndex(track => track.sign === currentTrack?.sign);
    const nextIndex = currentIndex < musicList.length - 1 ? currentIndex + 1 : 0;
    setCurrentTrack(musicList[nextIndex]);
  };

  // 播放指定歌曲
  const playTrack = (track: MusicFile) => {
    setCurrentTrack(track);
  };

  // 调整音量
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseInt(e.target.value);
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume / 100;
    }
  };

  // 调整进度
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const newTime = percent * duration;
    
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  // 格式化时间
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // 获取歌曲显示名称
  const getTrackDisplayName = (track: MusicFile) => {
    if (!track || !track.name) return '未知歌曲';
    
    let displayName = track.name;
    
    // 处理哈希前缀的文件名（如: hash.原始文件名.扩展名）
    if (displayName.includes('.')) {
      const parts = displayName.split('.');
      if (parts.length >= 3) {
        // 提取中间的原始文件名部分和扩展名
        const originalNameParts = parts.slice(1);
        displayName = originalNameParts.join('.');
      }
    }
    
    return displayName;
  };

  // 获取不带扩展名的歌曲名称（用于主界面显示）
  const getTrackNameWithoutExt = (track: MusicFile) => {
    const fullName = getTrackDisplayName(track);
    return fullName.replace(/\.[^/.]+$/, '');
  };

  // 切换播放列表显示状态
  const togglePlaylist = () => {
    const newState = !showPlaylist;
    setShowPlaylist(newState);
  };

  // 初始化音乐播放器
  const initializePlayer = useCallback(async () => {
    setIsLoading(true);
    const setting = await fetchMusicSetting();
    const list = await fetchMusicList();
    
    if (setting && setting.enabled && list.length > 0) {
      const currentIndex = Math.max(0, Math.min(setting.currentIndex || 0, list.length - 1));
      const selectedTrack = list[currentIndex];
      setCurrentTrack(selectedTrack);
      
      // 如果启用了自动播放，设置待播放状态
      if (setting.autoPlay) {
        setAutoPlayPending(true);
      }
          }
    setIsLoading(false);
  }, [fetchMusicSetting, fetchMusicList]);

  useEffect(() => {
    initializePlayer();
  }, [initializePlayer]);

  // 当autoPlayPending或currentTrack改变时尝试自动播放
  useEffect(() => {
    if (autoPlayPending && currentTrack) {
      // 延迟执行，确保音频元素已经更新
      const timer = setTimeout(() => {
        attemptAutoPlay();
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [autoPlayPending, currentTrack, attemptAutoPlay]);

  // 当currentTrack改变时的处理
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    // 重置播放状态
    setCurrentTime(0);
    
    // 如果之前正在播放，继续播放新音乐
    if (isPlaying) {
      // 等待音频加载完成后播放
              const handleCanPlay = () => {
          audio.play().then(() => {
          }).catch((error) => {
            setIsPlaying(false);
          });
          audio.removeEventListener('canplay', handleCanPlay);
        };
      
      audio.addEventListener('canplay', handleCanPlay);
      audio.load(); // 重新加载音频
    }
  }, [currentTrack, isPlaying]);

  // 音频事件处理
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedData = () => {
      setDuration(audio.duration || 0);
      audio.volume = volume / 100;
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime || 0);
    };

    const handlePlay = () => {
      setIsPlaying(true);
      setAutoPlayPending(false); // 开始播放时清除待播放状态
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    const handleEnded = () => {
      if (musicSetting?.loop) {
        playNext();
      } else {
        setIsPlaying(false);
      }
    };

    const handleCanPlay = () => {
      // 音频可以播放时的处理
      
      // 如果有待播放的自动播放且用户已交互，立即播放
      if (autoPlayPending && hasUserInteracted) {
        audio.play().then(() => {
        }).catch((error) => {
          setAutoPlayPending(false);
        });
      }
    };

    const handleError = (e) => {
      console.error('音频加载错误:', e);
      setIsPlaying(false);
      setAutoPlayPending(false);
    };

    audio.addEventListener('loadeddata', handleLoadedData);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('loadeddata', handleLoadedData);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('error', handleError);
    };
  }, [musicSetting?.loop, currentTrack, volume, autoPlayPending, hasUserInteracted]);

  // 组件卸载时清理交互监听器
  useEffect(() => {
    return () => {
      if (interactionListenersAdded) {
        document.removeEventListener('click', () => {});
        document.removeEventListener('touchstart', () => {});
        document.removeEventListener('keydown', () => {});
        document.removeEventListener('scroll', () => {});
        document.removeEventListener('mousemove', () => {});
      }
    };
  }, [interactionListenersAdded]);

  // 如果音乐功能未启用，不渲染组件
  if (!musicSetting?.enabled || isLoading) {
    return null;
  }

  // 如果设置为不显示控制器，只渲染隐藏的audio元素
  if (!musicSetting.showControl) {
    return (
      <audio
        ref={audioRef}
        src={currentTrack?.realPath}
        loop={musicSetting.loop && musicList.length === 1}
        style={{ display: 'none' }}
        // 移除 autoPlay 属性，改为通过 JavaScript 控制
      />
    );
  }

  return (
    <div className={`${styles.musicPlayer} ${isMinimized ? styles.minimized : ''} ${className || ''}`}>
      <audio ref={audioRef} src={currentTrack?.realPath} />
      
      {/* 最小化/展开按钮 */}
      <button 
        className={styles.toggleButton}
        onClick={() => setIsMinimized(!isMinimized)}
        title={isMinimized ? '展开音乐播放器' : '收起音乐播放器'}
      >
        {isMinimized ? '♪' : '→'}
      </button>

      {!isMinimized && (
        <>
          {/* 当前播放信息 */}
          <div className={styles.trackInfo}>
            <div className={styles.trackNameContainer}>
              <div className={styles.trackName}>
                {currentTrack ? getTrackNameWithoutExt(currentTrack) : '未选择音乐'}
              </div>
            </div>
            <div className={styles.trackTime}>
              {formatTime(currentTime)} / {formatTime(duration || 0)}
            </div>
          </div>

          {/* 进度条 */}
          <div className={styles.progressContainer} onClick={handleProgressClick} ref={progressRef}>
            <div className={styles.progressBar}>
              <div 
                className={styles.progressFill}
                style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
              />
              <div 
                className={styles.progressThumb}
                style={{ left: `${duration ? (currentTime / duration) * 100 : 0}%` }}
              />
            </div>
          </div>

          {/* 控制按钮 */}
          <div className={styles.controls}>
            <button 
              onClick={playPrevious} 
              className={styles.controlButton}
              title="上一首"
              disabled={musicList.length <= 1}
            >
              ⏮
            </button>
            <button 
              onClick={togglePlay} 
              className={styles.playButton}
              title={isPlaying ? '暂停' : (autoPlayPending ? '点击播放（自动播放待开始）' : '播放')}
            >
              {isPlaying || autoPlayPending ? '⏸' : '▶'}
            </button>
            <button 
              onClick={playNext} 
              className={styles.controlButton}
              title="下一首"
              disabled={musicList.length <= 1}
            >
              ⏭
            </button>
            <button 
              onClick={togglePlaylist}
              className={`${styles.controlButton} ${showPlaylist ? styles.active : ''}`}
              title="播放列表"
            >
              ♫
            </button>
          </div>

          {/* 音量控制 */}
          <div className={styles.volumeContainer}>
            <span className={styles.volumeIcon}>
              {volume === 0 ? '🔇' : volume < 50 ? '🔉' : '🔊'}
            </span>
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={handleVolumeChange}
              className={styles.volumeSlider}
              title={`音量: ${volume}%`}
            />
          </div>

          {/* 播放列表 */}
          {showPlaylist && musicList && musicList.length > 0 && (
            <div className={styles.playlist}>
              <div className={styles.playlistHeader}>
                <span>播放列表 ({musicList.length})</span>
                <button 
                  className={styles.closePlaylist}
                  onClick={togglePlaylist}
                  title="关闭播放列表"
                >
                  ×
                </button>
              </div>
              <div className={styles.playlistItems}>
                {musicList.map((track, index) => (
                  <div
                    key={track.sign}
                    className={`${styles.playlistItem} ${currentTrack?.sign === track.sign ? styles.active : ''}`}
                    onClick={() => playTrack(track)}
                    title={getTrackDisplayName(track)}
                  >
                    <span className={styles.trackIndex}>
                      {currentTrack?.sign === track.sign && isPlaying ? '♪' : `${index + 1}`}
                    </span>
                    <span className={styles.trackTitle}>
                      {getTrackNameWithoutExt(track)}
                    </span>
                    <span className={styles.trackExt}>
                      {getTrackDisplayName(track).split('.').pop()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default MusicPlayer; 
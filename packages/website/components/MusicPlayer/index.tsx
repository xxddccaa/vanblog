import React, { useState, useEffect, useRef } from 'react';
import styles from './index.module.scss';
import globalMusicPlayer from './globalMusicPlayer';

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
  // 全局状态（通过订阅获得）
  const [musicSetting, setMusicSetting] = useState<MusicSetting | null>(null);
  const [musicList, setMusicList] = useState<MusicFile[]>([]);
  const [currentTrack, setCurrentTrack] = useState<MusicFile | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(50);
  const [isLoading, setIsLoading] = useState(true);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [autoPlayPending, setAutoPlayPending] = useState(false);
  
  // 本地UI状态
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  const progressRef = useRef<HTMLDivElement>(null);

  // 订阅全局音乐播放器状态
  useEffect(() => {
    if (!globalMusicPlayer) return;

    const unsubscribe = globalMusicPlayer.subscribe((state) => {
      setMusicSetting(state.musicSetting);
      setMusicList(state.musicList);
      setCurrentTrack(state.currentTrack);
      setIsPlaying(state.isPlaying);
      setCurrentTime(state.currentTime);
      setDuration(state.duration);
      setVolume(state.volume);
      setIsLoading(state.isLoading);
      setHasUserInteracted(state.hasUserInteracted);
      setAutoPlayPending(state.autoPlayPending);
    });

    // 初始化全局音乐播放器
    globalMusicPlayer.initialize();

    return unsubscribe;
  }, []);

  // 播放/暂停
  const togglePlay = () => {
    globalMusicPlayer?.togglePlay();
  };

  // 播放上一首
  const playPrevious = () => {
    globalMusicPlayer?.playPrevious();
  };

  // 播放下一首
  const playNext = () => {
    globalMusicPlayer?.playNext();
  };

  // 播放指定歌曲
  const playTrack = (track: MusicFile) => {
    globalMusicPlayer?.setCurrentTrack(track, true);
  };

  // 调整音量
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseInt(e.target.value);
    globalMusicPlayer?.setVolume(newVolume);
  };

  // 调整进度
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const newTime = percent * duration;
    
    globalMusicPlayer?.setCurrentTime(newTime);
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
    setShowPlaylist(!showPlaylist);
  };

  // 如果音乐功能未启用或正在加载，不渲染组件
  if (!musicSetting?.enabled || isLoading) {
    return null;
  }

  // 如果设置为不显示控制器，返回null（全局音乐播放器会处理音频播放）
  if (!musicSetting.showControl) {
    return null;
  }

  return (
    <div className={`${styles.musicPlayer} ${isMinimized ? styles.minimized : ''} ${className || ''}`}>
      
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
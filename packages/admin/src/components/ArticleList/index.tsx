import { getRecentTimeDes } from '@/services/van-blog/tool';
import { EyeOutlined, UserOutlined, ClockCircleOutlined } from '@ant-design/icons';
import './index.css';

export default ({
  articles,
  showViewerNum,
  showRecentViewTime,
}: {
  // FIXME: Add Article type
  articles: any[];
  showViewerNum: boolean;
  showRecentViewTime: boolean;
}) => (
  <div className="modern-article-list">
    {articles.map(({ id, title, viewer = 0, visited = 0, lastVisitedTime }, index) => (
      <div
        className="modern-article-item"
        key={id}
      >
        <div className="article-rank">
          <span className={`rank-number ${index < 3 ? 'top-three' : ''}`}>
            {index + 1}
          </span>
        </div>
        <div className="article-content">
          <a
            className="article-title"
            href={`/post/${id}`}
            target="_blank"
            rel="noreferrer"
          >
            {title}
          </a>
          <div className="article-meta">
            {showViewerNum && (
              <span className="meta-item">
                <EyeOutlined className="meta-icon" />
                {viewer}次访问
              </span>
            )}
            {showViewerNum && visited > 0 && (
              <span className="meta-item">
                <UserOutlined className="meta-icon" />
                {visited}位访客
              </span>
            )}
            {showRecentViewTime && (
              <span className="meta-item">
                <ClockCircleOutlined className="meta-icon" />
                {getRecentTimeDes(lastVisitedTime)}
              </span>
            )}
          </div>
        </div>
        <div className="article-indicator">
          <div 
            className="popularity-bar" 
            style={{ 
              width: `${Math.min(100, showViewerNum ? (viewer / 100) * 100 : 100)}%` 
            }}
          />
        </div>
      </div>
    ))}
  </div>
);

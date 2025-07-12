import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Modal, Input, Spin, Empty, Tag, message } from 'antd';
import { SearchOutlined, EyeOutlined, FileTextOutlined, FileOutlined } from '@ant-design/icons';
import { request } from 'umi';
import './index.less';

const { Search } = Input;

const ContentSearchModal = ({ 
  visible, 
  onCancel, 
  type = 'article', // 'article' or 'draft'
  onSelect 
}) => {
  const [searchValue, setSearchValue] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const debounceTimer = useRef(null);

  // 执行搜索
  const performSearch = useCallback(async (value) => {
    if (!value || value.trim() === '') {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const endpoint = type === 'article' ? '/api/admin/article/search' : '/api/admin/draft/search';
      const response = await request(endpoint, {
        method: 'GET',
        params: { value: value.trim() },
      });
      
      if (response.statusCode === 200) {
        setResults(response.data?.data || []);
      } else {
        message.error('搜索失败');
        setResults([]);
      }
    } catch (error) {
      console.error('搜索失败:', error);
      message.error('搜索失败');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [type]);

  // 防抖搜索
  const debouncedSearch = useCallback((value) => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    
    debounceTimer.current = setTimeout(() => {
      if (visible && value) {
        performSearch(value);
      } else {
        setResults([]);
      }
    }, 500);
  }, [visible, performSearch]);

  // 当搜索值变化时执行防抖搜索
  useEffect(() => {
    debouncedSearch(searchValue);
    
    // 清理函数
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [searchValue, debouncedSearch]);

  // 重置状态
  const resetState = () => {
    setSearchValue('');
    setResults([]);
    setLoading(false);
  };

  // 处理模态框关闭
  const handleCancel = () => {
    resetState();
    onCancel();
  };

  // 处理选择结果
  const handleSelect = (item) => {
    if (onSelect) {
      onSelect(item);
    }
    handleCancel();
  };

  // 处理输入变化
  const handleSearchChange = (e) => {
    setSearchValue(e.target.value);
  };

  // 渲染结果项
  const renderResultItem = (item) => {
    const Icon = type === 'article' ? FileTextOutlined : FileOutlined;
    
    return (
      <div 
        key={item.id}
        className="search-result-item"
        onClick={() => handleSelect(item)}
      >
        <Icon className="result-icon" />
        <span className="result-title">{item.title}</span>
        <span className="result-id">#{item.id}</span>
        {item.category && (
          <Tag size="small" color="blue" className="result-category">
            {item.category}
          </Tag>
        )}
        {item.viewer && (
          <span className="result-viewer">
            <EyeOutlined /> {item.viewer}
          </span>
        )}
      </div>
    );
  };

  return (
    <Modal
      title={
        <div className="search-modal-title">
          <SearchOutlined className="title-icon" />
          {type === 'article' ? '搜索文章内容' : '搜索草稿内容'}
        </div>
      }
      visible={visible}
      onCancel={handleCancel}
      footer={null}
      width={800}
      className="content-search-modal"
      destroyOnClose
      afterOpenChange={(open) => {
        if (open) {
          setTimeout(() => {
            inputRef.current?.focus();
          }, 100);
        }
      }}
    >
      <div className="search-modal-content">
        <div className="search-input-container">
          <Search
            ref={inputRef}
            placeholder={`输入关键词搜索${type === 'article' ? '文章' : '草稿'}内容、标题、分类或标签`}
            value={searchValue}
            onChange={handleSearchChange}
            size="large"
            className="search-input"
            allowClear
          />
        </div>
        
        <div className="search-results-container">
          {loading && (
            <div className="loading-container">
              <Spin size="large" />
              <div className="loading-text">搜索中...</div>
            </div>
          )}
          
          {!loading && searchValue && results.length === 0 && (
            <Empty
              description={`没有找到包含"${searchValue}"的${type === 'article' ? '文章' : '草稿'}`}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          )}
          
          {!loading && results.length > 0 && (
            <div className="results-header">
              找到 {results.length} 个结果
            </div>
          )}
          
          {!loading && results.length > 0 && (
            <div className="search-results-list">
              {results.map(renderResultItem)}
            </div>
          )}
          
          {!loading && !searchValue && (
            <div className="search-hint">
              <div className="hint-title">搜索提示</div>
              <ul className="hint-list">
                <li>输入关键词搜索{type === 'article' ? '文章' : '草稿'}内容</li>
                <li>支持搜索标题、内容、分类和标签</li>
                <li>点击搜索结果可快速跳转到编辑页面</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default ContentSearchModal; 
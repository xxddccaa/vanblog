import { useState, useRef, useCallback, useEffect } from 'react';
import { ProTable, ProForm, ProFormSwitch, ProFormDigit, ProFormSelect } from '@ant-design/pro-components';
import { Button, message, Modal, Upload, Card, Row, Col, Space, Switch, Slider, Divider } from 'antd';
import { UploadOutlined, PlayCircleOutlined, PauseCircleOutlined, DeleteOutlined, SoundOutlined } from '@ant-design/icons';
import { request } from 'umi';

export default function Music() {
  const [musicList, setMusicList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [musicSetting, setMusicSetting] = useState({});
  const [currentAudio, setCurrentAudio] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPlayingId, setCurrentPlayingId] = useState(null);
  const actionRef = useRef();

  // 获取音乐列表
  const fetchMusicList = useCallback(async (params = {}) => {
    try {
      const { current = 1, pageSize = 10 } = params;
      const response = await request('/api/admin/music', {
        method: 'GET',
        params: {
          page: current,
          pageSize,
        },
      });

      if (response.statusCode === 200) {
        // 调试：打印数据结构
        console.log('音乐列表API响应:', response.data);
        if (response.data.data && response.data.data.length > 0) {
          console.log('第一个音乐文件数据:', response.data.data[0]);
        }
        
        return {
          data: response.data.data || [],
          success: true,
          total: response.data.total || 0,
        };
      }
      return { data: [], success: false, total: 0 };
    } catch (error) {
      message.error('获取音乐列表失败：' + error.message);
      return { data: [], success: false, total: 0 };
    }
  }, []);

  // 获取音乐设置
  const fetchMusicSetting = useCallback(async () => {
    try {
      const response = await request('/api/admin/music/setting', {
        method: 'GET',
      });
      if (response.statusCode === 200) {
        setMusicSetting(response.data);
      }
    } catch (error) {
      message.error('获取音乐设置失败：' + error.message);
    }
  }, []);

  useEffect(() => {
    fetchMusicSetting();
  }, [fetchMusicSetting]);

  // 上传音乐文件
  const uploadProps = {
    name: 'file',
    action: '/api/admin/music/upload',
    headers: {
      token: localStorage.getItem('token') || '',
    },
    accept: '.mp3,.wav,.ogg,.m4a,.flac',
    showUploadList: false,
    onChange: (info) => {
      if (info.file.status === 'uploading') {
        setLoading(true);
      } else if (info.file.status === 'done') {
        setLoading(false);
        if (info.file.response?.statusCode === 200) {
          message.success('音乐文件上传成功！');
          actionRef.current?.reload();
        } else if (info.file.response?.statusCode === 409) {
          // 文件重复
          message.warning(info.file.response?.message || '文件已存在，请勿重复上传');
        } else {
          message.error(info.file.response?.message || '上传失败');
        }
      } else if (info.file.status === 'error') {
        setLoading(false);
        message.error('上传失败');
      }
    },
  };

  // 删除音乐文件
  const handleDelete = async (record) => {
    try {
      const response = await request(`/api/admin/music/${record.sign}`, {
        method: 'DELETE',
      });
      if (response.statusCode === 200) {
        message.success('删除成功');
        actionRef.current?.reload();
      } else {
        message.error(response.message || '删除失败');
      }
    } catch (error) {
      message.error('删除失败：' + error.message);
    }
  };

  // 播放/暂停音乐
  const handlePlayPause = (record) => {
    if (currentPlayingId === record.sign) {
      // 当前正在播放这首歌，暂停
      if (currentAudio) {
        if (isPlaying) {
          currentAudio.pause();
          setIsPlaying(false);
        } else {
          currentAudio.play();
          setIsPlaying(true);
        }
      }
    } else {
      // 播放新歌曲
      if (currentAudio) {
        currentAudio.pause();
      }
      
      const audio = new Audio(record.realPath);
      audio.volume = (musicSetting.volume || 50) / 100;
      
      audio.addEventListener('ended', () => {
        setIsPlaying(false);
        setCurrentPlayingId(null);
      });
      
      audio.play();
      setCurrentAudio(audio);
      setIsPlaying(true);
      setCurrentPlayingId(record.sign);
    }
  };

  // 更新音乐设置
  const updateMusicSetting = async (values) => {
    try {
      const response = await request('/api/admin/music/setting', {
        method: 'PUT',
        data: values,
      });
      if (response.statusCode === 200) {
        message.success('设置更新成功');
        setMusicSetting({ ...musicSetting, ...values });
      } else {
        message.error(response.message || '设置更新失败');
      }
    } catch (error) {
      message.error('设置更新失败：' + error.message);
    }
  };

  const columns = [
    {
      title: '音乐名称',
      dataIndex: 'name',
      ellipsis: true,
      render: (text, record) => {
        // 调试信息
        console.log('渲染音乐名称:', { text, record });
        
        // 简化处理逻辑
        if (!text || typeof text !== 'string') {
          // 如果name字段为空，尝试从其他字段获取
          const fallbackName = record.realPath?.split('/').pop() || record.sign || '未知文件';
          console.log('使用fallback名称:', fallbackName);
          return fallbackName;
        }
        
        // 如果name字段存在且有效，直接处理文件名
        let displayName = text;
        
        // 处理带哈希前缀的文件名：hash.原始文件名.扩展名
        if (displayName.includes('.')) {
          const parts = displayName.split('.');
          if (parts.length >= 3) {
            // 提取原始文件名（去掉前面的哈希和后面的扩展名）
            const originalNameParts = parts.slice(1, -1);
            if (originalNameParts.length > 0) {
              displayName = originalNameParts.join('.');
            }
          }
        }
        
        console.log('最终显示名称:', displayName);
        return displayName || text;
      },
    },
    {
      title: '文件大小',
      dataIndex: 'meta',
      render: (meta) => meta?.size || '-',
      width: 100,
    },
    {
      title: '上传时间',
      dataIndex: 'updatedAt',
      valueType: 'dateTime',
      width: 150,
    },
    {
      title: '操作',
      valueType: 'option',
      width: 150,
      render: (_, record) => [
        <Button
          key="play"
          type="text"
          size="small"
          icon={currentPlayingId === record.sign && isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
          onClick={() => handlePlayPause(record)}
        >
          {currentPlayingId === record.sign && isPlaying ? '暂停' : '播放'}
        </Button>,
        <Button
          key="delete"
          type="text"
          size="small"
          danger
          icon={<DeleteOutlined />}
          onClick={() => {
            console.log('删除按钮被点击:', record);
            Modal.confirm({
              title: '确认删除',
              content: `确定要删除音乐文件 "${record.name || '未知文件'}" 吗？`,
              onOk: () => {
                console.log('确认删除:', record.sign);
                handleDelete(record);
              },
            });
          }}
        >
          删除
        </Button>,
      ],
    },
  ];

  return (
    <div>
      {/* 音乐播放器设置 */}
      <Card title="音乐播放器设置" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={12}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <span style={{ marginRight: 8 }}>启用音乐功能：</span>
                <Switch
                  checked={musicSetting.enabled}
                  onChange={(checked) => updateMusicSetting({ enabled: checked })}
                />
              </div>
              <div>
                <span style={{ marginRight: 8 }}>显示音乐控制器：</span>
                <Switch
                  checked={musicSetting.showControl}
                  disabled={!musicSetting.enabled}
                  onChange={(checked) => updateMusicSetting({ showControl: checked })}
                />
              </div>
              <div>
                <span style={{ marginRight: 8 }}>自动播放：</span>
                <Switch
                  checked={musicSetting.autoPlay}
                  disabled={!musicSetting.enabled}
                  onChange={(checked) => updateMusicSetting({ autoPlay: checked })}
                />
              </div>
              <div>
                <span style={{ marginRight: 8 }}>循环播放：</span>
                <Switch
                  checked={musicSetting.loop}
                  disabled={!musicSetting.enabled}
                  onChange={(checked) => updateMusicSetting({ loop: checked })}
                />
              </div>
            </Space>
          </Col>
          <Col span={12}>
            <div>
              <div style={{ marginBottom: 8 }}>
                <SoundOutlined style={{ marginRight: 8 }} />
                音量: {musicSetting.volume || 50}%
              </div>
              <Slider
                min={0}
                max={100}
                value={musicSetting.volume || 50}
                disabled={!musicSetting.enabled}
                onChange={(value) => {
                  updateMusicSetting({ volume: value });
                  if (currentAudio) {
                    currentAudio.volume = value / 100;
                  }
                }}
              />
            </div>
          </Col>
        </Row>
        
        <Divider />
        
        <div style={{ color: '#666', fontSize: '14px' }}>
          <p><strong>功能说明：</strong></p>
          <ul>
            <li><strong>启用音乐功能：</strong>总开关，关闭后前端不会显示任何音乐相关功能</li>
            <li><strong>显示音乐控制器：</strong>控制前端是否显示音乐播放控制器，关闭后音乐会自动播放但用户无法控制</li>
            <li><strong>自动播放：</strong>页面加载后是否自动开始播放音乐</li>
            <li><strong>循环播放：</strong>播放列表结束后是否重新开始播放</li>
          </ul>
        </div>
      </Card>

      {/* 音乐文件管理 */}
      <Card title="音乐文件管理">
        <ProTable
          rowKey="sign"
          columns={columns}
          request={fetchMusicList}
          actionRef={actionRef}
          search={false}
          options={{
            reload: true,
            density: true,
            setting: true,
          }}
          pagination={{
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => 
              `第 ${range[0]}-${range[1]} 条/总共 ${total} 条`,
            pageSizeOptions: ['10', '20', '50'],
            defaultPageSize: 10,
          }}
          toolBarRender={() => [
            <Upload key="upload" {...uploadProps}>
              <Button type="primary" icon={<UploadOutlined />} loading={loading}>
                上传音乐文件
              </Button>
            </Upload>,
          ]}
          scroll={{ x: 'max-content' }}
        />
      </Card>
    </div>
  );
} 
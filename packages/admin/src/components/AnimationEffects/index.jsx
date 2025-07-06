import React from 'react';
import { Card, Switch, Slider, InputNumber, Space, Row, Col, Input } from 'antd';

const AnimationEffects = ({ value = {}, onChange }) => {
  const handleChange = (field, newValue) => {
    const newConfig = {
      ...value,
      [field]: newValue,
    };
    
    // 自动启用总开关：如果任何子动画启用了，就启用总开关
    const hasAnyAnimationEnabled = 
      newConfig.snowflake?.enabled || 
      newConfig.particles?.enabled || 
      newConfig.heartClick?.enabled ||
      newConfig.mouseDrag?.enabled;
    
    newConfig.enabled = hasAnyAnimationEnabled;
    
    onChange(newConfig);
  };

  const handleSnowflakeChange = (field, newValue) => {
    handleChange('snowflake', {
      ...value.snowflake,
      [field]: newValue,
    });
  };

  const handleParticleChange = (field, newValue) => {
    handleChange('particles', {
      ...value.particles,
      [field]: newValue,
    });
  };

  const handleHeartClickChange = (field, newValue) => {
    handleChange('heartClick', {
      ...value.heartClick,
      [field]: newValue,
    });
  };

  const handleMouseDragChange = (field, newValue) => {
    handleChange('mouseDrag', {
      ...value.mouseDrag,
      [field]: newValue,
    });
  };

  // Simple color input component
  const ColorInput = ({ value: colorValue, onChange: onColorChange, label }) => (
    <Space>
      <span style={{ minWidth: '80px' }}>{label}:</span>
      <Input
        type="color"
        value={colorValue || '#ffffff'}
        onChange={(e) => onColorChange(e.target.value)}
        style={{ width: '60px', height: '32px', padding: '4px' }}
      />
      <Input
        value={colorValue || '#ffffff'}
        onChange={(e) => onColorChange(e.target.value)}
        placeholder="#ffffff"
        style={{ width: '100px' }}
      />
    </Space>
  );

  return (
    <div>
      {/* 鼠标拖动特效 */}
      <Card title="🌟 鼠标拖动特效" style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Space align="center">
              <span style={{ minWidth: '80px' }}>启用拖动特效:</span>
              <Switch
                checked={value.mouseDrag?.enabled || false}
                onChange={(checked) => handleMouseDragChange('enabled', checked)}
              />
            </Space>
          </Col>
          
          {value.mouseDrag?.enabled && (
            <>
              <Col span={24}>
                <ColorInput
                  label="粒子颜色"
                  value={value.mouseDrag?.darkColor || '#ffffff'}
                  onChange={(color) => handleMouseDragChange('darkColor', color)}
                />
              </Col>
              
              <Col span={12}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <span>粒子数量: {value.mouseDrag?.particleCount || 30}</span>
                  <Slider
                    min={100}
                    max={1000000}
                    value={value.mouseDrag?.particleCount || 30}
                    onChange={(val) => handleMouseDragChange('particleCount', val)}
                  />
                </Space>
              </Col>
              
              <Col span={12}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <span>粒子大小: {value.mouseDrag?.particleSize || 2}</span>
                  <Slider
                    min={1}
                    max={5}
                    step={0.5}
                    value={value.mouseDrag?.particleSize || 2}
                    onChange={(val) => handleMouseDragChange('particleSize', val)}
                  />
                </Space>
              </Col>
              
              <Col span={12}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <span>拖尾长度: {value.mouseDrag?.trailLength || 20}</span>
                  <Slider
                    min={5}
                    max={50}
                    value={value.mouseDrag?.trailLength || 20}
                    onChange={(val) => handleMouseDragChange('trailLength', val)}
                  />
                </Space>
              </Col>
              
              <Col span={12}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <span>运动速度: {value.mouseDrag?.speed || 1}</span>
                  <Slider
                    min={0.1}
                    max={3}
                    step={0.1}
                    value={value.mouseDrag?.speed || 1}
                    onChange={(val) => handleMouseDragChange('speed', val)}
                  />
                </Space>
              </Col>
              
              <Col span={12}>
                <Space align="center">
                  <span style={{ minWidth: '80px' }}>透明度:</span>
                  <InputNumber
                    min={0.1}
                    max={1}
                    step={0.1}
                    value={value.mouseDrag?.opacity || 0.8}
                    onChange={(val) => handleMouseDragChange('opacity', val)}
                    style={{ width: '100px' }}
                  />
                </Space>
              </Col>
              
              <Col span={12}>
                <Space align="center">
                  <span style={{ minWidth: '80px' }}>发射强度:</span>
                  <InputNumber
                    min={1}
                    max={10}
                    value={value.mouseDrag?.intensity || 3}
                    onChange={(val) => handleMouseDragChange('intensity', val)}
                    style={{ width: '100px' }}
                  />
                </Space>
              </Col>
            </>
          )}
        </Row>
      </Card>

      {/* 雪花动画 */}
      <Card title="❄️ 雪花动画" style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Space align="center">
              <span style={{ minWidth: '80px' }}>启用雪花:</span>
              <Switch
                checked={value.snowflake?.enabled || false}
                onChange={(checked) => handleSnowflakeChange('enabled', checked)}
              />
            </Space>
          </Col>
          
          {value.snowflake?.enabled && (
            <>
              <Col span={24}>
                <ColorInput
                  label="雪花颜色"
                  value={value.snowflake?.color}
                  onChange={(color) => handleSnowflakeChange('color', color)}
                />
              </Col>
              
              <Col span={12}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <span>数量: {value.snowflake?.count || 100}</span>
                  <Slider
                    min={50}
                    max={200}
                    value={value.snowflake?.count || 100}
                    onChange={(val) => handleSnowflakeChange('count', val)}
                  />
                </Space>
              </Col>
              
              <Col span={12}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <span>速度: {value.snowflake?.speed || 1}</span>
                  <Slider
                    min={0.5}
                    max={3}
                    step={0.1}
                    value={value.snowflake?.speed || 1}
                    onChange={(val) => handleSnowflakeChange('speed', val)}
                  />
                </Space>
              </Col>
              
              <Col span={12}>
                <Space align="center">
                  <span style={{ minWidth: '60px' }}>大小:</span>
                  <InputNumber
                    min={0.3}
                    max={1.5}
                    step={0.1}
                    value={value.snowflake?.size || 1}
                    onChange={(val) => handleSnowflakeChange('size', val)}
                    style={{ width: '100px' }}
                  />
                </Space>
              </Col>
            </>
          )}
        </Row>
      </Card>

      {/* 粒子连线动画 */}
      <Card title="🔗 粒子连线动画" style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Space align="center">
              <span style={{ minWidth: '80px' }}>启用粒子:</span>
              <Switch
                checked={value.particles?.enabled || false}
                onChange={(checked) => handleParticleChange('enabled', checked)}
              />
            </Space>
          </Col>
          
          {value.particles?.enabled && (
            <>
              <Col span={12}>
                <ColorInput
                  label="粒子颜色(亮色主题)"
                  value={value.particles?.color}
                  onChange={(color) => handleParticleChange('color', color)}
                />
              </Col>
              
              <Col span={12}>
                <ColorInput
                  label="粒子颜色(暗色主题)"
                  value={value.particles?.darkColor}
                  onChange={(color) => handleParticleChange('darkColor', color)}
                />
              </Col>
              
              <Col span={12}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <span>粒子数量: {value.particles?.count || 99}</span>
                  <Slider
                    min={50}
                    max={200}
                    value={value.particles?.count || 99}
                    onChange={(val) => handleParticleChange('count', val)}
                  />
                </Space>
              </Col>
              
              <Col span={12}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <span>透明度: {value.particles?.opacity || 0.5}</span>
                  <Slider
                    min={0.1}
                    max={1.0}
                    step={0.1}
                    value={value.particles?.opacity || 0.5}
                    onChange={(val) => handleParticleChange('opacity', val)}
                  />
                </Space>
              </Col>
              
              <Col span={12}>
                <Space align="center">
                  <span style={{ minWidth: '80px' }}>层级 (z-index):</span>
                  <InputNumber
                    min={-10}
                    max={10}
                    value={value.particles?.zIndex || -1}
                    onChange={(val) => handleParticleChange('zIndex', val)}
                    style={{ width: '100px' }}
                  />
                </Space>
              </Col>
            </>
          )}
        </Row>
      </Card>

      {/* 心形点击爆炸动画 */}
      <Card title="💖 心形点击爆炸" style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Space align="center">
              <span style={{ minWidth: '80px' }}>启用心形:</span>
              <Switch
                checked={value.heartClick?.enabled || false}
                onChange={(checked) => handleHeartClickChange('enabled', checked)}
              />
            </Space>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default AnimationEffects; 
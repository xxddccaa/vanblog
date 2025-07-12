import React, { useState } from 'react';
import { Modal, Form, Select, message } from 'antd';
import { convertDocumentToDraft, getAllCategories } from '@/services/van-blog/api';

const ConvertToDraftModal = ({ visible, onCancel, onOk, document }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);

  // 获取分类列表
  const fetchCategories = async () => {
    try {
      const { data } = await getAllCategories();
      setCategories(data || []);
    } catch (error) {
      message.error('获取分类失败');
    }
  };

  // 模态框显示时获取分类
  const handleModalOpen = () => {
    if (visible) {
      fetchCategories();
    }
  };

  React.useEffect(() => {
    handleModalOpen();
  }, [visible]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      
      await convertDocumentToDraft(document.id, values.category);
      message.success('转换成功！');
      
      form.resetFields();
      onOk && onOk();
    } catch (error) {
      if (error.errorFields) {
        // 表单验证错误
        return;
      }
      message.error(error.message || '转换失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onCancel && onCancel();
  };

  return (
    <Modal
      title="转换为草稿"
      open={visible}
      onOk={handleSubmit}
      onCancel={handleCancel}
      confirmLoading={loading}
      destroyOnClose
    >
      <div style={{ marginBottom: '16px' }}>
        <p>将文档 <strong>"{document?.title}"</strong> 转换为草稿？</p>
        <p style={{ color: '#666', fontSize: '14px' }}>
          转换后，原文档将被删除，内容将作为草稿保存。
        </p>
      </div>
      
      <Form form={form} layout="vertical">
        <Form.Item
          name="category"
          label="选择分类"
          rules={[{ required: true, message: '请选择分类' }]}
        >
          <Select 
            placeholder="请选择草稿分类"
            showSearch
            optionFilterProp="children"
            filterOption={(input, option) =>
              option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
            }
          >
            {categories.map(category => (
              <Select.Option key={category} value={category}>
                {category}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ConvertToDraftModal; 
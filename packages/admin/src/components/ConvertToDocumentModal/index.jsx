import React, { useState } from 'react';
import { Modal, Form, Select, message } from 'antd';
import { convertDraftToDocument, getLibraries } from '@/services/van-blog/api';

const ConvertToDocumentModal = ({ visible, onCancel, onOk, draft }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [libraries, setLibraries] = useState([]);

  // 获取文档库列表
  const fetchLibraries = async () => {
    try {
      const { data } = await getLibraries();
      setLibraries(data || []);
    } catch (error) {
      message.error('获取文档库失败');
    }
  };

  // 模态框显示时获取数据
  const handleModalOpen = () => {
    if (visible) {
      fetchLibraries();
    }
  };

  React.useEffect(() => {
    handleModalOpen();
  }, [visible]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      
      await convertDraftToDocument(draft.id, values.libraryId);
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
      title="转换为文档"
      open={visible}
      onOk={handleSubmit}
      onCancel={handleCancel}
      confirmLoading={loading}
      destroyOnClose
    >
      <div style={{ marginBottom: '16px' }}>
        <p>将草稿 <strong>"{draft?.title}"</strong> 转换为文档？</p>
        <p style={{ color: '#666', fontSize: '14px' }}>
          转换后，原草稿将被删除，内容将作为文档保存到指定的文档库根目录下。
        </p>
      </div>
      
      <Form form={form} layout="vertical">
        <Form.Item
          name="libraryId"
          label="选择文档库"
          rules={[{ required: true, message: '请选择文档库' }]}
        >
          <Select 
            placeholder="请选择目标文档库"
            showSearch
            optionFilterProp="children"
            filterOption={(input, option) =>
              option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
            }
          >
            {libraries.map(library => (
              <Select.Option key={library.id} value={library.id}>
                {library.title}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ConvertToDocumentModal; 
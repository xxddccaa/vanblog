import { useState, useEffect } from 'react';
import { Modal, Form, Input, message } from 'antd';
import { updateLibrary } from '@/services/van-blog/api';

const { TextArea } = Input;

export default function EditLibraryModal(props) {
  const { visible, onCancel, library, onFinish } = props;
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && library) {
      form.setFieldsValue({
        title: library.title,
        content: library.content || '',
      });
    }
  }, [visible, library, form]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      
      await updateLibrary(library.id, {
        title: values.title,
        content: values.content,
      });
      
      message.success('文档库信息已更新');
      onFinish?.();
      onCancel?.();
    } catch (error) {
      message.error('更新失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onCancel?.();
  };

  return (
    <Modal
      title="编辑文档库信息"
      open={visible}
      onOk={handleOk}
      onCancel={handleCancel}
      confirmLoading={loading}
      width={600}
    >
      <Form
        form={form}
        layout="vertical"
        preserve={false}
      >
        <Form.Item
          label="文档库名称"
          name="title"
          rules={[{ required: true, message: '请输入文档库名称' }]}
        >
          <Input placeholder="请输入文档库名称" />
        </Form.Item>
        <Form.Item
          label="文档库描述"
          name="content"
        >
          <TextArea 
            placeholder="请输入文档库描述" 
            rows={4}
            showCount
            maxLength={500}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
} 
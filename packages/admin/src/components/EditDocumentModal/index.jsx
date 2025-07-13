import { useState, useEffect } from 'react';
import { Modal, Form, Input, message } from 'antd';
import { updateDocument } from '@/services/van-blog/api';

export default function EditDocumentModal(props) {
  const { visible, onCancel, document, onFinish } = props;
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && document) {
      form.setFieldsValue({
        title: document.title,
      });
    }
  }, [visible, document, form]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      
      await updateDocument(document.id, {
        title: values.title,
      });
      
      message.success('文档信息已更新');
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
      title="编辑文档信息"
      open={visible}
      onOk={handleOk}
      onCancel={handleCancel}
      confirmLoading={loading}
      width={500}
    >
      <Form
        form={form}
        layout="vertical"
        preserve={false}
      >
        <Form.Item
          label="文档标题"
          name="title"
          rules={[{ required: true, message: '请输入文档标题' }]}
        >
          <Input placeholder="请输入文档标题" />
        </Form.Item>
      </Form>
    </Modal>
  );
} 
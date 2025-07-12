import { createDocument } from '@/services/van-blog/api';
import {
  ModalForm,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { Button } from 'antd';

export default function NewDocumentModal(props) {
  const { onFinish, libraries = [], parentId, libraryId, type = 'document' } = props;

  const isLibrary = type === 'library';

  return (
    <ModalForm
      title={isLibrary ? '新建文档库' : '新建文档'}
      trigger={
        <Button key="button" type="primary">
          {isLibrary ? '新建文档库' : '新建文档'}
        </Button>
      }
      width={450}
      autoFocusFirstInput
      submitTimeout={3000}
      onFinish={async (values) => {
        try {
          const createData = {
            title: values.title,
            content: values.content || '',
            type,
            parent_id: parentId || null,
            library_id: isLibrary ? null : (values.library_id || libraryId || null),
          };

          const { data } = await createDocument(createData);
          if (onFinish) {
            await onFinish(data);
          }
          return true;
        } catch (error) {
          console.error('创建失败:', error);
          return false;
        }
      }}
      layout="horizontal"
      labelCol={{ span: 6 }}
    >
      <ProFormText
        name="title"
        label={isLibrary ? '文档库名称' : '文档标题'}
        placeholder={isLibrary ? '请输入文档库名称' : '请输入文档标题'}
        rules={[{ required: true, message: `请输入${isLibrary ? '文档库名称' : '文档标题'}` }]}
      />
      
      {!isLibrary && (
        <ProFormSelect
          name="library_id"
          label="所属文档库"
          options={libraries.map(lib => ({ label: lib.title, value: lib.id }))}
          placeholder="请选择文档库"
          rules={[{ required: true, message: '请选择文档库' }]}
          initialValue={libraryId}
        />
      )}

      <ProFormTextArea
        name="content"
        label="初始内容"
        placeholder={isLibrary ? '请输入文档库描述' : '请输入文档初始内容'}
        fieldProps={{
          rows: 4,
        }}
      />
    </ModalForm>
  );
} 
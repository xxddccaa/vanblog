import {
  getCommentSetting,
  sendCommentTestMail,
  updateCommentSetting,
} from '@/services/van-blog/api';
import {
  buildGeneralSettingBody,
  buildNotifySettingBody,
  COMMENT_LIMITS,
  COMMENT_MODERATION_OPTIONS,
  commentSettingToGeneralValues,
  commentSettingToNotifyValues,
  formatCommentError,
  isSmtpPasswordSet,
  isValidCommentEmail,
  unwrapCommentResponse,
  validateEmailOrEmpty,
  validateForbiddenWords,
  validateFromName,
  validateMaxLength,
  validatePageSize,
  validateSmtpHost,
  validateSmtpPass,
  validateSmtpPort,
  validateSmtpRequirements,
  validateSmtpUser,
  validateWebhook,
} from '@/services/van-blog/comment';
import type { AdminCommentSetting } from '@/services/van-blog/comment';
import {
  ProForm,
  ProFormDigit,
  ProFormSelect,
  ProFormSwitch,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import type { ProFormInstance } from '@ant-design/pro-components';
import { Button, Divider, Input, message, Modal, Space, Typography } from 'antd';
import { useRef, useState } from 'react';

const DEMO_HOSTNAME = 'blog-demo.mereith.com';

const isDemoSite = () =>
  typeof window !== 'undefined' && window.location.hostname === DEMO_HOSTNAME;

/** Wraps a validator returning '' or a message into an antd rule. */
const rule = (validate: (value: unknown) => string) => ({
  validator: async (_: unknown, value: unknown) => {
    const error = validate(value);
    if (error) throw new Error(error);
  },
});

const loadSetting = async (): Promise<AdminCommentSetting | null> => {
  try {
    return unwrapCommentResponse<AdminCommentSetting>(await getCommentSetting());
  } catch (error) {
    message.error(formatCommentError(error, '读取评论设置失败'));
    return null;
  }
};

const saveSetting = async (body: unknown): Promise<AdminCommentSetting | null> => {
  if (isDemoSite()) {
    Modal.info({ title: '演示站禁止修改评论设置！' });
    return null;
  }
  try {
    const data = unwrapCommentResponse<AdminCommentSetting>(await updateCommentSetting(body));
    message.success('更新成功！');
    return data;
  } catch (error) {
    message.error(formatCommentError(error, '保存失败'));
    return null;
  }
};

export function CommentGeneralForm() {
  return (
    <ProForm
      grid={true}
      layout={'horizontal'}
      labelCol={{ span: 6 }}
      request={async () => commentSettingToGeneralValues(await loadSetting())}
      syncToInitialValues={true}
      onFinish={async (values) => {
        const saved = await saveSetting(buildGeneralSettingBody(values));
        return Boolean(saved);
      }}
    >
      <ProFormSelect
        name="moderation"
        label="审核策略"
        options={COMMENT_MODERATION_OPTIONS}
        allowClear={false}
        rules={[{ required: true, message: '这是必填项' }]}
        tooltip="全部先审：所有访客评论都要审核后才显示；只审可疑：包含多个链接、大量重复字符或访客图片的评论需要审核；不审：除命中违禁词外直接显示。博主本人的评论不需要审核。"
      />
      <ProFormTextArea
        name="forbiddenWords"
        label="违禁词"
        placeholder="每行一个，命中后评论会直接进入垃圾评论"
        tooltip={`不区分大小写，最多 ${COMMENT_LIMITS.forbiddenWordsMax} 个，每个不超过 ${COMMENT_LIMITS.forbiddenWordMaxLength} 个字符`}
        fieldProps={{ autoSize: { minRows: 4, maxRows: 12 } }}
        rules={[rule(validateForbiddenWords)]}
      />
      <ProFormDigit
        name="pageSize"
        label="每页条数"
        tooltip="前台每页显示的顶层评论数"
        min={COMMENT_LIMITS.pageSizeMin}
        max={COMMENT_LIMITS.pageSizeMax}
        fieldProps={{ precision: 0 }}
        rules={[{ required: true, message: '这是必填项' }, rule(validatePageSize)]}
      />
      <ProFormDigit
        name="maxLength"
        label="字数上限"
        tooltip="单条评论允许的最大字符数"
        min={COMMENT_LIMITS.contentMinMaxLength}
        max={COMMENT_LIMITS.contentHardMaxLength}
        fieldProps={{ precision: 0 }}
        rules={[{ required: true, message: '这是必填项' }, rule(validateMaxLength)]}
      />
      <ProFormSwitch
        name="allowVisitorImage"
        label="访客上传图片"
        tooltip="关闭后访客无法在评论中上传图片"
      />
      <ProFormSwitch name="requireMail" label="邮箱必填" tooltip="开启后访客必须填写邮箱才能评论" />
      <ProFormSwitch name="showLocation" label="显示归属地" tooltip="在前台评论中显示省级归属地" />
      <ProFormSwitch name="showBrowser" label="显示浏览器" />
      <ProFormSwitch name="showOs" label="显示操作系统" />
    </ProForm>
  );
}

const TestMailButton = ({ defaultTo }: { defaultTo: () => string }) => {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState('');
  const [sending, setSending] = useState(false);

  const send = async () => {
    const address = to.trim();
    if (!isValidCommentEmail(address)) {
      message.warning('请输入正确的邮箱地址');
      return;
    }
    if (isDemoSite()) {
      Modal.info({ title: '演示站禁止发送测试邮件！' });
      return;
    }
    setSending(true);
    try {
      unwrapCommentResponse(await sendCommentTestMail(address));
      message.success('测试邮件已发送，请检查收件箱');
      setOpen(false);
    } catch (error) {
      message.error(formatCommentError(error, '发送失败'));
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Button
        onClick={() => {
          setTo(defaultTo());
          setOpen(true);
        }}
      >
        发送测试邮件
      </Button>
      <Modal
        open={open}
        title="发送测试邮件"
        okText="发送"
        cancelText="取消"
        confirmLoading={sending}
        onOk={send}
        onCancel={() => {
          if (!sending) setOpen(false);
        }}
        destroyOnClose
      >
        <Typography.Paragraph type="secondary">
          使用已保存的 SMTP 设置发送；修改设置后请先保存再测试。
        </Typography.Paragraph>
        <Input
          value={to}
          onChange={(event) => setTo(event.target.value)}
          placeholder="收件邮箱"
          maxLength={COMMENT_LIMITS.mailMaxLength}
          onPressEnter={send}
        />
      </Modal>
    </>
  );
};

export function CommentNotifyForm() {
  const formRef = useRef<ProFormInstance>();
  const [passSet, setPassSet] = useState(false);
  const [clearPassword, setClearPassword] = useState(false);

  const applySetting = (setting: AdminCommentSetting | null) => {
    setPassSet(isSmtpPasswordSet(setting));
    setClearPassword(false);
    return commentSettingToNotifyValues(setting);
  };

  const passPlaceholder = clearPassword
    ? '保存后将清除已保存的密码'
    : passSet
      ? '已设置，留空则不修改'
      : '未设置';

  const passExtra = clearPassword ? (
    <Space size={8}>
      <Typography.Text type="warning">保存后将清除已保存的 SMTP 密码</Typography.Text>
      <a onClick={() => setClearPassword(false)}>撤销</a>
    </Space>
  ) : passSet ? (
    <a
      onClick={() => {
        setClearPassword(true);
        formRef.current?.setFieldsValue({ smtpPass: '' });
      }}
    >
      清除密码
    </a>
  ) : null;

  return (
    <ProForm
      formRef={formRef}
      grid={true}
      layout={'horizontal'}
      labelCol={{ span: 6 }}
      autoComplete="off"
      request={async () => applySetting(await loadSetting())}
      syncToInitialValues={true}
      onFinish={async (values) => {
        const saved = await saveSetting(buildNotifySettingBody(values, { clearPassword }));
        if (!saved) return false;
        formRef.current?.setFieldsValue(applySetting(saved));
        return true;
      }}
      submitter={{
        render: (_, dom) => (
          <Space wrap>
            {dom}
            <TestMailButton
              defaultTo={() => String(formRef.current?.getFieldValue('ownerEmail') || '')}
            />
          </Space>
        ),
      }}
    >
      <ProFormText
        name="ownerEmail"
        label="博主邮箱"
        placeholder="接收新评论通知的邮箱"
        tooltip="接收新评论通知，同时作为 RSS 中的作者邮箱"
        rules={[rule(validateEmailOrEmpty)]}
      />
      <ProFormSwitch
        name="notifyOwner"
        label="新评论通知博主"
        tooltip="访客发表评论后发邮件给博主，邮件中会注明是否待审核"
      />
      <ProFormSwitch
        name="notifyReply"
        label="回复通知被回复者"
        tooltip="评论被回复且回复已通过审核时，通知留了邮箱的被回复者"
      />
      <ProFormText
        name="webhook"
        label="Webhook 地址"
        placeholder="留空表示不启用"
        tooltip="有新评论时向此地址 POST 一条 JSON，5 秒超时，不重试"
        rules={[rule(validateWebhook)]}
      />
      <Divider orientation="left" plain>
        SMTP 发信
      </Divider>
      <ProFormSwitch name="smtpEnabled" label="启用邮件通知" tooltip="关闭后不会发送任何评论邮件" />
      <ProFormText
        name="smtpHost"
        label="SMTP 主机"
        placeholder="例如 smtp.example.com"
        dependencies={['smtpEnabled']}
        rules={[
          rule(validateSmtpHost),
          ({ getFieldsValue }) => ({
            validator: async () => {
              const error = validateSmtpRequirements(getFieldsValue()).smtpHost;
              if (error) throw new Error(error);
            },
          }),
        ]}
      />
      <ProFormDigit
        name="smtpPort"
        label="SMTP 端口"
        min={1}
        max={65535}
        fieldProps={{ precision: 0 }}
        rules={[{ required: true, message: '这是必填项' }, rule(validateSmtpPort)]}
      />
      <ProFormSwitch
        name="smtpSecure"
        label="SSL/TLS"
        tooltip="465 端口一般开启；587 端口（STARTTLS）请关闭"
      />
      <ProFormText
        name="smtpUser"
        label="SMTP 用户名"
        placeholder="通常是邮箱地址"
        fieldProps={{ autoComplete: 'off' }}
        rules={[rule(validateSmtpUser)]}
      />
      <ProFormText.Password
        name="smtpPass"
        label="SMTP 密码"
        placeholder={passPlaceholder}
        tooltip="密码只写不读：保存后不会再显示"
        extra={passExtra}
        fieldProps={{ autoComplete: 'new-password', disabled: clearPassword }}
        rules={[rule(validateSmtpPass)]}
      />
      <ProFormText
        name="smtpFromName"
        label="发件人名称"
        placeholder="可选，显示在邮件发件人处"
        rules={[rule(validateFromName)]}
      />
      <ProFormText
        name="smtpFromEmail"
        label="发件人邮箱"
        placeholder="留空使用 SMTP 用户名"
        dependencies={['smtpEnabled', 'smtpUser']}
        rules={[
          rule(validateEmailOrEmpty),
          ({ getFieldsValue }) => ({
            validator: async () => {
              const error = validateSmtpRequirements(getFieldsValue()).smtpFromEmail;
              if (error) throw new Error(error);
            },
          }),
        ]}
      />
    </ProForm>
  );
}

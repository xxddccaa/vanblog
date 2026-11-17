import { CommentGeneralForm, CommentNotifyForm } from '@/components/CommentSettingForm';
import { history } from '@umijs/max';
import { Alert, Card } from 'antd';

export default function () {
  return (
    <>
      <Card title="评论设置">
        <Alert
          type="info"
          message={
            <span>
              评论区总开关在“站点配置 / 高级设置”中；
              <a onClick={() => history.push('/site/comment')}>前往评论管理</a>
            </span>
          }
          style={{ marginBottom: 20 }}
        />
        <CommentGeneralForm />
      </Card>
      <Card title="通知设置" style={{ marginTop: 8 }}>
        <CommentNotifyForm />
      </Card>
    </>
  );
}

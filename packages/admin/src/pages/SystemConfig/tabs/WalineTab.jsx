import WalineForm from '@/components/WalineForm';
import { Alert, Card } from 'antd';

export default function () {
  return (
    <>
      <Card title="评论设置">
        <Alert
          type="info"
          message={
            <div>
              <p>
                <span>本表单可以控制内嵌 waline 评论系统的配置。</span>
              </p>
            </div>
          }
          style={{ marginBottom: 20 }}
        />
        <WalineForm />
      </Card>
    </>
  );
}

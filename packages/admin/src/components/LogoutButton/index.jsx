import { logout } from '@/services/van-blog/api';
import { message } from 'antd';
import { history, useModel } from '@umijs/max';
import { clearStoredAdminToken } from '@/utils/adminSession';
export const logoutAndRedirect = async () => {
  await logout();

  const { query = {}, search, pathname } = history.location;
  const { redirect } = query; // Note: There may be security issues, please note

  if (pathname !== '/user/login') {
    history.replace({
      pathname: '/user/login',
      // search: stringify({
      //   redirect: pathname + search,
      // }),
    });
    clearStoredAdminToken();
  }
};
export default function (props) {
  const { setInitialState } = useModel('@@initialState');
  const { trigger } = props;
  return (
    <div
      onClick={() => {
        setInitialState((s) => ({ ...s, user: undefined }));
        logoutAndRedirect().then(() => {
          message.success('登出成功！');
        });
      }}
    >
      {trigger}
    </div>
  );
}

import Footer from '@/components/Footer';
import { login, getPublicSiteInfo } from '@/services/van-blog/api';
import { encryptPwd } from '@/services/van-blog/encryptPwd';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { LoginForm, ProFormCheckbox, ProFormText } from '@ant-design/pro-form';
import { message } from 'antd';
import { history, useModel } from 'umi';
import { useState, useEffect } from 'react';
import styles from './index.less';

const Login = () => {
  const type = 'account';
  const { initialState, setInitialState } = useModel('@@initialState');
  const [siteInfo, setSiteInfo] = useState(null);

  // 获取站点信息
  useEffect(() => {
    const fetchSiteInfo = async () => {
      try {
        const { data } = await getPublicSiteInfo();
        setSiteInfo(data);
      } catch (error) {
        console.error('获取站点信息失败:', error);
      }
    };
    fetchSiteInfo();
  }, []);

  const handleSubmit = async (values) => {
    try {
      // 登录
      const msg = await login({ ...values, type });

      if (msg.statusCode === 200) {
        const defaultLoginSuccessMessage = '登录成功！';
        message.success(defaultLoginSuccessMessage);
        const token = msg.data.token;
        const user = {
          name: msg.data.user.name,
          id: msg.data.user.id,
        };
        window.localStorage.setItem('token', token);
        await setInitialState((s) => ({
          ...s,
          token: token,
          user: user,
        }));
        // 获取一下 init 的数据。
        const meta = await initialState?.fetchInitData();
        await setInitialState((s) => ({
          ...s,
          token: token,
          user: user,
          ...meta,
        }));
        /** 此方法会跳转到 redirect 参数所在的位置 */
        if (!history) return;
        const { query } = history.location;
        const { redirect } = query;
        history.push(redirect || '/');
        return;
      }
    } catch (error) {}
  };

  // 渲染备案信息footer
  const renderBeianFooter = () => {
    if (!siteInfo) return null;

    const { beianNumber, beianUrl, gaBeianNumber, gaBeianUrl, gaBeianLogoUrl, since } = siteInfo;
    const currentYear = new Date().getFullYear();
    const sinceYear = since ? new Date(since).getFullYear() : currentYear;
    
    const footerStyle = {
      textAlign: 'center',
      fontSize: '12px',
      lineHeight: '20px',
      color: '#666',
      marginTop: '32px',
    };

    const linkStyle = {
      color: '#666',
      textDecoration: 'none',
    };

    const linkHoverStyle = {
      textDecoration: 'underline',
    };
    
    return (
      <footer style={footerStyle}>
        {beianNumber && (
          <p style={{ marginBottom: '4px' }}>
            ICP 编号:&nbsp;
            <a 
              href={beianUrl || "https://beian.miit.gov.cn"} 
              target="_blank" 
              rel="noopener noreferrer"
              style={linkStyle}
              onMouseOver={(e) => e.target.style.textDecoration = 'underline'}
              onMouseOut={(e) => e.target.style.textDecoration = 'none'}
            >
              {beianNumber}
            </a>
          </p>
        )}
        {gaBeianNumber && (
          <p style={{ 
            marginBottom: '4px',
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            flexWrap: 'wrap'
          }}>
            <span>公安备案:&nbsp;</span>
            {gaBeianLogoUrl && (
              <img 
                src={gaBeianLogoUrl} 
                alt="公安备案 logo" 
                width="20" 
                style={{ marginRight: '4px', verticalAlign: 'middle' }}
              />
            )}
            <a 
              href={gaBeianUrl || "https://beian.mps.gov.cn/#/query/webSearch"} 
              target="_blank" 
              rel="noopener noreferrer"
              style={linkStyle}
              onMouseOver={(e) => e.target.style.textDecoration = 'underline'}
              onMouseOut={(e) => e.target.style.textDecoration = 'none'}
            >
              {gaBeianNumber}
            </a>
          </p>
        )}
        <p style={{ userSelect: 'none', marginBottom: '4px' }}>
          © {sinceYear === currentYear ? currentYear : `${sinceYear} - ${currentYear}`}
        </p>
      </footer>
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <LoginForm
          className={styles.loginForm}
          logo={<img alt="logo" src="/logo.svg" />}
          title="VanBlog"
          subTitle={'VanBlog 博客管理后台'}
          initialValues={{
            autoLogin: true,
          }}
          onFinish={async (values) => {
            const { username, password } = values;
            await handleSubmit({
              username,
              password: encryptPwd(username, password),
            });
          }}
        >
          {type === 'account' && (
            <>
              <ProFormText
                name="username"
                autoComplete="off"
                fieldProps={{
                  size: 'large',
                  prefix: <UserOutlined className={styles.prefixIcon} />,
                }}
                placeholder={'用户名'}
                rules={[
                  {
                    required: true,
                    message: '用户名是必填项！',
                  },
                ]}
              />
              <ProFormText.Password
                name="password"
                autoComplete="off"
                fieldProps={{
                  size: 'large',
                  prefix: <LockOutlined className={styles.prefixIcon} />,
                }}
                placeholder={'密码'}
                rules={[
                  {
                    required: true,
                    message: '密码是必填项！',
                  },
                ]}
              />
            </>
          )}
          <div
            style={{
              marginBottom: 24,
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <ProFormCheckbox noStyle name="autoLogin">
              自动登录
            </ProFormCheckbox>
            <a
              onClick={() => {
                history.push('/user/restore');
              }}
            >
              忘记密码
            </a>
          </div>
        </LoginForm>
        
        {renderBeianFooter()}
      </div>
      <Footer />
    </div>
  );
};

export default Login;

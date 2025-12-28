import { errorImg } from '@/pages/Static/img';
import { getImgLink } from '@/pages/Static/img/tools';
import { ProFormText } from '@ant-design/pro-form';
import { Image, message } from 'antd';
import { debounce } from 'lodash';
import { useEffect, useMemo, useState, useRef } from 'react';
import UploadBtn from '../UploadBtn';

export default function (props: {
  name: string;
  label: string;
  placeholder: string;
  required: boolean;
  formRef: any;
  isInit: boolean;
  isFavicon?: boolean;
  isBackground?: boolean;
}) {
  const [url, setUrl] = useState('');
  const [shouldLoadImage, setShouldLoadImage] = useState(false);
  const mountedRef = useRef(false);
  
  const handleOnChange = debounce((ev) => {
    const val = ev?.target?.value;
    if (val && val != url) {
      setUrl(val);
      // 只有在有有效URL时才加载图片
      setShouldLoadImage(!!val && val.trim() !== '');
    }
  }, 500);
  
  useEffect(() => {
    // 只在组件挂载后延迟加载图片，避免首次加载时阻塞
    if (!mountedRef.current) {
      mountedRef.current = true;
      // 延迟加载图片，避免首次加载时所有图片同时请求
      const timer = setTimeout(() => {
        let src = '';
        if (props.formRef && props.formRef.getFieldValue) {
          src = props.formRef.getFieldValue(props.name);
        } else if (props.formRef?.current?.getFieldValue) {
          src = props.formRef.current.getFieldValue(props.name);
        }
        if (src) {
          setUrl(src);
          setShouldLoadImage(true);
        }
      }, 100);
      return () => clearTimeout(timer);
    } else {
      // 组件更新时，直接从form获取值
      let src = '';
      if (props.formRef && props.formRef.getFieldValue) {
        src = props.formRef.getFieldValue(props.name);
      } else if (props.formRef?.current?.getFieldValue) {
        src = props.formRef.current.getFieldValue(props.name);
      }
      if (src !== url) {
        setUrl(src || '');
        setShouldLoadImage(!!src && src.trim() !== '');
      }
    }
  }, [props.name, props.formRef]);
  
  const dest = useMemo(() => {
    let r = props.isInit ? '/api/admin/init/upload' : '/api/admin/img/upload';
    if (props.isFavicon) {
      r = r + '?favicon=true';
    }
    return r;
  }, [props.isInit, props.isFavicon]);
  
  // 只在有有效URL时才渲染Image组件
  const imageComponent = shouldLoadImage && url ? (
    <Image 
      src={url} 
      fallback={errorImg} 
      height={100} 
      width={100}
      loading="lazy"
      preview={false}
    />
  ) : (
    <div style={{ width: 100, height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed #d9d9d9', borderRadius: 4 }}>
      <span style={{ color: '#999', fontSize: 12 }}>暂无图片</span>
    </div>
  );
  
  return (
    <>
      <ProFormText
        name={props.name}
        label={props.label}
        required={props.required}
        placeholder={props.placeholder}
        tooltip="上传之前需要设置好图床哦，默认为本地图床。"
        fieldProps={{
          onChange: handleOnChange,
        }}
        extra={
          <div style={{ display: 'flex', marginTop: '10px' }}>
            {imageComponent}
            <div style={{ marginLeft: 10 }}>
              <UploadBtn
                setLoading={() => {}}
                muti={false}
                crop={!props.isBackground}
                text="上传图片"
                onFinish={(info) => {
                  if (info?.response?.data?.isNew) {
                    message.success(`${info.name} 上传成功!`);
                  } else {
                    if (props.isInit) {
                      message.success(`${info.name} 上传成功!`);
                    } else {
                      message.warning(`${info.name} 已存在!`);
                    }
                  }
                  if (info?.response?.data?.src) {
                    const src = getImgLink(info.response.data.src);
                    setUrl(src);
                    setShouldLoadImage(true);
                    if (props?.formRef?.setFieldsValue) {
                      const oldVal = props.formRef.getFieldsValue();
                      props?.formRef?.setFieldsValue({
                        ...oldVal,
                        [props.name]: src,
                      });
                    }
                    if (props.formRef?.current?.setFieldsValue) {
                      const oldVal = props.formRef.current.getFieldsValue();
                      props?.formRef?.current.setFieldsValue({
                        ...oldVal,
                        [props.name]: src,
                      });
                    }
                  } else {
                    console.error('上传响应中未包含图片src:', info?.response);
                    message.error('图片上传失败，请重试');
                  }
                }}
                url={dest}
                accept=".png,.jpg,.jpeg,.webp,.jiff,.gif"
              />
            </div>
          </div>
        }
        rules={props.required ? [{ required: true, message: '这是必填项' }] : undefined}
      />
    </>
  );
}

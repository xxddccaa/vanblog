import React, { useState } from 'react';
import toast from 'react-hot-toast';

interface ImageUploadProps {
  onImageInsert: (markdown: string) => void;
  disabled?: boolean;
}

export default function ImageUpload({ onImageInsert, disabled = false }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);

  const uploadImage = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    
    setUploading(true);
    try {
      // 鉴权校验
      const token = (typeof window !== 'undefined')
        ? (localStorage.getItem('token') || sessionStorage.getItem('token') || '')
        : '';
      if (!token) {
        throw new Error('未登录或登录已失效');
      }

      const res = await fetch('/api/admin/img/upload?withWaterMark=true', {
        method: 'POST',
        body: formData,
        headers: {
          token: token,
        },
      });

      if (!res.ok) {
        // 优先尝试解析后端错误信息
        try {
          const errData = await res.json();
          const msg = errData?.message || `上传失败 (HTTP ${res.status})`;
          throw new Error(msg);
        } catch (_) {
          throw new Error(`上传失败 (HTTP ${res.status})`);
        }
      }

      const data = await res.json();
      if (data && data.statusCode === 200) {
        // 构造完整的图片URL
        let imageUrl = data.data?.src || '';
        if (!imageUrl.includes('http://') && !imageUrl.includes('https://')) {
          imageUrl = `${window.location.protocol}//${window.location.host}${imageUrl}`;
        }
        // 转义括号，避免 markdown 解析异常
        imageUrl = imageUrl.replace(/\)/g, '%29').replace(/\(/g, '%28');
        
        // 生成markdown格式的图片链接
        const markdownImage = `![${file.name}](${imageUrl})`;
        onImageInsert(markdownImage);
        toast.success('图片上传成功');
      } else {
        const msg = data?.message || '图片上传失败';
        throw new Error(msg);
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      const msg = error?.message || '图片上传失败';
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // 检查文件类型
      if (!file.type.startsWith('image/')) {
        toast.error('请选择图片文件');
        return;
      }
      
      // 检查文件大小 (限制为10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('图片文件大小不能超过10MB');
        return;
      }
      
      uploadImage(file);
    }
  };

  return (
    <div className="inline-block">
      <input
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        disabled={disabled || uploading}
        className="hidden"
        id="image-upload-input"
      />
      <label
        htmlFor="image-upload-input"
        className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg border transition-colors cursor-pointer
          ${disabled || uploading 
            ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' 
            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-dark-2 dark:text-dark dark:border-dark-3 dark:hover:bg-dark-1'
          }`}
      >
        {uploading ? (
          <>
            <svg className="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            上传中...
          </>
        ) : (
          <>
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            插入图片
          </>
        )}
      </label>
    </div>
  );
}

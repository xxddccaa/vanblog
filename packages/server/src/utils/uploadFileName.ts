import { BadRequestException } from '@nestjs/common';

export const getSafeUploadFileName = (originalName?: string) => {
  const normalized = String(originalName || '')
    .replace(/\0/g, '')
    .replace(/\\/g, '/')
    .trim();
  const fileName = normalized.split('/').filter(Boolean).pop();

  if (!fileName || fileName === '.' || fileName === '..') {
    throw new BadRequestException('文件名非法');
  }

  return fileName;
};

export const splitSafeUploadFileName = (originalName?: string) => {
  const fileName = getSafeUploadFileName(originalName);
  const dotIndex = fileName.lastIndexOf('.');

  if (dotIndex <= 0 || dotIndex === fileName.length - 1) {
    return {
      fileName,
      extension: '',
      nameWithoutExtension: fileName,
    };
  }

  return {
    fileName,
    extension: fileName.slice(dotIndex + 1).toLowerCase(),
    nameWithoutExtension: fileName.slice(0, dotIndex),
  };
};

export const sanitizeStorageFileStem = (fileStem?: string, fallback = 'file') => {
  const normalized = String(fileStem || '')
    .replace(/[\u0000-\u001f<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
    .replace(/\.+$/, '');

  return normalized || fallback;
};

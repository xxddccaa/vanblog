import { useEffect } from 'react';
import { useModel } from '@umijs/max';
import { applyThemeToDocument, getInitTheme } from '@/services/van-blog/theme';

export default function AuthThemeSync() {
  const { initialState } = useModel('@@initialState');

  useEffect(() => {
    applyThemeToDocument(initialState?.theme || getInitTheme());
  }, [initialState?.theme]);

  return null;
}

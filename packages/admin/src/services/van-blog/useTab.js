import { history } from '@umijs/max';
import { useEffect, useMemo, useState } from 'react';

const getSearchParams = () => new URLSearchParams(history.location.search || '');

const getNormalizedPathname = () => {
  const pathname = history.location.pathname || '/';

  if (pathname === '/admin') {
    return '/';
  }

  if (pathname.startsWith('/admin/')) {
    return pathname.slice('/admin'.length);
  }

  return pathname;
};

const normalizeTabValue = (value, init, allowedValues = []) => {
  if (value === null || value === undefined || value === '') {
    return init;
  }

  if (allowedValues.length > 0 && !allowedValues.includes(value)) {
    return init;
  }

  return value;
};

export const readTabValueFromLocation = (init, tabKey, allowedValues = []) =>
  normalizeTabValue(getSearchParams().get(tabKey), init, allowedValues);

export const buildPathWithTabValue = (tabKey, nextValue) => {
  const searchParams = getSearchParams();

  if (nextValue === undefined || nextValue === null || nextValue === '') {
    searchParams.delete(tabKey);
  } else {
    searchParams.set(tabKey, String(nextValue));
  }

  const nextSearch = searchParams.toString();
  return `${getNormalizedPathname()}${nextSearch ? `?${nextSearch}` : ''}`;
};

export const useTab = (init, tabKey, allowedValues = []) => {
  const validValues = useMemo(() => allowedValues || [], [allowedValues]);
  const validValuesKey = validValues.join('|');
  const readCurrentValue = () => readTabValueFromLocation(init, tabKey, validValues);
  const [currTabKey, setCurrTabKey] = useState(readCurrentValue);

  useEffect(() => {
    setCurrTabKey(readCurrentValue());
  }, [init, tabKey, history.location.pathname, history.location.search, validValuesKey]);

  return [
    currTabKey,
    (newTab) => {
      const nextTab = normalizeTabValue(String(newTab), init, validValues);
      setCurrTabKey(nextTab);
      history.push(buildPathWithTabValue(tabKey, nextTab));
    },
  ];
};

import { deepClone, isPlainObject, maybeDateValue } from './storage.utils';

const getPathValue = (source: any, path: string) => {
  if (!path) {
    return source;
  }
  const keys = path.split('.');
  let current = source;
  for (const key of keys) {
    if (current == null) {
      return undefined;
    }
    current = current[key];
  }
  return current;
};

const hasPath = (source: any, path: string) => {
  if (!path) {
    return source !== undefined;
  }
  const keys = path.split('.');
  let current = source;
  for (const key of keys) {
    if (current == null || !(key in current)) {
      return false;
    }
    current = current[key];
  }
  return true;
};

const normalizeRegex = (value: string | RegExp, options?: string) => {
  if (value instanceof RegExp) {
    return value;
  }
  return new RegExp(value, options);
};

const matchesScalar = (value: any, expected: any) => {
  if (expected instanceof RegExp) {
    return normalizeRegex(expected).test(String(value ?? ''));
  }
  if (Array.isArray(value) && !Array.isArray(expected)) {
    return value.some((item) => matchesScalar(item, expected));
  }
  return value === expected;
};

const matchesOperatorObject = (value: any, condition: Record<string, any>) => {
  for (const [operator, expected] of Object.entries(condition)) {
    switch (operator) {
      case '$regex': {
        const regex = normalizeRegex(expected as any, condition.$options);
        if (Array.isArray(value)) {
          if (!value.some((item) => regex.test(String(item ?? '')))) {
            return false;
          }
        } else if (!regex.test(String(value ?? ''))) {
          return false;
        }
        break;
      }
      case '$options':
        break;
      case '$exists': {
        const exists = value !== undefined;
        if (Boolean(expected) !== exists) {
          return false;
        }
        break;
      }
      case '$gte':
      case '$gt':
      case '$lte':
      case '$lt': {
        const left = maybeDateValue(value);
        const right = maybeDateValue(expected);
        if (operator === '$gte' && !(left >= right)) return false;
        if (operator === '$gt' && !(left > right)) return false;
        if (operator === '$lte' && !(left <= right)) return false;
        if (operator === '$lt' && !(left < right)) return false;
        break;
      }
      case '$ne':
        if (matchesScalar(value, expected)) {
          return false;
        }
        break;
      case '$in': {
        const values = Array.isArray(expected) ? expected : [expected];
        if (Array.isArray(value)) {
          if (!value.some((item) => values.some((candidate) => matchesScalar(item, candidate)))) {
            return false;
          }
        } else if (!values.some((candidate) => matchesScalar(value, candidate))) {
          return false;
        }
        break;
      }
      case '$nin': {
        const values = Array.isArray(expected) ? expected : [expected];
        if (Array.isArray(value)) {
          if (value.some((item) => values.some((candidate) => matchesScalar(item, candidate)))) {
            return false;
          }
        } else if (values.some((candidate) => matchesScalar(value, candidate))) {
          return false;
        }
        break;
      }
      default:
        if (isPlainObject(expected)) {
          if (!matchesQuery(value || {}, { [operator]: expected })) {
            return false;
          }
          break;
        }
        if (!matchesScalar(getPathValue(value, operator), expected)) {
          return false;
        }
        break;
    }
  }
  return true;
};

export const matchesQuery = (document: any, query: any): boolean => {
  if (!query || !Object.keys(query).length) {
    return true;
  }

  for (const [key, expected] of Object.entries(query)) {
    if (key === '$and') {
      if (!Array.isArray(expected) || !(expected as any[]).every((item) => matchesQuery(document, item))) {
        return false;
      }
      continue;
    }
    if (key === '$or') {
      if (!Array.isArray(expected) || !(expected as any[]).some((item) => matchesQuery(document, item))) {
        return false;
      }
      continue;
    }

    const value = getPathValue(document, key);
    if (isPlainObject(expected) && Object.keys(expected).some((item) => item.startsWith('$'))) {
      if (!matchesOperatorObject(value, expected)) {
        return false;
      }
      continue;
    }

    if (!matchesScalar(value, expected)) {
      return false;
    }
  }

  return true;
};

const applyStringProjection = (document: any, projection: string) => {
  const fields = projection
    .split(/\s+/)
    .map((field) => field.trim())
    .filter(Boolean);
  if (!fields.length) {
    return deepClone(document);
  }

  const result: Record<string, any> = {};
  for (const field of fields) {
    result[field] = deepClone(getPathValue(document, field));
  }
  if (!fields.includes('_id') && document._id !== undefined) {
    result._id = document._id;
  }
  return result;
};

export const applyProjection = (document: any, projection?: any) => {
  if (!projection) {
    return deepClone(document);
  }
  if (typeof projection === 'string') {
    return applyStringProjection(document, projection);
  }
  if (!isPlainObject(projection)) {
    return deepClone(document);
  }

  const includeKeys = Object.entries(projection)
    .filter(([, value]) => Boolean(value))
    .map(([key]) => key);
  const excludeKeys = Object.entries(projection)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (includeKeys.length > 0) {
    const result: Record<string, any> = {};
    for (const key of includeKeys) {
      result[key] = deepClone(getPathValue(document, key));
    }
    if (!includeKeys.includes('_id') && projection._id !== 0 && document._id !== undefined) {
      result._id = document._id;
    }
    return result;
  }

  const cloned = deepClone(document);
  for (const key of excludeKeys) {
    delete cloned[key];
  }
  return cloned;
};

export const applySort = <T>(documents: T[], sort?: Record<string, 1 | -1>) => {
  if (!sort || !Object.keys(sort).length) {
    return [...documents];
  }

  const entries = Object.entries(sort);
  return [...documents].sort((left: any, right: any) => {
    for (const [key, direction] of entries) {
      const leftValue = maybeDateValue(getPathValue(left, key));
      const rightValue = maybeDateValue(getPathValue(right, key));
      if (leftValue === rightValue) {
        continue;
      }
      if (leftValue == null) {
        return direction === 1 ? -1 : 1;
      }
      if (rightValue == null) {
        return direction === 1 ? 1 : -1;
      }
      if (leftValue > rightValue) {
        return direction === 1 ? 1 : -1;
      }
      if (leftValue < rightValue) {
        return direction === 1 ? -1 : 1;
      }
    }
    return 0;
  });
};

const getArrayMatchValueFromFilter = (filter: any, field: string): any => {
  if (!filter || !isPlainObject(filter)) {
    return undefined;
  }
  if (field in filter && !isPlainObject(filter[field])) {
    return filter[field];
  }
  if (Array.isArray(filter.$and)) {
    for (const item of filter.$and) {
      const nested = getArrayMatchValueFromFilter(item, field);
      if (nested !== undefined) {
        return nested;
      }
    }
  }
  return undefined;
};

const ensureParent = (target: any, keys: string[]) => {
  let current = target;
  for (let index = 0; index < keys.length - 1; index += 1) {
    const key = keys[index];
    if (!isPlainObject(current[key]) && !Array.isArray(current[key])) {
      current[key] = {};
    }
    current = current[key];
  }
  return current;
};

const setPathValue = (target: any, path: string, value: any, filter?: any) => {
  const keys = path.split('.');
  if (keys.includes('$')) {
    const dollarIndex = keys.indexOf('$');
    const arrayField = keys.slice(0, dollarIndex).join('.');
    const arrayValue = getPathValue(target, arrayField);
    if (Array.isArray(arrayValue)) {
      const matchedValue = getArrayMatchValueFromFilter(filter, arrayField);
      const itemIndex = matchedValue === undefined ? 0 : arrayValue.findIndex((item) => item === matchedValue);
      const resolvedIndex = itemIndex >= 0 ? itemIndex : 0;
      keys[dollarIndex] = String(resolvedIndex);
    }
  }
  const parent = ensureParent(target, keys);
  parent[keys[keys.length - 1]] = deepClone(value);
};

const unsetPathValue = (target: any, path: string) => {
  const keys = path.split('.');
  const parent = ensureParent(target, keys);
  delete parent[keys[keys.length - 1]];
};

export const applyUpdate = (
  document: Record<string, any>,
  update: Record<string, any>,
  filter?: any,
  options: { isUpsertInsert?: boolean } = {},
) => {
  const next = deepClone(document);
  const operators = Object.keys(update || {}).filter((key) => key.startsWith('$'));

  if (!operators.length) {
    for (const [key, value] of Object.entries(update || {})) {
      setPathValue(next, key, value, filter);
    }
    return next;
  }

  if (update.$set) {
    for (const [key, value] of Object.entries(update.$set)) {
      setPathValue(next, key, value, filter);
    }
  }

  if (update.$setOnInsert && options.isUpsertInsert) {
    for (const [key, value] of Object.entries(update.$setOnInsert)) {
      if (!hasPath(next, key)) {
        setPathValue(next, key, value, filter);
      }
    }
  }

  if (update.$inc) {
    for (const [key, value] of Object.entries(update.$inc)) {
      const currentValue = Number(getPathValue(next, key) || 0);
      setPathValue(next, key, currentValue + Number(value), filter);
    }
  }

  if (update.$pull) {
    for (const [key, value] of Object.entries(update.$pull)) {
      const currentValue = getPathValue(next, key);
      if (Array.isArray(currentValue)) {
        setPathValue(
          next,
          key,
          currentValue.filter((item) => item !== value),
          filter,
        );
      }
    }
  }

  if (update.$addToSet) {
    for (const [key, value] of Object.entries(update.$addToSet)) {
      const currentValue = getPathValue(next, key);
      const currentArray = Array.isArray(currentValue) ? [...currentValue] : [];
      if (!currentArray.includes(value)) {
        currentArray.push(value);
      }
      setPathValue(next, key, currentArray, filter);
    }
  }

  if (update.$unset) {
    for (const key of Object.keys(update.$unset)) {
      unsetPathValue(next, key);
    }
  }

  return next;
};

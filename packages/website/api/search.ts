export interface SearchIndexItem {
  title: string;
  id: number;
  pathname?: string;
  category: string;
  tags: string[];
  updatedAt: string;
  createdAt: string;
  preview?: string;
  searchText?: string;
}

let cachedIndex: SearchIndexItem[] | null = null;
let pendingIndexRequest: Promise<SearchIndexItem[]> | null = null;

export function filterSearchIndex(index: SearchIndexItem[], keyword: string) {
  const normalized = keyword.trim().toLowerCase();
  if (!normalized) {
    return [];
  }

  return index
    .filter((item) => {
      const haystack = item.searchText || [item.title, item.category, (item.tags || []).join(' '), item.preview || ''].join(' ').toLowerCase();
      return haystack.includes(normalized);
    })
    .sort((left, right) => {
      const leftText = left.searchText || left.title.toLowerCase();
      const rightText = right.searchText || right.title.toLowerCase();
      const leftStartsWithTitle = left.title.toLowerCase().startsWith(normalized);
      const rightStartsWithTitle = right.title.toLowerCase().startsWith(normalized);

      if (leftStartsWithTitle !== rightStartsWithTitle) {
        return leftStartsWithTitle ? -1 : 1;
      }

      const leftIncludesTitle = leftText.includes(normalized);
      const rightIncludesTitle = rightText.includes(normalized);
      if (leftIncludesTitle !== rightIncludesTitle) {
        return leftIncludesTitle ? -1 : 1;
      }

      return new Date(right.updatedAt || right.createdAt).getTime() - new Date(left.updatedAt || left.createdAt).getTime();
    });
}

async function loadSearchIndex(): Promise<SearchIndexItem[]> {
  if (cachedIndex) {
    return cachedIndex;
  }
  if (pendingIndexRequest) {
    return pendingIndexRequest;
  }

  pendingIndexRequest = fetch('/static/search-index.json')
    .then((res) => {
      if (!res.ok) {
        throw new Error(`Failed to fetch search index: ${res.status}`);
      }
      return res.json();
    })
    .then((data) => {
      cachedIndex = data || [];
      return cachedIndex;
    })
    .finally(() => {
      pendingIndexRequest = null;
    });

  return pendingIndexRequest;
}

export async function searchArticles(str: string): Promise<any> {
  const normalized = str.trim();
  if (!normalized) {
    return [];
  }

  try {
    const index = await loadSearchIndex();
    return filterSearchIndex(index, normalized);
  } catch (err) {
    const url = `/api/public/search?value=${encodeURIComponent(normalized)}`;
    const res = await fetch(url);
    const { data } = await res.json();
    return data.data;
  }
}

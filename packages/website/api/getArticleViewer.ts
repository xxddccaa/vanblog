export const getArticleViewer = async (id: number | string) => {
  try {
    const url = `/api/public/article/viewer/${id}`;
    const res = await fetch(url);
    const { data } = await res.json();
    return data;
  } catch (err) {
    console.log("Failed to connect, using default values");
    return 0;
  }
};

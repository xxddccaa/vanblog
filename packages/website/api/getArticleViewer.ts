import { getArticleEngagementByIdOrPathname } from "./getArticles";

export const getArticleViewer = async (id: number | string) => {
  try {
    const { viewer, visited } = await getArticleEngagementByIdOrPathname(String(id));
    return {
      viewer,
      visited,
    };
  } catch (err) {
    console.log("Failed to connect, using default values");
    return 0;
  }
};

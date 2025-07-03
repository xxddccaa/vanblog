import { verifyAdminToken } from "../api/getArticles";

export const checkLogin = () => {
  if (typeof window === "undefined") return false;
  const token = localStorage?.getItem("token") || sessionStorage?.getItem("token");
  return !!token;
};

export const checkLoginAsync = async (): Promise<boolean> => {
  if (typeof window === "undefined") return false;
  const token = localStorage?.getItem("token") || sessionStorage?.getItem("token");
  if (!token) return false;
  
  try {
    return await verifyAdminToken(token);
  } catch {
    return false;
  }
};

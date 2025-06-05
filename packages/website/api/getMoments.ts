import { encodeQuerystring } from "../utils/encode";
import { config } from "../utils/loadConfig";

export type SortOrder = "asc" | "desc";

export interface GetMomentOption {
  page: number;
  pageSize: number;
  sortCreatedAt?: SortOrder;
  startTime?: string;
  endTime?: string;
}

export interface Moment {
  id: number;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMomentDto {
  content: string;
}

export const getMoments = async (
  option: GetMomentOption
): Promise<{ moments: Moment[]; total: number }> => {
  let queryString = "";
  for (const [k, v] of Object.entries(option)) {
    if (v !== undefined) {
      queryString += `${k}=${v}&`;
    }
  }
  queryString = queryString.substring(0, queryString.length - 1);
  queryString = encodeQuerystring(queryString);
  
  try {
    const url = `${config.baseUrl}api/public/moment?${queryString}`;
    const res = await fetch(url);
    const { statusCode, data } = await res.json();
    if (statusCode == 233) {
      return { moments: [], total: 0 };
    }
    return data;
  } catch (error) {
    console.log("Failed to connect, using default values");
    return { moments: [], total: 0 };
  }
};

export const createMoment = async (
  momentData: CreateMomentDto,
  token: string
): Promise<Moment> => {
  try {
    const url = `/api/admin/moment`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "token": token,
      },
      body: JSON.stringify(momentData),
    });
    
    const { statusCode, data, message } = await res.json();
    if (statusCode !== 200) {
      throw new Error(message || '发布动态失败');
    }
    
    return data;
  } catch (error) {
    console.log("Failed to connect, publish failed");
    throw error;
  }
}; 
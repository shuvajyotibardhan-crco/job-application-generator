import axios from 'axios';

const API_KEY = process.env.GOOGLE_SEARCH_API_KEY;
const ENGINE_ID = process.env.GOOGLE_SEARCH_ENGINE_ID;
const BASE_URL = 'https://www.googleapis.com/customsearch/v1';

export interface SearchResult {
  title: string;
  snippet: string;
  link: string;
}

export const searchCompany = async (companyName: string): Promise<SearchResult[]> => {
  const { data } = await axios.get(BASE_URL, {
    params: { key: API_KEY, cx: ENGINE_ID, q: `"${companyName}" company about official`, num: 5 },
  });
  return (data.items ?? []).map((item: Record<string, string>) => ({
    title: item.title,
    snippet: item.snippet,
    link: item.link,
  }));
};

export const searchRole = async (companyName: string, roleTitle: string): Promise<SearchResult[]> => {
  const { data } = await axios.get(BASE_URL, {
    params: { key: API_KEY, cx: ENGINE_ID, q: `"${companyName}" "${roleTitle}" job description responsibilities`, num: 3 },
  });
  return (data.items ?? []).map((item: Record<string, string>) => ({
    title: item.title,
    snippet: item.snippet,
    link: item.link,
  }));
};

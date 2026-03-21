export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  createdAt: any; // Firestore Timestamp
}

export interface WatchlistItem {
  userId: string;
  symbol: string;
  name?: string;
  addedAt: any; // Firestore Timestamp
}

export interface NewsItem {
  title: string;
  summary: string;
  url: string;
  date: string;
}

export interface StockData {
  symbol: string;
  name: string;
  price: number;
  currency: string;
  change: number;
  changePercent: number;
  history: { date: string; price: number }[];
  news?: NewsItem[];
  marketCap?: string;
  peRatio?: number;
  dividendYield?: string;
  high52w?: number;
  low52w?: number;
}

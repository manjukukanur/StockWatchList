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

export interface StockData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  history: { date: string; price: number }[];
}

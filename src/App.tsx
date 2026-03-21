import React, { useState, useEffect, useMemo } from 'react';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { collection, doc, setDoc, onSnapshot, query, deleteDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useCollectionData } from 'react-firebase-hooks/firestore';
import { Search, Plus, Trash2, TrendingUp, TrendingDown, LogOut, User as UserIcon, Loader2, X, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { fetchStockData, searchStocks } from './services/stockService';
import { StockData, WatchlistItem } from './types';
import { StockChart } from './components/StockChart';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function getCurrencySymbol(currency: string) {
  switch (currency?.toUpperCase()) {
    case 'INR': return '₹';
    case 'GBP': return '£';
    case 'EUR': return '€';
    case 'JPY': return '¥';
    default: return '$';
  }
}

export default function App() {
  const [user, loading, error] = useAuthState(auth);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ symbol: string; name: string }[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [stockDetails, setStockDetails] = useState<Record<string, StockData>>({});
  const [isLoadingDetails, setIsLoadingDetails] = useState<Record<string, boolean>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Firestore Watchlist
  const watchlistRef = useMemo(() => {
    if (!user) return null;
    return collection(db, 'users', user.uid, 'watchlist');
  }, [user]);

  const [watchlistItems, watchlistLoading, watchlistError] = useCollectionData(watchlistRef);

  const refreshStockData = async () => {
    if (!watchlistItems || isRefreshing) return;
    setIsRefreshing(true);
    const promises = watchlistItems.map(async (item: any) => {
      setIsLoadingDetails(prev => ({ ...prev, [item.symbol]: true }));
      try {
        const data = await fetchStockData(item.symbol);
        setStockDetails(prev => ({ ...prev, [item.symbol]: data }));
      } catch (err) {
        console.error(`Error refreshing data for ${item.symbol}:`, err);
      } finally {
        setIsLoadingDetails(prev => ({ ...prev, [item.symbol]: false }));
      }
    });
    await Promise.all(promises);
    setIsRefreshing(false);
  };

  // Sync user profile to Firestore
  useEffect(() => {
    if (user) {
      const syncUser = async () => {
        const userRef = doc(db, 'users', user.uid);
        try {
          const userDoc = await getDoc(userRef);
          if (!userDoc.exists()) {
            await setDoc(userRef, {
              uid: user.uid,
              email: user.email,
              displayName: user.displayName,
              photoURL: user.photoURL,
              createdAt: serverTimestamp(),
            });
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
        }
      };
      syncUser();
    }
  }, [user]);

  // Fetch stock details for watchlist items
  useEffect(() => {
    if (watchlistItems) {
      watchlistItems.forEach(async (item: any) => {
        if (!stockDetails[item.symbol] && !isLoadingDetails[item.symbol]) {
          setIsLoadingDetails(prev => ({ ...prev, [item.symbol]: true }));
          try {
            const data = await fetchStockData(item.symbol);
            setStockDetails(prev => ({ ...prev, [item.symbol]: data }));
          } catch (err) {
            console.error(`Error fetching data for ${item.symbol}:`, err);
          } finally {
            setIsLoadingDetails(prev => ({ ...prev, [item.symbol]: false }));
          }
        }
      });
    }
  }, [watchlistItems]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const results = await searchStocks(searchQuery);
      setSearchResults(results);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const addToWatchlist = async (stock: { symbol: string; name: string }) => {
    if (!user) return;
    const docRef = doc(db, 'users', user.uid, 'watchlist', stock.symbol);
    try {
      await setDoc(docRef, {
        userId: user.uid,
        symbol: stock.symbol,
        name: stock.name,
        addedAt: serverTimestamp(),
      });
      setSearchQuery('');
      setSearchResults([]);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/watchlist/${stock.symbol}`);
    }
  };

  const removeFromWatchlist = async (symbol: string) => {
    if (!user) return;
    const docRef = doc(db, 'users', user.uid, 'watchlist', symbol);
    try {
      await deleteDoc(docRef);
      const newDetails = { ...stockDetails };
      delete newDetails[symbol];
      setStockDetails(newDetails);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/watchlist/${symbol}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center border border-slate-100"
        >
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-200">
            <TrendingUp className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">StockWatch</h1>
          <p className="text-slate-500 mb-8">Track your favorite stocks in real-time with AI-powered insights.</p>
          
          <button
            onClick={() => signInWithPopup(auth, googleProvider)}
            className="w-full flex items-center justify-center gap-3 bg-white border border-slate-200 text-slate-700 font-semibold py-3 px-4 rounded-xl hover:bg-slate-50 transition-all shadow-sm"
          >
            <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
            Sign in with Google
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-md shadow-indigo-100">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">StockWatch</span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={refreshStockData}
              disabled={isRefreshing}
              className={cn(
                "p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all",
                isRefreshing && "animate-spin text-indigo-600 bg-indigo-50"
              )}
              title="Refresh Data"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            <div className="hidden sm:flex items-center gap-2 text-sm text-slate-500 mr-4">
              <UserIcon className="w-4 h-4" />
              {user.displayName}
            </div>
            <button
              onClick={() => signOut(auth)}
              className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search Section */}
        <section className="mb-12">
          <div className="max-w-2xl mx-auto">
            <form onSubmit={handleSearch} className="relative">
              <input
                type="text"
                placeholder="Search for stocks (e.g., AAPL, Tesla)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm text-lg"
              />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              {isSearching && (
                <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-500 w-5 h-5 animate-spin" />
              )}
            </form>

            <AnimatePresence>
              {searchResults.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden z-20"
                >
                  {searchResults.map((stock) => (
                    <button
                      key={stock.symbol}
                      onClick={() => addToWatchlist(stock)}
                      className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0"
                    >
                      <div className="text-left">
                        <div className="font-bold text-slate-900">{stock.symbol}</div>
                        <div className="text-sm text-slate-500">{stock.name}</div>
                      </div>
                      <Plus className="w-5 h-5 text-indigo-600" />
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>

        {/* Watchlist Section */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-slate-900">Your Watchlist</h2>
            <span className="text-sm text-slate-500 font-medium bg-slate-200 px-3 py-1 rounded-full">
              {watchlistItems?.length || 0} Stocks
            </span>
          </div>

          {watchlistLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
          ) : watchlistItems?.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">No stocks watched yet</h3>
              <p className="text-slate-500">Search for a stock symbol to start tracking.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {watchlistItems?.map((item: any) => {
                const details = stockDetails[item.symbol];
                const isLoading = isLoadingDetails[item.symbol];

                return (
                  <motion.div
                    layout
                    key={item.symbol}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-shadow group relative"
                  >
                    <button
                      onClick={() => removeFromWatchlist(item.symbol)}
                      className="absolute top-4 right-4 p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-2xl font-bold text-slate-900 tracking-tight">{item.symbol}</h3>
                        <p className="text-sm text-slate-500 font-medium truncate max-w-[150px]">{item.name}</p>
                      </div>
                      {details && (
                        <div className="text-right">
                          <div className="text-2xl font-bold text-slate-900">
                            {getCurrencySymbol(details.currency)}{details.price.toLocaleString()}
                          </div>
                          <div className={cn(
                            "flex items-center justify-end gap-1 text-sm font-semibold",
                            details.change >= 0 ? "text-emerald-600" : "text-rose-600"
                          )}>
                            {details.change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {details.change >= 0 ? '+' : ''}{details.change.toFixed(2)} ({details.changePercent.toFixed(2)}%)
                          </div>
                        </div>
                      )}
                    </div>

                    {isLoading ? (
                      <div className="h-48 flex items-center justify-center">
                        <Loader2 className="w-6 h-6 text-slate-300 animate-spin" />
                      </div>
                    ) : details ? (
                      <StockChart 
                        data={details.history} 
                        color={details.change >= 0 ? "#10b981" : "#f43f5e"} 
                      />
                    ) : (
                      <div className="h-48 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 text-sm italic">
                        Loading chart data...
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

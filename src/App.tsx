import React, { useState, useEffect, useMemo } from 'react';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { collection, doc, setDoc, onSnapshot, query, deleteDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useCollectionData } from 'react-firebase-hooks/firestore';
import { Search, Plus, Trash2, TrendingUp, TrendingDown, LogOut, User as UserIcon, Loader2, X, RefreshCw, ExternalLink, Calendar, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { fetchStockData, searchStocks, fetchStockDetails } from './services/stockService';
import { StockData, WatchlistItem, NewsItem } from './types';
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
  const [selectedStock, setSelectedStock] = useState<StockData | null>(null);
  const [isFetchingFullDetails, setIsFetchingFullDetails] = useState(false);

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

  const handleStockClick = async (symbol: string) => {
    setIsFetchingFullDetails(true);
    try {
      const details = await fetchStockDetails(symbol);
      setSelectedStock(details);
    } catch (err) {
      console.error('Error fetching full stock details:', err);
    } finally {
      setIsFetchingFullDetails(false);
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
                    onClick={() => handleStockClick(item.symbol)}
                    className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-shadow group relative cursor-pointer"
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFromWatchlist(item.symbol);
                      }}
                      className="absolute top-4 right-4 p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-all opacity-0 group-hover:opacity-100 z-10"
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

      {/* Full Details Modal */}
      <AnimatePresence>
        {selectedStock && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col"
            >
              {/* Modal Header */}
              <div className="p-8 border-b border-slate-100 flex items-start justify-between bg-slate-50/50">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="text-4xl font-bold text-slate-900 tracking-tight">{selectedStock.symbol}</h2>
                    <span className="px-3 py-1 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full uppercase tracking-wider">
                      {selectedStock.currency}
                    </span>
                  </div>
                  <p className="text-xl text-slate-500 font-medium">{selectedStock.name}</p>
                </div>
                <button
                  onClick={() => setSelectedStock(null)}
                  className="p-3 text-slate-400 hover:text-slate-600 hover:bg-white rounded-2xl transition-all shadow-sm"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-8 space-y-10">
                {/* Key Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Price</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {getCurrencySymbol(selectedStock.currency)}{selectedStock.price.toLocaleString()}
                    </p>
                    <div className={cn(
                      "flex items-center gap-1 text-sm font-bold mt-1",
                      selectedStock.change >= 0 ? "text-emerald-600" : "text-rose-600"
                    )}>
                      {selectedStock.change >= 0 ? '+' : ''}{selectedStock.change.toFixed(2)} ({selectedStock.changePercent.toFixed(2)}%)
                    </div>
                  </div>
                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Market Cap</p>
                    <p className="text-2xl font-bold text-slate-900">{selectedStock.marketCap || 'N/A'}</p>
                  </div>
                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">P/E Ratio</p>
                    <p className="text-2xl font-bold text-slate-900">{selectedStock.peRatio || 'N/A'}</p>
                  </div>
                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Div Yield</p>
                    <p className="text-2xl font-bold text-slate-900">{selectedStock.dividendYield || 'N/A'}</p>
                  </div>
                </div>

                {/* Chart Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-indigo-600" />
                      Price Movement (30 Days)
                    </h3>
                    <div className="flex gap-4 text-sm font-medium">
                      <div className="flex flex-col items-end">
                        <span className="text-slate-400 text-[10px] uppercase tracking-tighter">52W High</span>
                        <span className="text-slate-900">{getCurrencySymbol(selectedStock.currency)}{selectedStock.high52w?.toLocaleString() || 'N/A'}</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-slate-400 text-[10px] uppercase tracking-tighter">52W Low</span>
                        <span className="text-slate-900">{getCurrencySymbol(selectedStock.currency)}{selectedStock.low52w?.toLocaleString() || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm">
                    <StockChart 
                      data={selectedStock.history} 
                      color={selectedStock.change >= 0 ? "#10b981" : "#f43f5e"} 
                    />
                  </div>
                </div>

                {/* News Section */}
                <div className="space-y-6">
                  <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <Info className="w-5 h-5 text-indigo-600" />
                    Latest News
                  </h3>
                  <div className="grid gap-4">
                    {selectedStock.news && selectedStock.news.length > 0 ? (
                      selectedStock.news.map((news, idx) => (
                        <a
                          key={idx}
                          href={news.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group bg-white border border-slate-100 p-6 rounded-3xl hover:border-indigo-200 hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                        >
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 uppercase tracking-widest">
                              <Calendar className="w-3 h-3" />
                              {news.date}
                            </div>
                            <h4 className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors leading-snug">
                              {news.title}
                            </h4>
                            <p className="text-slate-500 text-sm line-clamp-2 leading-relaxed">
                              {news.summary}
                            </p>
                          </div>
                          <ExternalLink className="w-5 h-5 text-slate-300 group-hover:text-indigo-600 transition-colors shrink-0" />
                        </a>
                      ))
                    ) : (
                      <div className="text-center py-10 bg-slate-50 rounded-3xl border border-dashed border-slate-200 text-slate-400 italic">
                        No recent news found for this stock.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Loading Overlay for full details */}
      <AnimatePresence>
        {isFetchingFullDetails && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-white/80 backdrop-blur-md"
          >
            <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-indigo-200 mb-6 animate-pulse">
              <TrendingUp className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Fetching Market Insights</h3>
            <p className="text-slate-500 animate-pulse">Analyzing real-time data and news...</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, AlertCircle, RefreshCw } from 'lucide-react';

const CryptoPriceAnalyzer = () => {
  const [data, setData] = useState([]);
  const [currentPrices, setCurrentPrices] = useState({
    bitcoin: { usd: 0 },
    ethereum: { usd: 0 },
    ripple: { usd: 0 }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  // Clear all cache data
  const clearCache = () => {
    localStorage.removeItem('crypto-analyzer-current-prices');
    localStorage.removeItem('crypto-analyzer-market-data');
    localStorage.removeItem('crypto-analyzer-btc-historical');
    localStorage.removeItem('crypto-analyzer-eth-historical');
    localStorage.removeItem('crypto-analyzer-xrp-historical');
    console.log('Cache cleared');
  };

  // Helper function for API calls with caching and retry logic
  const fetchWithCache = async (url, cacheKey, cacheDuration = 5 * 60 * 1000) => {
    // Check if we have cached data and it's still valid
    const cachedData = localStorage.getItem(cacheKey);
    if (cachedData) {
      const { timestamp, data } = JSON.parse(cachedData);
      const now = new Date().getTime();
      
      // If the cache is still valid, use it
      if (now - timestamp < cacheDuration) {
        console.log(`Using cached data for ${cacheKey}`);
        return data;
      }
    }
    
    // Implement retry logic with exponential backoff
    let retries = 0;
    const maxRetries = 3;
    
    while (retries <= maxRetries) {
      try {
        // Add a delay between retries with exponential backoff
        if (retries > 0) {
          const delay = Math.pow(2, retries) * 1000;
          console.log(`Retry ${retries}/${maxRetries} after ${delay}ms delay`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        const response = await fetch(url);
        
        if (response.status === 429) {
          console.log('Rate limit hit, retrying with backoff...');
          retries++;
          continue;
        }
        
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Cache the successful response
        localStorage.setItem(cacheKey, JSON.stringify({
          timestamp: new Date().getTime(),
          data
        }));
        
        return data;
      } catch (error) {
        if (retries === maxRetries) {
          throw error;
        }
        retries++;
      }
    }
  };
  
  // Real API call to CoinGecko with caching and rate limit handling
  const fetchCryptoData = async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    
    // If force refresh is requested, clear the cache first
    if (forceRefresh) {
      clearCache();
    }
    
    try {
      // Fetch current prices with shorter cache duration (2 minutes)
      const currentPricesData = await fetchWithCache(
        '/api/coingecko/api/v3/simple/price?ids=bitcoin,ethereum,ripple&vs_currencies=usd&include_24hr_change=true',
        'crypto-analyzer-current-prices',
        2 * 60 * 1000 // 2 minutes cache for current prices
      );
      
      // Store current prices in state
      setCurrentPrices(currentPricesData);
      
      // Fetch historical data for the past 30 days
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const fromTimestamp = Math.floor(thirtyDaysAgo.getTime() / 1000);
      const toTimestamp = Math.floor(now.getTime() / 1000);
      
      // Use a single API call to get market data for all three coins
      // This reduces the number of API calls and helps avoid rate limits
      const marketData = await fetchWithCache(
        `/api/coingecko/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum,ripple&order=market_cap_desc&per_page=3&page=1&sparkline=false&price_change_percentage=24h`,
        'crypto-analyzer-market-data'
      );
      
      // Fetch historical data with caching - we still need separate calls for each coin
      // but we'll use longer cache durations since historical data doesn't change frequently
      const btcHistorical = await fetchWithCache(
        `/api/coingecko/api/v3/coins/bitcoin/market_chart/range?vs_currency=usd&from=${fromTimestamp}&to=${toTimestamp}`,
        'crypto-analyzer-btc-historical',
        30 * 60 * 1000 // 30 minutes cache
      );
      
      // Add a small delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const ethHistorical = await fetchWithCache(
        `/api/coingecko/api/v3/coins/ethereum/market_chart/range?vs_currency=usd&from=${fromTimestamp}&to=${toTimestamp}`,
        'crypto-analyzer-eth-historical',
        30 * 60 * 1000 // 30 minutes cache
      );
      
      // Add a small delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const xrpHistorical = await fetchWithCache(
        `/api/coingecko/api/v3/coins/ripple/market_chart/range?vs_currency=usd&from=${fromTimestamp}&to=${toTimestamp}`,
        'crypto-analyzer-xrp-historical',
        30 * 60 * 1000 // 30 minutes cache
      );
      
      // Process and combine the data
      const processedData = [];
      
      // We need to align the timestamps across all three cryptocurrencies
      // Using BTC data as the reference for timestamps
      // Limit to 30 data points for better performance and visualization
      const step = Math.max(1, Math.floor(btcHistorical.prices.length / 30));
      
      for (let i = 0; i < btcHistorical.prices.length; i += step) {
        if (processedData.length >= 30) break;
        
        const timestamp = btcHistorical.prices[i][0];
        const date = new Date(timestamp);
        
        // Find the closest data points for ETH and XRP by timestamp
        const findClosestPrice = (priceArray, targetTimestamp) => {
          return priceArray.reduce((prev, curr) => {
            return (Math.abs(curr[0] - targetTimestamp) < Math.abs(prev[0] - targetTimestamp) ? curr : prev);
          })[1];
        };
        
        const btcPrice = btcHistorical.prices[i][1];
        const ethPrice = findClosestPrice(ethHistorical.prices, timestamp);
        const xrpPrice = findClosestPrice(xrpHistorical.prices, timestamp);
        
        // Calculate ratios
        const ethBtcRatio = ethPrice / btcPrice;
        const xrpBtcRatio = (xrpPrice / btcPrice) * 1000; // Scale for better visualization (reduced from 100k to 1k for more precision)
        
        processedData.push({
          date: date.toISOString().split('T')[0],
          timestamp: timestamp,
          btcPrice: btcPrice,
          ethPrice: ethPrice,
          xrpPrice: xrpPrice,
          ethBtcRatio: ethBtcRatio,
          xrpBtcRatio: xrpBtcRatio,
        });
      }
      
      // Sort by date ascending
      processedData.sort((a, b) => a.timestamp - b.timestamp);
      
      // Add current price as the final point if available
      if (currentPricesData.bitcoin?.usd && currentPricesData.ethereum?.usd && currentPricesData.ripple?.usd) {
        const currentTimestamp = new Date().getTime();
        const btcPrice = currentPricesData.bitcoin.usd;
        const ethPrice = currentPricesData.ethereum.usd;
        const xrpPrice = currentPricesData.ripple.usd;
        
        // Calculate ratios
        const ethBtcRatio = ethPrice / btcPrice;
        const xrpBtcRatio = (xrpPrice / btcPrice) * 1000; // Scale for better visualization
        
        // Add current price data point
        processedData.push({
          date: new Date().toISOString().split('T')[0],
          timestamp: currentTimestamp,
          btcPrice: btcPrice,
          ethPrice: ethPrice,
          xrpPrice: xrpPrice,
          ethBtcRatio: ethBtcRatio,
          xrpBtcRatio: xrpBtcRatio,
        });
        
        console.log('Added current price as final data point');
      }
      
      setData(processedData);
      setLastUpdate(new Date());
      
    } catch (err) {
      console.error('Error fetching data:', err);
      if (err.message.includes('429')) {
        setError('Rate limit exceeded. Please try again in a few minutes or refresh the page.');
      } else {
        setError(`Failed to fetch cryptocurrency data: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCryptoData();
  }, []);

  const getRecommendation = (asset) => {
    if (data.length < 2) return { action: 'HOLD', reason: 'Insufficient data', color: 'text-yellow-600' };
    
    const recent = data.slice(-7); // Last 7 days
    const older = data.slice(-14, -7); // Previous 7 days
    
    const recentAvg = recent.reduce((sum, d) => sum + (asset === 'ETH' ? d.ethBtcRatio : d.xrpBtcRatio), 0) / recent.length;
    const olderAvg = older.reduce((sum, d) => sum + (asset === 'ETH' ? d.ethBtcRatio : d.xrpBtcRatio), 0) / older.length;
    
    const change = ((recentAvg - olderAvg) / olderAvg) * 100;
    const latest = data[data.length - 1];
    const ratioKey = asset === 'ETH' ? 'ethBtcRatio' : 'xrpBtcRatio';
    const currentRatio = latest[ratioKey];
    
    // Simple strategy: sell if ratio has increased significantly and is above recent average
    if (change > 5 && currentRatio > recentAvg * 1.02) {
      return {
        action: 'SELL',
        reason: `${asset} is up ${change.toFixed(1)}% vs BTC over the past week and above average`,
        color: 'text-green-600',
        confidence: Math.min(90, 60 + Math.abs(change))
      };
    } else if (change < -5) {
      return {
        action: 'BUY/HOLD',
        reason: `${asset} is down ${Math.abs(change).toFixed(1)}% vs BTC - may be a buying opportunity`,
        color: 'text-blue-600',
        confidence: Math.min(85, 50 + Math.abs(change))
      };
    } else {
      return {
        action: 'HOLD',
        reason: `${asset} is relatively stable vs BTC (${change > 0 ? '+' : ''}${change.toFixed(1)}%)`,
        color: 'text-yellow-600',
        confidence: 60
      };
    }
  };

  const ethRecommendation = getRecommendation('ETH');
  const xrpRecommendation = getRecommendation('XRP');

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-4" />
          <p className="text-white text-lg">Loading cryptocurrency data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-4" />
          <p className="text-white text-lg mb-4">{error}</p>
          <button 
            onClick={fetchCryptoData}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Crypto Price Analyzer</h1>
          <p className="text-slate-300 text-lg">XRP & Ethereum vs Bitcoin Analysis</p>
          {lastUpdate && (
            <p className="text-slate-400 text-sm mt-2">
              Last updated: {lastUpdate.toLocaleString()}
            </p>
          )}
        </div>

        {/* Recommendations */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                <span className="text-white font-bold">ETH</span>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white">Ethereum</h3>
                <p className="text-slate-400 text-sm">vs Bitcoin</p>
              </div>
            </div>
            <div className={`flex items-center gap-2 mb-3 ${ethRecommendation.color}`}>
              {ethRecommendation.action === 'SELL' ? (
                <TrendingUp className="w-5 h-5" />
              ) : ethRecommendation.action === 'BUY/HOLD' ? (
                <TrendingDown className="w-5 h-5" />
              ) : (
                <AlertCircle className="w-5 h-5" />
              )}
              <span className="font-semibold text-lg">{ethRecommendation.action}</span>
            </div>
            <p className="text-slate-300 text-sm mb-3">{ethRecommendation.reason}</p>
            <div className="bg-slate-700 rounded-full h-2 mb-2">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${ethRecommendation.confidence}%` }}
              ></div>
            </div>
            <p className="text-slate-400 text-xs">Confidence: {ethRecommendation.confidence}%</p>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-orange-600 rounded-full flex items-center justify-center">
                <span className="text-white font-bold">XRP</span>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white">XRP</h3>
                <p className="text-slate-400 text-sm">vs Bitcoin</p>
              </div>
            </div>
            <div className={`flex items-center gap-2 mb-3 ${xrpRecommendation.color}`}>
              {xrpRecommendation.action === 'SELL' ? (
                <TrendingUp className="w-5 h-5" />
              ) : xrpRecommendation.action === 'BUY/HOLD' ? (
                <TrendingDown className="w-5 h-5" />
              ) : (
                <AlertCircle className="w-5 h-5" />
              )}
              <span className="font-semibold text-lg">{xrpRecommendation.action}</span>
            </div>
            <p className="text-slate-300 text-sm mb-3">{xrpRecommendation.reason}</p>
            <div className="bg-slate-700 rounded-full h-2 mb-2">
              <div 
                className="bg-orange-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${xrpRecommendation.confidence}%` }}
              ></div>
            </div>
            <p className="text-slate-400 text-xs">Confidence: {xrpRecommendation.confidence}%</p>
          </div>
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          {/* Price Chart */}
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
            <h3 className="text-xl font-semibold text-white mb-4">Price Comparison (USD)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis 
                  dataKey="date" 
                  stroke="#9CA3AF"
                  fontSize={12}
                  tickFormatter={(value) => new Date(value).toLocaleDateString()}
                />
                <YAxis stroke="#9CA3AF" fontSize={12} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1F2937', 
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#F9FAFB'
                  }}
                  formatter={(value, name) => [
                    `$${typeof value === 'number' ? value.toLocaleString() : value}`,
                    name
                  ]}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="btcPrice" 
                  stroke="#F59E0B" 
                  strokeWidth={2}
                  name="Bitcoin"
                  dot={false}
                />
                <Line 
                  type="monotone" 
                  dataKey="ethPrice" 
                  stroke="#3B82F6" 
                  strokeWidth={2}
                  name="Ethereum"
                  dot={false}
                />
                <Line 
                  type="monotone" 
                  dataKey="xrpPrice" 
                  stroke="#EA580C" 
                  strokeWidth={2}
                  name="XRP"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Ratio Chart */}
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
            <h3 className="text-xl font-semibold text-white mb-4">Ratios vs Bitcoin</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis 
                  dataKey="date" 
                  stroke="#9CA3AF"
                  fontSize={12}
                  tickFormatter={(value) => new Date(value).toLocaleDateString()}
                />
                <YAxis stroke="#9CA3AF" fontSize={12} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1F2937', 
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#F9FAFB'
                  }}
                  formatter={(value, name) => [
                    typeof value === 'number' 
                      ? (name === 'ETH/BTC' 
                          ? value.toFixed(4) 
                          : name === 'XRP/BTC (×1000)' 
                            ? value.toFixed(3) 
                            : value.toFixed(0))
                      : value,
                    name
                  ]}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="ethBtcRatio" 
                  stroke="#3B82F6" 
                  strokeWidth={2}
                  name="ETH/BTC"
                  dot={false}
                />
                <Line 
                  type="monotone" 
                  dataKey="xrpBtcRatio" 
                  stroke="#EA580C" 
                  strokeWidth={2}
                  name="XRP/BTC (×1000)"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Current Prices */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
          <h3 className="text-xl font-semibold text-white mb-4">Current Prices</h3>
          <div className="grid md:grid-cols-3 gap-6">
            <>
              <div className="text-center">
                <div className="w-12 h-12 bg-yellow-600 rounded-full flex items-center justify-center mx-auto mb-2">
                  <span className="text-white font-bold">BTC</span>
                </div>
                <p className="text-slate-400 text-sm">Bitcoin</p>
                <p className="text-2xl font-bold text-white">
                  ${currentPrices.bitcoin?.usd ? currentPrices.bitcoin.usd.toLocaleString() : "Loading..."}
                </p>
                {currentPrices.bitcoin?.usd_24h_change && (
                  <p className={`text-sm ${currentPrices.bitcoin.usd_24h_change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {currentPrices.bitcoin.usd_24h_change >= 0 ? '↑' : '↓'} 
                    {Math.abs(currentPrices.bitcoin.usd_24h_change).toFixed(2)}% (24h)
                  </p>
                )}
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-2">
                  <span className="text-white font-bold">ETH</span>
                </div>
                <p className="text-slate-400 text-sm">Ethereum</p>
                <p className="text-2xl font-bold text-white">
                  ${currentPrices.ethereum?.usd ? currentPrices.ethereum.usd.toLocaleString() : "Loading..."}
                </p>
                {currentPrices.ethereum?.usd_24h_change && (
                  <p className={`text-sm ${currentPrices.ethereum.usd_24h_change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {currentPrices.ethereum.usd_24h_change >= 0 ? '↑' : '↓'} 
                    {Math.abs(currentPrices.ethereum.usd_24h_change).toFixed(2)}% (24h)
                  </p>
                )}
                {data.length > 0 && (
                  <p className="text-slate-400 text-xs mt-1">
                    {(currentPrices.ethereum?.usd / currentPrices.bitcoin?.usd).toFixed(4)} BTC
                  </p>
                )}
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-orange-600 rounded-full flex items-center justify-center mx-auto mb-2">
                  <span className="text-white font-bold">XRP</span>
                </div>
                <p className="text-slate-400 text-sm">XRP</p>
                <p className="text-2xl font-bold text-white">
                  ${currentPrices.ripple?.usd ? currentPrices.ripple.usd.toLocaleString() : "Loading..."}
                </p>
                {currentPrices.ripple?.usd_24h_change && (
                  <p className={`text-sm ${currentPrices.ripple.usd_24h_change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {currentPrices.ripple.usd_24h_change >= 0 ? '↑' : '↓'} 
                    {Math.abs(currentPrices.ripple.usd_24h_change).toFixed(2)}% (24h)
                  </p>
                )}
                <p className="text-slate-400 text-xs mt-1">
                  {currentPrices.ripple?.usd && currentPrices.bitcoin?.usd ? (
                    <>
                      {(currentPrices.ripple.usd / currentPrices.bitcoin.usd).toFixed(8)} BTC
                      <span className="ml-1">
                        (×1000: {((currentPrices.ripple.usd / currentPrices.bitcoin.usd) * 1000).toFixed(3)})
                      </span>
                    </>
                  ) : "Loading..."}
                </p>
              </div>
            </>
          </div>
        </div>

        {/* Refresh Button */}
        <div className="text-center mt-8">
          <button 
            onClick={() => fetchCryptoData(true)} // Force refresh with cache clearing
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white px-8 py-3 rounded-lg transition-colors flex items-center gap-2 mx-auto"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh Data
          </button>
          <p className="text-slate-400 text-xs mt-2">
            Refreshing will clear the cache and fetch the latest data
          </p>
        </div>
      </div>
    </div>
  );
};

export default CryptoPriceAnalyzer;

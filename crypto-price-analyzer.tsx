import { useState, useEffect, useRef, memo } from 'react';
import type { MouseEvent } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, AlertCircle, RefreshCw, Settings, Plus, X } from 'lucide-react';

// Define interfaces for type safety
interface CryptoConfig {
  id: string; // CoinGecko ID
  symbol: string; // Display symbol
  name: string; // Display name
  color: string; // Chart/UI color
  icon?: string; // Optional icon identifier
}

interface CryptoDataPoint {
  date: string;
  timestamp: number;
  btcPrice: number;
  prices: Record<string, number>; // Dynamic crypto prices
  ratios: Record<string, number>; // Dynamic ratios vs BTC
}

interface CryptoPrices {
  bitcoin: { usd: number; usd_24h_change?: number };
  [cryptoId: string]: { usd: number; usd_24h_change?: number };
}

interface Recommendation {
  action: string;
  reason: string;
  color: string;
  confidence: number;
  cryptoId: string;
  symbol: string;
}

interface AutoRefreshConfig {
  enabled: boolean;
  intervalMinutes: number;
  lastRefresh: Date | null;
}

interface RefreshMode {
  mode: 'price-only' | 'smart' | 'full';
  label: string;
  color: string;
  description: string;
}

interface APIBudget {
  callsThisMinute: number;
  resetTime: Date;
  lastRateLimit: Date | null;
  backoffUntil: Date | null;
}

// Default configuration
const DEFAULT_CRYPTOS: CryptoConfig[] = [
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', color: '#3B82F6' },
  { id: 'ripple', symbol: 'XRP', name: 'XRP', color: '#EA580C' }
];

const BITCOIN_CONFIG: CryptoConfig = {
  id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', color: '#F59E0B'
};

// Color palette for additional cryptos
const COLOR_PALETTE = [
  '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#06B6D4', 
  '#84CC16', '#F97316', '#EC4899', '#6366F1', '#14B8A6'
];

// Popular crypto options for selection
const POPULAR_CRYPTOS: CryptoConfig[] = [
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', color: '#3B82F6' },
  { id: 'ripple', symbol: 'XRP', name: 'XRP', color: '#EA580C' },
  { id: 'cardano', symbol: 'ADA', name: 'Cardano', color: '#10B981' },
  { id: 'solana', symbol: 'SOL', name: 'Solana', color: '#8B5CF6' },
  { id: 'polkadot', symbol: 'DOT', name: 'Polkadot', color: '#EF4444' },
  { id: 'chainlink', symbol: 'LINK', name: 'Chainlink', color: '#06B6D4' },
  { id: 'litecoin', symbol: 'LTC', name: 'Litecoin', color: '#84CC16' },
  { id: 'polygon', symbol: 'MATIC', name: 'Polygon', color: '#F97316' },
  { id: 'avalanche-2', symbol: 'AVAX', name: 'Avalanche', color: '#EC4899' },
  { id: 'uniswap', symbol: 'UNI', name: 'Uniswap', color: '#6366F1' }
];

// Auto-refresh interval options with smart API usage
const REFRESH_INTERVALS = [
  { value: 5, label: '5 minutes', description: 'Current prices only (charts update less frequently)' },
  { value: 10, label: '10 minutes', description: 'Current prices only (charts update less frequently)' },
  { value: 15, label: '15 minutes', description: 'Smart updates (balances freshness and API usage)' },
  { value: 30, label: '30 minutes', description: 'Smart updates (balances freshness and API usage)' },
  { value: 60, label: '1 hour', description: 'Full updates (all data refreshed)' },
  { value: 180, label: '3 hours', description: 'Full updates (all data refreshed)' }
];

// API rate limiting constants
const API_LIMITS = {
  CALLS_PER_MINUTE: 10,
  BURST_LIMIT: 3,
  BACKOFF_DURATION: 5 * 60 * 1000, // 5 minutes
  RATE_LIMIT_RETRY_DELAY: 60 * 1000 // 1 minute
};

// Smart refresh mode configuration
const getRefreshMode = (intervalMinutes: number): RefreshMode => {
  if (intervalMinutes <= 10) {
    return {
      mode: 'price-only',
      label: 'Price Only',
      color: 'text-yellow-400',
      description: 'Updates current prices only to minimize API usage'
    };
  }
  if (intervalMinutes <= 30) {
    return {
      mode: 'smart',
      label: 'Smart',
      color: 'text-blue-400', 
      description: 'Balances data freshness with API rate limits'
    };
  }
  return {
    mode: 'full',
    label: 'Full',
    color: 'text-green-400',
    description: 'Refreshes all data including historical charts'
  };
};

// Adaptive cache durations based on refresh interval
const getCacheDuration = (intervalMinutes: number, dataType: 'current' | 'historical'): number => {
  if (dataType === 'current') {
    return intervalMinutes <= 10 ? 2 * 60 * 1000 : 5 * 60 * 1000;
  }
  // Historical data cache
  if (intervalMinutes <= 10) {
    return 60 * 60 * 1000; // 1 hour cache for short intervals
  }
  if (intervalMinutes <= 30) {
    return 45 * 60 * 1000; // 45 min cache for medium intervals
  }
  return 30 * 60 * 1000; // 30 min cache for long intervals
};

// Countdown display component to prevent chart re-renders
const CountdownDisplay = memo(({ countdown, formatCountdown }: { countdown: number; formatCountdown: (seconds: number) => string }) => {
  return (
    <span>{formatCountdown(countdown)}</span>
  );
});

// Memoized chart components to prevent unnecessary re-renders
const PriceChart = memo(({ data, selectedCryptos }: { data: CryptoDataPoint[]; selectedCryptos: CryptoConfig[] }) => {
  return (
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
          {/* Bitcoin line */}
          <Line 
            type="monotone" 
            dataKey="btcPrice" 
            stroke={BITCOIN_CONFIG.color}
            strokeWidth={2}
            name={BITCOIN_CONFIG.name}
            dot={false}
          />
          {/* Dynamic crypto lines */}
          {selectedCryptos.map(crypto => (
            <Line 
              key={crypto.id}
              type="monotone" 
              dataKey={`prices.${crypto.id}`}
              stroke={crypto.color}
              strokeWidth={2}
              name={crypto.name}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
});

const RatioChart = memo(({ data, selectedCryptos }: { data: CryptoDataPoint[]; selectedCryptos: CryptoConfig[] }) => {
  return (
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
                ? (value < 1 ? value.toFixed(6) : value.toFixed(3))
                : value,
              name
            ]}
          />
          <Legend />
          {/* Dynamic ratio lines */}
          {selectedCryptos.map(crypto => {
            const displayName = `${crypto.symbol}/BTC${data.length > 0 && data[0].ratios[crypto.id] > 1 ? ' (×1000)' : ''}`;
            return (
              <Line 
                key={crypto.id}
                type="monotone" 
                dataKey={`ratios.${crypto.id}`}
                stroke={crypto.color}
                strokeWidth={2}
                name={displayName}
                dot={false}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
});

const CryptoPriceAnalyzer = () => {
  const [data, setData] = useState<CryptoDataPoint[]>([]);
  const [currentPrices, setCurrentPrices] = useState<CryptoPrices>({
    bitcoin: { usd: 0 }
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [selectedCryptos, setSelectedCryptos] = useState<CryptoConfig[]>(DEFAULT_CRYPTOS);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [autoRefreshConfig, setAutoRefreshConfig] = useState<AutoRefreshConfig>({
    enabled: false,
    intervalMinutes: 15,
    lastRefresh: null
  });
  const [refreshCountdown, setRefreshCountdown] = useState<number>(0);
  const [apiBudget, setApiBudget] = useState<APIBudget>({
    callsThisMinute: 0,
    resetTime: new Date(Date.now() + 60000),
    lastRateLimit: null,
    backoffUntil: null
  });
  const [lastHistoricalUpdate, setLastHistoricalUpdate] = useState<Date | null>(null);
  const [rotationIndex, setRotationIndex] = useState<number>(0);
  const autoRefreshTimer = useRef<number | null>(null);
  const countdownTimer = useRef<number | null>(null);

  // Configuration management
  const loadConfiguration = (): CryptoConfig[] => {
    // Check URL parameters first
    const urlParams = new URLSearchParams(window.location.search);
    const cryptosParam = urlParams.get('cryptos');
    
    if (cryptosParam) {
      const cryptoIds = cryptosParam.split(',');
      const urlCryptos = cryptoIds.map(id => 
        POPULAR_CRYPTOS.find(crypto => crypto.id === id.trim())
      ).filter(Boolean) as CryptoConfig[];
      
      if (urlCryptos.length > 0) {
        return urlCryptos;
      }
    }
    
    // Check localStorage
    const savedConfig = localStorage.getItem('crypto-analyzer-config');
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {
        console.warn('Failed to parse saved configuration:', e);
      }
    }
    
    // Return default
    return DEFAULT_CRYPTOS;
  };
  
  const saveConfiguration = (cryptos: CryptoConfig[]) => {
    localStorage.setItem('crypto-analyzer-config', JSON.stringify(cryptos));
    setSelectedCryptos(cryptos);
    
    // Update URL without reload
    const url = new URL(window.location.href);
    if (cryptos.length > 0) {
      url.searchParams.set('cryptos', cryptos.map(c => c.id).join(','));
    } else {
      url.searchParams.delete('cryptos');
    }
    window.history.replaceState({}, '', url.toString());
  };
  
  const assignColors = (cryptos: CryptoConfig[]): CryptoConfig[] => {
    return cryptos.map((crypto, index) => ({
      ...crypto,
      color: crypto.color || COLOR_PALETTE[index % COLOR_PALETTE.length]
    }));
  };
  
  // Auto-refresh configuration management
  const loadAutoRefreshConfig = (): AutoRefreshConfig => {
    const saved = localStorage.getItem('crypto-analyzer-autorefresh');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          enabled: parsed.enabled || false,
          intervalMinutes: parsed.intervalMinutes || 15,
          lastRefresh: parsed.lastRefresh ? new Date(parsed.lastRefresh) : null
        };
      } catch (e) {
        console.warn('Failed to parse auto-refresh configuration:', e);
      }
    }
    return {
      enabled: false,
      intervalMinutes: 15,
      lastRefresh: null
    };
  };
  
  const saveAutoRefreshConfig = (config: AutoRefreshConfig) => {
    localStorage.setItem('crypto-analyzer-autorefresh', JSON.stringify(config));
    setAutoRefreshConfig(config);
  };
  
  const formatCountdown = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };
  
  const startAutoRefresh = () => {
    if (autoRefreshTimer.current) {
      clearInterval(autoRefreshTimer.current);
    }
    if (countdownTimer.current) {
      clearInterval(countdownTimer.current);
    }
    
    const intervalMs = autoRefreshConfig.intervalMinutes * 60 * 1000;
    setRefreshCountdown(autoRefreshConfig.intervalMinutes * 60);
    
    // Set up countdown timer (updates every second)
    countdownTimer.current = setInterval(() => {
      setRefreshCountdown(prev => {
        if (prev <= 1) {
          return autoRefreshConfig.intervalMinutes * 60; // Reset countdown
        }
        return prev - 1;
      });
    }, 1000);
    
    // Set up auto-refresh timer
    autoRefreshTimer.current = setInterval(() => {
      fetchCryptoData();
      saveAutoRefreshConfig({
        ...autoRefreshConfig,
        lastRefresh: new Date()
      });
    }, intervalMs);
  };
  
  const stopAutoRefresh = () => {
    if (autoRefreshTimer.current) {
      clearInterval(autoRefreshTimer.current);
      autoRefreshTimer.current = null;
    }
    if (countdownTimer.current) {
      clearInterval(countdownTimer.current);
      countdownTimer.current = null;
    }
    setRefreshCountdown(0);
  };
  
  const toggleAutoRefresh = (enabled: boolean) => {
    const newConfig = {
      ...autoRefreshConfig,
      enabled,
      lastRefresh: enabled ? new Date() : autoRefreshConfig.lastRefresh
    };
    
    saveAutoRefreshConfig(newConfig);
    
    if (enabled) {
      startAutoRefresh();
    } else {
      stopAutoRefresh();
    }
  };
  
  const setAutoRefreshInterval = (intervalMinutes: number) => {
    const newConfig = {
      ...autoRefreshConfig,
      intervalMinutes
    };
    
    saveAutoRefreshConfig(newConfig);
    
    // Restart timer with new interval if currently enabled
    if (autoRefreshConfig.enabled) {
      stopAutoRefresh();
      startAutoRefresh();
    }
  };
  
  // Smart API management functions
  const trackAPICall = () => {
    const now = new Date();
    setApiBudget(prev => {
      // Reset counter if a minute has passed
      if (now > prev.resetTime) {
        return {
          ...prev,
          callsThisMinute: 1,
          resetTime: new Date(now.getTime() + 60000)
        };
      }
      return {
        ...prev,
        callsThisMinute: prev.callsThisMinute + 1
      };
    });
  };
  
  const isRateLimited = (): boolean => {
    const now = new Date();
    if (apiBudget.backoffUntil && now < apiBudget.backoffUntil) {
      return true;
    }
    return apiBudget.callsThisMinute >= API_LIMITS.CALLS_PER_MINUTE;
  };
  
  const handleRateLimit = (error: any) => {
    if (error && ((error as any).status === 429 || error.message?.includes('429'))) {
      const now = new Date();
      const backoffUntil = new Date(now.getTime() + API_LIMITS.BACKOFF_DURATION);
      
      setApiBudget(prev => ({
        ...prev,
        lastRateLimit: now,
        backoffUntil
      }));
      
      // Auto-adjust to longer interval if using short intervals
      if (autoRefreshConfig.intervalMinutes <= 10) {
        const newInterval = 15;
        setError(`Rate limit detected. Auto-adjusting refresh interval to ${newInterval} minutes.`);
        setAutoRefreshInterval(newInterval);
      } else {
        setError('Rate limit detected. Please try again in a few minutes.');
      }
      
      return true;
    }
    return false;
  };
  
  const shouldUpdateHistoricalData = (intervalMinutes: number): boolean => {
    if (intervalMinutes <= 10) {
      // For short intervals, only update historical data every 30 minutes
      if (!lastHistoricalUpdate) return true;
      const timeSinceUpdate = Date.now() - lastHistoricalUpdate.getTime();
      return timeSinceUpdate > 30 * 60 * 1000;
    }
    
    if (intervalMinutes <= 30) {
      // For medium intervals, update every 3rd cycle
      return rotationIndex % 3 === 0;
    }
    
    // For long intervals, always update
    return true;
  };
  
  const getNextCryptoForRotation = (): CryptoConfig | null => {
    if (selectedCryptos.length === 0) return null;
    const crypto = selectedCryptos[rotationIndex % selectedCryptos.length];
    setRotationIndex(prev => prev + 1);
    return crypto;
  };

  // Clear all cache data
  const clearCache = () => {
    localStorage.removeItem('crypto-analyzer-current-prices');
    localStorage.removeItem('crypto-analyzer-market-data');
    localStorage.removeItem('crypto-analyzer-btc-historical');
    
    // Clear cache for all selected cryptos
    selectedCryptos.forEach(crypto => {
      localStorage.removeItem(`crypto-analyzer-${crypto.id}-historical`);
    });
    
    console.log('Cache cleared');
  };

  // Enhanced helper function for API calls with smart rate limiting
  const fetchWithCache = async (url: string, cacheKey: string, cacheDuration = 5 * 60 * 1000, skipRateLimit = false) => {
    // Check rate limiting first (unless skipped for cached data)
    if (!skipRateLimit && isRateLimited()) {
      console.log('Rate limited, using cached data if available');
      const cachedData = localStorage.getItem(cacheKey);
      if (cachedData) {
        const { data } = JSON.parse(cachedData);
        return data;
      }
      throw new Error('Rate limited and no cached data available');
    }
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
        
        // Track API call before making request
        if (!skipRateLimit) {
          trackAPICall();
        }
        
        const response = await fetch(url);
        
        if (response.status === 429) {
          console.log('Rate limit hit, handling...');
          const rateLimitError = new Error('Rate limit exceeded');
          (rateLimitError as any).status = 429;
          throw rateLimitError;
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
  
  // Smart API refresh with tiered data fetching
  const fetchCryptoData = async (forceRefresh = false): Promise<void> => {
    setLoading(true);
    setError(null);
    
    // If force refresh is requested, clear the cache first
    if (forceRefresh) {
      clearCache();
    }
    
    try {
      const intervalMinutes = autoRefreshConfig.intervalMinutes;
      const refreshMode = getRefreshMode(intervalMinutes);
      
      console.log(`Smart refresh: ${refreshMode.mode} mode (${intervalMinutes}min interval)`);
      
      // Always fetch current prices - this is lightweight
      const allCryptoIds = ['bitcoin', ...selectedCryptos.map(c => c.id)];
      const cryptoIdsString = allCryptoIds.join(',');
      
      const currentPricesData = await fetchWithCache(
        `/api/coingecko/api/v3/simple/price?ids=${cryptoIdsString}&vs_currencies=usd&include_24hr_change=true`,
        'crypto-analyzer-current-prices',
        getCacheDuration(intervalMinutes, 'current')
      );
      
      setCurrentPrices(currentPricesData);
      
      // Smart historical data fetching based on interval
      let shouldFetchHistorical = shouldUpdateHistoricalData(intervalMinutes);
      
      if (refreshMode.mode === 'price-only') {
        // For short intervals, only update historical data if it's been a while
        shouldFetchHistorical = shouldFetchHistorical && (!lastHistoricalUpdate || 
          Date.now() - lastHistoricalUpdate.getTime() > 30 * 60 * 1000);
      }
      
      let historicalData: Record<string, any> = {};
      
      if (shouldFetchHistorical) {
        console.log(`Fetching historical data (${refreshMode.mode} mode)`);
        
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const fromTimestamp = Math.floor(thirtyDaysAgo.getTime() / 1000);
        const toTimestamp = Math.floor(now.getTime() / 1000);
        
        // Always fetch BTC historical data
        const btcHistorical = await fetchWithCache(
          `/api/coingecko/api/v3/coins/bitcoin/market_chart/range?vs_currency=usd&from=${fromTimestamp}&to=${toTimestamp}`,
          'crypto-analyzer-btc-historical',
          getCacheDuration(intervalMinutes, 'historical')
        );
        
        historicalData.bitcoin = btcHistorical;
        
        if (refreshMode.mode === 'smart') {
          // For smart mode, rotate which crypto gets updated
          const cryptoToUpdate = getNextCryptoForRotation();
          if (cryptoToUpdate) {
            console.log(`Rotating update: ${cryptoToUpdate.symbol}`);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting delay
            
            const cryptoHistorical = await fetchWithCache(
              `/api/coingecko/api/v3/coins/${cryptoToUpdate.id}/market_chart/range?vs_currency=usd&from=${fromTimestamp}&to=${toTimestamp}`,
              `crypto-analyzer-${cryptoToUpdate.id}-historical`,
              getCacheDuration(intervalMinutes, 'historical')
            );
            
            historicalData[cryptoToUpdate.id] = cryptoHistorical;
          }
          
          // Load cached data for other cryptos
          for (const crypto of selectedCryptos) {
            if (crypto.id !== cryptoToUpdate?.id) {
              const cached = localStorage.getItem(`crypto-analyzer-${crypto.id}-historical`);
              if (cached) {
                const { data } = JSON.parse(cached);
                historicalData[crypto.id] = data;
              }
            }
          }
        } else if (refreshMode.mode === 'full') {
          // For full mode, fetch all historical data
          for (const crypto of selectedCryptos) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting delay
            
            const cryptoHistorical = await fetchWithCache(
              `/api/coingecko/api/v3/coins/${crypto.id}/market_chart/range?vs_currency=usd&from=${fromTimestamp}&to=${toTimestamp}`,
              `crypto-analyzer-${crypto.id}-historical`,
              getCacheDuration(intervalMinutes, 'historical')
            );
            
            historicalData[crypto.id] = cryptoHistorical;
          }
        }
        
        setLastHistoricalUpdate(new Date());
      } else {
        // Load all historical data from cache
        console.log('Using cached historical data');
        ['bitcoin', ...selectedCryptos.map(c => c.id)].forEach(cryptoId => {
          const cached = localStorage.getItem(`crypto-analyzer-${cryptoId}-historical`);
          if (cached) {
            const { data } = JSON.parse(cached);
            historicalData[cryptoId] = data;
          }
        });
      }
      
      // Process chart data intelligently
      if (historicalData.bitcoin?.prices) {
        // Full chart data processing when we have fresh historical data
        const processedData = processChartData(historicalData, currentPricesData);
        setData(processedData);
      } else if (data.length > 0) {
        // Preserve existing chart data and update current price point only
        const updatedData = updateCurrentPriceInExistingData(data, currentPricesData);
        setData(updatedData);
        console.log('Preserved historical data, updated current prices only');
      } else {
        // No existing data and no historical data - this shouldn't happen in normal operation
        console.warn('No historical or existing chart data available');
      }
      
      setLastUpdate(new Date());
      
      // Generate recommendations
      const newRecommendations = selectedCryptos.map(crypto => 
        getRecommendation(crypto.id, crypto.symbol)
      );
      setRecommendations(newRecommendations);
      
    } catch (err: unknown) {
      console.error('Error fetching data:', err);
      
      // Handle rate limiting with smart backoff
      if (handleRateLimit(err)) {
        return; // Error message set by handleRateLimit
      }
      
      setError(`Failed to fetch cryptocurrency data: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Helper function to process chart data
  const processChartData = (historicalData: Record<string, any>, currentPricesData: CryptoPrices): CryptoDataPoint[] => {
    const processedData: CryptoDataPoint[] = [];
    const btcHistorical = historicalData.bitcoin;
    
    if (!btcHistorical?.prices) return [];
    
    const step = Math.max(1, Math.floor(btcHistorical.prices.length / 30));
    
    const findClosestPrice = (priceArray: [number, number][], targetTimestamp: number): number => {
      return priceArray.reduce((prev, curr) => {
        return (Math.abs(curr[0] - targetTimestamp) < Math.abs(prev[0] - targetTimestamp) ? curr : prev);
      })[1];
    };
    
    for (let i = 0; i < btcHistorical.prices.length; i += step) {
      if (processedData.length >= 30) break;
      
      const timestamp = btcHistorical.prices[i][0];
      const date = new Date(timestamp);
      const btcPrice = btcHistorical.prices[i][1];
      
      const prices: Record<string, number> = { bitcoin: btcPrice };
      const ratios: Record<string, number> = {};
      
      for (const crypto of selectedCryptos) {
        const cryptoHistorical = historicalData[crypto.id];
        if (cryptoHistorical?.prices) {
          const cryptoPrice = findClosestPrice(cryptoHistorical.prices, timestamp);
          prices[crypto.id] = cryptoPrice;
          
          let ratio = cryptoPrice / btcPrice;
          if (ratio < 0.01) {
            ratio *= 1000;
          }
          ratios[crypto.id] = ratio;
        }
      }
      
      processedData.push({
        date: date.toISOString().split('T')[0],
        timestamp: timestamp,
        btcPrice: btcPrice,
        prices: prices,
        ratios: ratios,
      });
    }
    
    processedData.sort((a, b) => a.timestamp - b.timestamp);
    
    // Add current price as final point
    if (currentPricesData.bitcoin?.usd) {
      const currentTimestamp = new Date().getTime();
      const btcPrice = currentPricesData.bitcoin.usd;
      const prices: Record<string, number> = { bitcoin: btcPrice };
      const ratios: Record<string, number> = {};
      
      let hasAllCurrentPrices = true;
      for (const crypto of selectedCryptos) {
        if (currentPricesData[crypto.id]?.usd) {
          const cryptoPrice = currentPricesData[crypto.id].usd;
          prices[crypto.id] = cryptoPrice;
          
          let ratio = cryptoPrice / btcPrice;
          if (ratio < 0.01) {
            ratio *= 1000;
          }
          ratios[crypto.id] = ratio;
        } else {
          hasAllCurrentPrices = false;
          break;
        }
      }
      
      if (hasAllCurrentPrices) {
        processedData.push({
          date: new Date().toISOString().split('T')[0],
          timestamp: currentTimestamp,
          btcPrice: btcPrice,
          prices: prices,
          ratios: ratios,
        });
      }
    }
    
    return processedData;
  };
  
  // Helper function to update only the current price in existing chart data
  const updateCurrentPriceInExistingData = (existingData: CryptoDataPoint[], currentPricesData: CryptoPrices): CryptoDataPoint[] => {
    if (!currentPricesData.bitcoin?.usd || existingData.length === 0) {
      return existingData;
    }
    
    // Remove the last data point if it's a current price point (not historical)
    let dataToKeep = [...existingData];
    const lastPoint = dataToKeep[dataToKeep.length - 1];
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    // If the last point is from today and is very recent, it's likely a current price point
    if (lastPoint.date === today && now.getTime() - lastPoint.timestamp < 24 * 60 * 60 * 1000) {
      const timeDiff = now.getTime() - lastPoint.timestamp;
      // If the last point is less than 6 hours old, consider it a current price point
      if (timeDiff < 6 * 60 * 60 * 1000) {
        dataToKeep = dataToKeep.slice(0, -1);
      }
    }
    
    // Add new current price point
    const currentTimestamp = new Date().getTime();
    const btcPrice = currentPricesData.bitcoin.usd;
    const prices: Record<string, number> = { bitcoin: btcPrice };
    const ratios: Record<string, number> = {};
    
    let hasAllCurrentPrices = true;
    for (const crypto of selectedCryptos) {
      if (currentPricesData[crypto.id]?.usd) {
        const cryptoPrice = currentPricesData[crypto.id].usd;
        prices[crypto.id] = cryptoPrice;
        
        let ratio = cryptoPrice / btcPrice;
        if (ratio < 0.01) {
          ratio *= 1000;
        }
        ratios[crypto.id] = ratio;
      } else {
        hasAllCurrentPrices = false;
        break;
      }
    }
    
    if (hasAllCurrentPrices) {
      dataToKeep.push({
        date: today,
        timestamp: currentTimestamp,
        btcPrice: btcPrice,
        prices: prices,
        ratios: ratios,
      });
    }
    
    return dataToKeep;
  };

  useEffect(() => {
    // Load configuration on component mount
    const config = loadConfiguration();
    const configWithColors = assignColors(config);
    setSelectedCryptos(configWithColors);
    
    // Load auto-refresh configuration
    const autoRefreshConfig = loadAutoRefreshConfig();
    setAutoRefreshConfig(autoRefreshConfig);
  }, []);
  
  useEffect(() => {
    // Fetch data when selected cryptos change
    if (selectedCryptos.length > 0) {
      fetchCryptoData();
    }
  }, [selectedCryptos]);
  
  useEffect(() => {
    // Manage auto-refresh timer
    if (autoRefreshConfig.enabled) {
      startAutoRefresh();
    } else {
      stopAutoRefresh();
    }
    
    // Cleanup on unmount
    return () => {
      stopAutoRefresh();
    };
  }, [autoRefreshConfig.enabled, autoRefreshConfig.intervalMinutes]);

  const getRecommendation = (cryptoId: string, symbol: string): Recommendation => {
    if (data.length < 2) {
      return { 
        action: 'HOLD', 
        reason: 'Insufficient data', 
        color: 'text-yellow-600', 
        confidence: 60,
        cryptoId,
        symbol
      };
    }
    
    const recent = data.slice(-7); // Last 7 days
    const older = data.slice(-14, -7); // Previous 7 days
    
    // Calculate averages for the specific crypto
    const recentAvg = recent.reduce((sum, d) => {
      return sum + (d.ratios[cryptoId] || 0);
    }, 0) / recent.length;
    
    const olderAvg = older.reduce((sum, d) => {
      return sum + (d.ratios[cryptoId] || 0);
    }, 0) / older.length;
    
    if (olderAvg === 0) {
      return {
        action: 'HOLD',
        reason: 'Insufficient historical data',
        color: 'text-yellow-600',
        confidence: 50,
        cryptoId,
        symbol
      };
    }
    
    const change = ((recentAvg - olderAvg) / olderAvg) * 100;
    const latest = data[data.length - 1];
    const currentRatio = latest.ratios[cryptoId] || 0;
    
    // Simple strategy: sell if ratio has increased significantly and is above recent average
    if (change > 5 && currentRatio > recentAvg * 1.02) {
      return {
        action: 'SELL',
        reason: `${symbol} is up ${change.toFixed(1)}% vs BTC over the past week and above average`,
        color: 'text-green-600',
        confidence: Math.min(90, 60 + Math.abs(change)),
        cryptoId,
        symbol
      };
    } else if (change < -5) {
      return {
        action: 'BUY/HOLD',
        reason: `${symbol} is down ${Math.abs(change).toFixed(1)}% vs BTC - may be a buying opportunity`,
        color: 'text-blue-600',
        confidence: Math.min(85, 50 + Math.abs(change)),
        cryptoId,
        symbol
      };
    } else {
      return {
        action: 'HOLD',
        reason: `${symbol} is relatively stable vs BTC (${change > 0 ? '+' : ''}${change.toFixed(1)}%)`,
        color: 'text-yellow-600',
        confidence: 60,
        cryptoId,
        symbol
      };
    }
  };

  // Recommendations are now generated dynamically in fetchCryptoData

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
            onClick={(e: MouseEvent<HTMLButtonElement>) => {
              e.preventDefault();
              fetchCryptoData();
            }}
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
        <div className="text-center mb-8 relative">
          <div className="flex justify-between items-start mb-4">
            <div></div>
            <div className="text-center flex-1">
              <h1 className="text-4xl font-bold text-white mb-2">Crypto Price Analyzer</h1>
              <p className="text-slate-300 text-lg">
                {selectedCryptos.map(c => c.symbol).join(' & ')} vs Bitcoin Analysis
              </p>
              {lastUpdate && (
                <p className="text-slate-400 text-sm mt-2">
                  Last updated: {lastUpdate.toLocaleString()}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {autoRefreshConfig.enabled && (
                <div className="text-slate-400 text-xs text-right">
                  <div className="flex items-center gap-1 justify-end">
                    <span>Auto-refresh:</span>
                    <span className={`${getRefreshMode(autoRefreshConfig.intervalMinutes).color} font-medium`}>
                      {getRefreshMode(autoRefreshConfig.intervalMinutes).label}
                    </span>
                  </div>
                  <div>Next: <CountdownDisplay countdown={refreshCountdown} formatCountdown={formatCountdown} /></div>
                </div>
              )}
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="bg-slate-700 hover:bg-slate-600 text-white p-2 rounded-lg transition-colors flex-shrink-0"
                title="Settings"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700 mb-8">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-white">Settings</h3>
              <button
                onClick={() => setShowSettings(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Auto Refresh Section */}
            <div className="mb-6 border-b border-slate-600 pb-4">
              <h4 className="text-lg font-medium text-white mb-3">Auto Refresh</h4>
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div style={{ flexGrow: 1, marginRight: '16px' }}>
                    <p className="text-slate-300 text-sm">Enable automatic data refresh</p>
                    {autoRefreshConfig.enabled && (
                      <p className="text-slate-400 text-xs mt-1">
                        Next refresh in: <CountdownDisplay countdown={refreshCountdown} formatCountdown={formatCountdown} />
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => toggleAutoRefresh(!autoRefreshConfig.enabled)}
                    className={`relative inline-flex items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-800 ${
                      autoRefreshConfig.enabled ? 'bg-blue-600' : 'bg-slate-600'
                    }`}
                    style={{ 
                      width: '44px', 
                      height: '24px',
                      minWidth: '44px',
                      flexShrink: 0
                    }}
                    type="button"
                    role="switch"
                    aria-checked={autoRefreshConfig.enabled}
                    aria-label="Toggle auto-refresh"
                  >
                    <span
                      className="inline-block rounded-full bg-white shadow-lg transition-transform duration-200 ease-in-out"
                      style={{
                        width: '16px',
                        height: '16px',
                        transform: autoRefreshConfig.enabled ? 'translateX(24px)' : 'translateX(4px)'
                      }}
                    />
                  </button>
                </div>
                
                {autoRefreshConfig.enabled && (
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <p className="text-slate-300 text-sm">Refresh interval:</p>
                        <span className={`text-xs px-2 py-1 rounded-full ${getRefreshMode(autoRefreshConfig.intervalMinutes).color} bg-slate-700`}>
                          {getRefreshMode(autoRefreshConfig.intervalMinutes).label} Mode
                        </span>
                      </div>
                      <select
                        value={autoRefreshConfig.intervalMinutes}
                        onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
                        className="bg-slate-700 text-white rounded-lg px-3 py-2 text-sm border border-slate-600 focus:border-blue-500 focus:outline-none w-full"
                      >
                        {REFRESH_INTERVALS.map(interval => (
                          <option key={interval.value} value={interval.value}>
                            {interval.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="bg-slate-700/30 rounded-lg p-3">
                      <p className="text-slate-400 text-xs mb-1">Current mode:</p>
                      <p className={`text-xs ${getRefreshMode(autoRefreshConfig.intervalMinutes).color} font-medium`}>
                        {getRefreshMode(autoRefreshConfig.intervalMinutes).description}
                      </p>
                      {apiBudget.backoffUntil && new Date() < apiBudget.backoffUntil && (
                        <p className="text-orange-400 text-xs mt-2">
                          ⚠️ Rate limited - backing off until {apiBudget.backoffUntil.toLocaleTimeString()}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="mb-4">
              <h4 className="text-lg font-medium text-white mb-3">Cryptocurrency Selection</h4>
              <p className="text-slate-300 mb-3">Selected cryptocurrencies to compare with Bitcoin:</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {selectedCryptos.map((crypto, index) => (
                  <div key={crypto.id} className="bg-slate-700 rounded-lg px-3 py-2 flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: crypto.color }}
                    ></div>
                    <span className="text-white text-sm">{crypto.symbol}</span>
                    <span className="text-slate-400 text-xs">{crypto.name}</span>
                    <button
                      onClick={() => {
                        const newCryptos = selectedCryptos.filter((_, i) => i !== index);
                        saveConfiguration(newCryptos);
                      }}
                      className="text-slate-400 hover:text-red-400 transition-colors ml-2"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="mb-4">
              <p className="text-slate-300 mb-3">Add cryptocurrency:</p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                {POPULAR_CRYPTOS.filter(crypto => 
                  !selectedCryptos.some(selected => selected.id === crypto.id)
                ).map(crypto => (
                  <button
                    key={crypto.id}
                    onClick={() => {
                      const newCryptos = [...selectedCryptos, crypto];
                      const cryptosWithColors = assignColors(newCryptos);
                      saveConfiguration(cryptosWithColors);
                    }}
                    className="bg-slate-700 hover:bg-slate-600 rounded-lg px-3 py-2 text-left transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Plus className="w-3 h-3 text-slate-400" />
                      <div>
                        <div className="text-white text-sm font-medium">{crypto.symbol}</div>
                        <div className="text-slate-400 text-xs">{crypto.name}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  saveConfiguration(DEFAULT_CRYPTOS);
                  setShowSettings(false);
                }}
                className="bg-slate-600 hover:bg-slate-500 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Reset to Default
              </button>
              <button
                onClick={() => setShowSettings(false)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* Recommendations */}
        <div className={`grid gap-6 mb-8 ${
          recommendations.length === 1 ? 'grid-cols-1 max-w-md mx-auto' :
          recommendations.length === 2 ? 'md:grid-cols-2' :
          recommendations.length === 3 ? 'md:grid-cols-2 lg:grid-cols-3' :
          'md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
        }`}>
          {recommendations.map((recommendation) => {
            const crypto = selectedCryptos.find(c => c.id === recommendation.cryptoId);
            if (!crypto) return null;
            
            return (
              <div key={crypto.id} className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
                <div className="flex items-center gap-3 mb-4">
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: crypto.color }}
                  >
                    <span className="text-white font-bold text-sm">{crypto.symbol}</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-white">{crypto.name}</h3>
                    <p className="text-slate-400 text-sm">vs Bitcoin</p>
                  </div>
                </div>
                <div className={`flex items-center gap-2 mb-3 ${recommendation.color}`}>
                  {recommendation.action === 'SELL' ? (
                    <TrendingUp className="w-5 h-5" />
                  ) : recommendation.action === 'BUY/HOLD' ? (
                    <TrendingDown className="w-5 h-5" />
                  ) : (
                    <AlertCircle className="w-5 h-5" />
                  )}
                  <span className="font-semibold text-lg">{recommendation.action}</span>
                </div>
                <p className="text-slate-300 text-sm mb-3">{recommendation.reason}</p>
                <div className="bg-slate-700 rounded-full h-2 mb-2">
                  <div 
                    className="h-2 rounded-full transition-all duration-500"
                    style={{ 
                      width: `${recommendation.confidence}%`,
                      backgroundColor: crypto.color
                    }}
                  ></div>
                </div>
                <p className="text-slate-400 text-xs">Confidence: {recommendation.confidence}%</p>
              </div>
            );
          })}
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          <PriceChart data={data} selectedCryptos={selectedCryptos} />
          <RatioChart data={data} selectedCryptos={selectedCryptos} />
        </div>

        {/* Current Prices */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
          <h3 className="text-xl font-semibold text-white mb-4">Current Prices</h3>
          <div className={`grid gap-6 ${
            selectedCryptos.length + 1 <= 3 ? 'md:grid-cols-3' :
            selectedCryptos.length + 1 <= 4 ? 'md:grid-cols-2 lg:grid-cols-4' :
            'md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'
          }`}>
            {/* Bitcoin */}
            <div className="text-center">
              <div 
                className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2"
                style={{ backgroundColor: BITCOIN_CONFIG.color }}
              >
                <span className="text-white font-bold">{BITCOIN_CONFIG.symbol}</span>
              </div>
              <p className="text-slate-400 text-sm">{BITCOIN_CONFIG.name}</p>
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
            
            {/* Dynamic crypto prices */}
            {selectedCryptos.map(crypto => (
              <div key={crypto.id} className="text-center">
                <div 
                  className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2"
                  style={{ backgroundColor: crypto.color }}
                >
                  <span className="text-white font-bold text-sm">{crypto.symbol}</span>
                </div>
                <p className="text-slate-400 text-sm">{crypto.name}</p>
                <p className="text-2xl font-bold text-white">
                  ${currentPrices[crypto.id]?.usd ? currentPrices[crypto.id].usd.toLocaleString() : "Loading..."}
                </p>
                {currentPrices[crypto.id]?.usd_24h_change !== undefined && (
                  <p className={`text-sm ${currentPrices[crypto.id].usd_24h_change! >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {currentPrices[crypto.id].usd_24h_change! >= 0 ? '↑' : '↓'} 
                    {Math.abs(currentPrices[crypto.id].usd_24h_change!).toFixed(2)}% (24h)
                  </p>
                )}
                {currentPrices[crypto.id]?.usd && currentPrices.bitcoin?.usd && (
                  <p className="text-slate-400 text-xs mt-1">
                    {(currentPrices[crypto.id].usd / currentPrices.bitcoin.usd).toFixed(8)} BTC
                    {(currentPrices[crypto.id].usd / currentPrices.bitcoin.usd) < 0.01 && (
                      <span className="ml-1">
                        (×1000: {((currentPrices[crypto.id].usd / currentPrices.bitcoin.usd) * 1000).toFixed(3)})
                      </span>
                    )}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Refresh Button */}
        <div className="text-center mt-8">
          <button 
            onClick={(e: MouseEvent<HTMLButtonElement>) => {
              e.preventDefault();
              fetchCryptoData(true);
              if (autoRefreshConfig.enabled) {
                // Reset the auto-refresh timer after manual refresh
                stopAutoRefresh();
                startAutoRefresh();
              }
            }}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white px-8 py-3 rounded-lg transition-colors flex items-center gap-2 mx-auto"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh Data
          </button>
          <div className="text-slate-400 text-xs mt-2 space-y-1">
            <p>Refreshing will clear the cache and fetch the latest data</p>
            {autoRefreshConfig.enabled && (
              <div className="text-blue-400 space-y-1">
                <p>
                  Auto-refresh: Every {REFRESH_INTERVALS.find(i => i.value === autoRefreshConfig.intervalMinutes)?.label} 
                  <span className={`ml-2 ${getRefreshMode(autoRefreshConfig.intervalMinutes).color}`}>
                    ({getRefreshMode(autoRefreshConfig.intervalMinutes).label} Mode)
                  </span>
                </p>
                <p>
                  Next: <CountdownDisplay countdown={refreshCountdown} formatCountdown={formatCountdown} />
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CryptoPriceAnalyzer;

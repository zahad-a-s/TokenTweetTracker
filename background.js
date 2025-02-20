const CMC_API_BASE = 'https://pro-api.coinmarketcap.com/v1';
const CMC_HISTORICAL_BASE = 'https://pro-api.coinmarketcap.com/v2';
const cache = new Map();

// Cache for CMC IDs
let cmcIdCache = {
    ids: {},  // symbol -> id mapping
    lastUpdate: 0,
    CACHE_DURATION: 24 * 60 * 60 * 1000  // 24 hours in milliseconds
};

// Cache for price data
let priceCache = {
    data: {},  // Format: {symbol: {timestamp: {price, high, low}}}
    CACHE_DURATION: 5 * 60 * 1000  // 5 minutes in milliseconds
};

let CMC_API_KEY = null;

async function getApiKey() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(['cmcApiKey'], function(result) {
            CMC_API_KEY = result.cmcApiKey;
            resolve(result.cmcApiKey);
        });
    });
}

async function fetchCoinId(tokenSymbol, apiKey) {
    console.log('fetchCoinId called with tokenSymbol:', tokenSymbol, 'apiKey:', apiKey);
    const cacheKey = `coinId:${tokenSymbol}`;
    if (cache.has(cacheKey)) {
        console.log('fetchCoinId: Returning cached coin ID:', cache.get(cacheKey));
        return cache.get(cacheKey);
    }

    const url = `${CMC_API_BASE}/cryptocurrency/map?symbol=${tokenSymbol}`;
    console.log('fetchCoinId: Fetching URL:', url);
    try {
        const response = await fetch(url, {
            headers: {
                'X-CMC_PRO_API_KEY': apiKey,
                'Accept': 'application/json'
            }
        });
        console.log('fetchCoinId: API response:', response);

        if (!response.ok) {
            let errorMessage = `Failed to fetch coin ID: ${response.status} ${response.statusText}`;
            try {
                const errorData = await response.json();
                if (errorData && errorData.status && errorData.status.error_message) {
                    errorMessage += ` - ${errorData.status.error_message}`;
                }
            } catch (e) {
                console.error("Error parsing error response:", e);
            }
            console.error('fetchCoinId: Error:', errorMessage);
            throw new Error(errorMessage);
        }

        const data = await response.json();
        console.log('fetchCoinId: API response data:', data);
        if (data.data && data.data.length > 0) {
            const coinInfo = data.data[0];
            const coinId = coinInfo.id;
            cache.set(cacheKey, coinId);
            console.log('fetchCoinId: Returning coin ID:', coinId);
            return coinId;
        } else {
            const errorMessage = `Coin ID not found for symbol: ${tokenSymbol}`;
            console.error('fetchCoinId: Error:', errorMessage);
            throw new Error(errorMessage);
        }

    } catch (error) {
        console.error("Error fetching coin ID:", error);
        throw error;
    }
}

async function fetchHistoricalQuote(coinId, timestamp, apiKey) {
    console.log('fetchHistoricalQuote called with coinId:', coinId, 'timestamp:', timestamp, 'apiKey:', apiKey);
    const cacheKey = `historical:${coinId}:${timestamp}`;
    if (cache.has(cacheKey)) {
        console.log('fetchHistoricalQuote: Returning cached historical quote:', cache.get(cacheKey));
        return cache.get(cacheKey);
    }

    // Wider time window, smaller interval, NO count
    const time_start = timestamp - (12 * 60 * 60); // 12 hours before
    const time_end = timestamp + (12 * 60 * 60);   // 12 hours after
    const interval = '5m'; // 5-minute interval

    const url = `${CMC_HISTORICAL_BASE}/cryptocurrency/quotes/historical?id=${coinId}&time_start=${time_start}&time_end=${time_end}&interval=${interval}`;
    console.log('fetchHistoricalQuote: Fetching URL:', url);

    try {
        const response = await fetch(url, {
            headers: {
                'X-CMC_PRO_API_KEY': apiKey,
                'Accept': 'application/json'
            }
        });
        console.log('fetchHistoricalQuote: API response:', response);

        if (!response.ok) {
            let errorMessage = `Failed to fetch historical quote: ${response.status} ${response.statusText}`;
            try {
                const errorData = await response.json();
                if (errorData && errorData.status && errorData.status.error_message) {
                    errorMessage += ` - ${errorData.status.error_message}`;
                }
            } catch (e) {
                console.error("Error parsing error response:", e);
            }
            console.error('fetchHistoricalQuote: Error:', errorMessage);
            throw new Error(errorMessage);
        }

        const data = await response.json();
        console.log('fetchHistoricalQuote: Raw API response data:', JSON.stringify(data, null, 2)); // Log raw JSON

        if (data.data && data.data.quotes && data.data.quotes.length > 0) {
            const quotes = data.data.quotes;
            let closestQuote = null;
            let minTimeDiff = Infinity;
            let highPrice = -Infinity;
            let lowPrice = Infinity;

            // Find closest quote and high/low
            for (const quote of quotes) {
                const quoteTimestamp = new Date(quote.timestamp).getTime() / 1000;
                const timeDiff = Math.abs(quoteTimestamp - timestamp);

                if (timeDiff < minTimeDiff) {
                    minTimeDiff = timeDiff;
                    closestQuote = quote;
                }

                highPrice = Math.max(highPrice, quote.quote.USD.price);
                lowPrice = Math.min(lowPrice, quote.quote.USD.price);
            }

            if (!closestQuote) {
                console.error('fetchHistoricalQuote: No closest quote found, even with data.');
                throw new Error('No closest quote found');
            }

            console.log('fetchHistoricalQuote: Closest quote:', closestQuote);
            console.log('fetchHistoricalQuote: High price:', highPrice, 'Low price:', lowPrice);

            const result = {
                historicalPrice: closestQuote.quote.USD.price,
                highPrice: highPrice,
                lowPrice: lowPrice,
                closestTimestamp: closestQuote.timestamp // ISO 8601 string
            };
            cache.set(cacheKey, result);
            return result;

        } else {
            console.error('fetchHistoricalQuote: No historical data found in API response.');
            throw new Error('Historical quote not found'); // More descriptive error
        }
    } catch (error) {
        console.error("Error fetching historical quote:", error);
        throw error;
    }
}

async function fetchCurrentQuote(coinId, apiKey) {
    console.log('fetchCurrentQuote called with coinId:', coinId, 'apiKey:', apiKey);
    const cacheKey = `current:${coinId}`;
    if (cache.has(cacheKey)) {
        console.log('fetchCurrentQuote: Returning cached current quote:', cache.get(cacheKey));
        return cache.get(cacheKey);
    }

    const url = `${CMC_API_BASE}/cryptocurrency/quotes/latest?id=${coinId}`;
    console.log('fetchCurrentQuote: Fetching URL:', url);
    try {
        const response = await fetch(url, {
            headers: {
                'X-CMC_PRO_API_KEY': apiKey,
                'Accept': 'application/json'
            }
        });
        console.log('fetchCurrentQuote: API response:', response);

        if (!response.ok) {
            let errorMessage = `Failed to fetch current quote: ${response.status} ${response.statusText}`;
            try {
                const errorData = await response.json();
                if (errorData && errorData.status && errorData.status.error_message) {
                    errorMessage += ` - ${errorData.status.error_message}`;
                }
            } catch (e) {
                console.error("Error parsing error response:", e);
            }
            console.error('fetchCurrentQuote: Error:', errorMessage);
            throw new Error(errorMessage);
        }

        const data = await response.json();
        console.log('fetchCurrentQuote: API response data:', data);
        if (data.data && data.data[coinId]) {
            const quote = data.data[coinId];
            cache.set(cacheKey, quote);
            console.log('fetchCurrentQuote: Returning current quote:', quote);
            return quote;
        } else {
            const errorMessage = `Current quote not found for coin ID: ${coinId}`;
            console.error('fetchCurrentQuote: Error:', errorMessage);
            throw new Error(errorMessage);
        }
    } catch (error) {
        console.error("Error fetching current quote:", error);
        throw error;
    }
}

async function testApiKey(apiKey) {
    console.log('testApiKey called with apiKey:', apiKey);
    const url = `${CMC_API_BASE}/cryptocurrency/map?limit=1`;
    console.log('testApiKey: Fetching URL:', url);

    try {
        const response = await fetch(url, {
            headers: {
                'X-CMC_PRO_API_KEY': apiKey,
                'Accept': 'application/json'
            }
        });
        console.log('testApiKey: API response:', response);

        if (!response.ok) {
            const text = await response.text();
            console.error('testApiKey: API call failed. Status:', response.status, 'Text:', text);
            throw new Error(`Test API call failed: ${response.status} ${text}`);
        }

        const data = await response.json();
        console.log('testApiKey: API call successful:', data);

    } catch (error) {
        console.error('testApiKey: Error:', error);
        throw error;
    }
}

async function getCMCId(symbol, apiKey) {
    const now = Date.now();
    
    // Check if cache needs updating
    if (now - cmcIdCache.lastUpdate > cmcIdCache.CACHE_DURATION || Object.keys(cmcIdCache.ids).length === 0) {
        try {
            const response = await fetch(`${CMC_API_BASE}/cryptocurrency/map`, {
                headers: {
                    'X-CMC_PRO_API_KEY': apiKey,
                    'Accept': 'application/json'
                }
            });
            
            const data = await response.json();
            
            // Update cache
            cmcIdCache.ids = {};
            
            // Group tokens by symbol
            const tokensBySymbol = {};
            data.data.forEach(crypto => {
                const upperSymbol = crypto.symbol.toUpperCase();
                if (!tokensBySymbol[upperSymbol]) {
                    tokensBySymbol[upperSymbol] = [];
                }
                tokensBySymbol[upperSymbol].push(crypto);
            });

            // For each symbol, store the ID of the token with highest market cap
            Object.entries(tokensBySymbol).forEach(([symbol, tokens]) => {
                // Sort by market cap (descending)
                tokens.sort((a, b) => {
                    const aRank = a.cmc_rank || Infinity;
                    const bRank = b.cmc_rank || Infinity;
                    return aRank - bRank;  // Lower rank = higher market cap
                });
                
                // Store the ID of the highest market cap token
                cmcIdCache.ids[symbol] = tokens[0].id;
            });

            cmcIdCache.lastUpdate = now;
            
            console.log('Updated CMC ID cache:', cmcIdCache.ids);
            
        } catch (error) {
            console.error('Error updating CMC ID cache:', error);
            // If cache update fails but we have existing cache, continue using it
            if (Object.keys(cmcIdCache.ids).length === 0) {
                throw error;
            }
        }
    }
    
    const id = cmcIdCache.ids[symbol.toUpperCase()];
    if (!id) {
        throw new Error(`No ID found for symbol: ${symbol}`);
    }
    
    return id;
}

// Batch fetch historical prices for multiple tokens
async function fetchHistoricalPrices(tokens, timestamp) {
    // Get API key first
    const apiKey = await getApiKey();
    if (!apiKey) {
        throw new Error('API key not found. Please set your CoinMarketCap API key in the extension options.');
    }

    const now = Date.now();
    const uniqueTokens = [...new Set(tokens.map(t => t.toUpperCase()))];
    const uncachedTokens = [];
    const results = {};

    // Check cache first
    for (const symbol of uniqueTokens) {
        const cachedData = priceCache.data[symbol];
        if (cachedData && now - cachedData.lastUpdate < priceCache.CACHE_DURATION) {
            results[symbol] = cachedData.data;
        } else {
            uncachedTokens.push(symbol);
        }
    }

    if (uncachedTokens.length > 0) {
        try {
            const ids = await Promise.all(uncachedTokens.map(symbol => getCMCId(symbol, apiKey)));
            
            console.log('Fetching historical prices for IDs:', ids);

            // Construct URL with query parameters
            const queryParams = new URLSearchParams({
                id: ids.join(','),
                time_start: Math.floor(timestamp),  // Ensure timestamp is an integer
                time_end: Math.floor(Date.now() / 1000),
                interval: '5m'
            });

            const url = `${CMC_HISTORICAL_BASE}/cryptocurrency/quotes/historical?${queryParams}`;
            console.log('Fetching URL:', url);  // Debug log

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'X-CMC_PRO_API_KEY': apiKey,
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('API Error Response:', errorText);  // Debug log
                throw new Error(`HTTP error! status: ${response.status}. ${errorText}`);
            }

            const data = await response.json();
            console.log('Historical price data received:', data);

            // Process and cache results with better error handling
            uncachedTokens.forEach((symbol, index) => {
                const id = ids[index];
                const tokenData = data.data && data.data[id];
                
                if (!tokenData || !tokenData.quotes) {
                    results[symbol] = {
                        error: true,
                        message: `No data available for ${symbol}`
                    };
                    return;
                }

                // Process the quotes to find historical, current, high, and low prices
                const quotes = tokenData.quotes;
                let historicalPrice = null;
                let highPrice = -Infinity;
                let lowPrice = Infinity;
                let closestQuote = null;
                let minTimeDiff = Infinity;

                quotes.forEach(quote => {
                    const quoteTime = new Date(quote.timestamp).getTime() / 1000;
                    const timeDiff = Math.abs(quoteTime - timestamp);
                    const price = quote.quote.USD.price;

                    if (timeDiff < minTimeDiff) {
                        minTimeDiff = timeDiff;
                        historicalPrice = price;
                        closestQuote = quote;
                    }

                    highPrice = Math.max(highPrice, price);
                    lowPrice = Math.min(lowPrice, price);
                });

                const processedData = {
                    historicalPrice,
                    currentPrice: quotes[quotes.length - 1].quote.USD.price,
                    performance: ((quotes[quotes.length - 1].quote.USD.price - historicalPrice) / historicalPrice) * 100,
                    highPrice,
                    lowPrice,
                    timestamp: closestQuote.timestamp
                };

                results[symbol] = processedData;
                
                // Update cache
                priceCache.data[symbol] = {
                    data: processedData,
                    lastUpdate: now
                };
            });
        } catch (error) {
            console.error('Error fetching historical prices:', error);
            throw error;
        }
    }

    return results;
}

// Update the message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'fetchPerformanceBatch') {
        fetchHistoricalPrices(request.tokens, request.tweetTimestamp)
            .then(data => {
                if (!data || data.error) {
                    // Return an array with error for each token
                    const errorResults = request.tokens.map(symbol => ({
                        tokenSymbol: symbol,
                        error: true,
                        message: data?.message || 'Failed to fetch data'
                    }));
                    sendResponse(errorResults);
                    return;
                }
                
                // Transform the data into an array of token results
                const results = request.tokens.map(symbol => {
                    const tokenData = data[symbol.toUpperCase()];
                    if (!tokenData) {
                        return {
                            tokenSymbol: symbol,
                            error: true,
                            message: `No data found for ${symbol}`
                        };
                    }
                    return {
                        tokenSymbol: symbol,
                        historicalPrice: tokenData.historicalPrice,
                        currentPrice: tokenData.currentPrice,
                        performance: tokenData.performance,
                        highPrice: tokenData.highPrice,
                        lowPrice: tokenData.lowPrice,
                        closestTimestamp: tokenData.timestamp
                    };
                });
                sendResponse(results);
            })
            .catch(error => {
                // Return an array with error for each token
                const errorResults = request.tokens.map(symbol => ({
                    tokenSymbol: symbol,
                    error: true,
                    message: error.message
                }));
                sendResponse(errorResults);
            });
        return true;
    }
});
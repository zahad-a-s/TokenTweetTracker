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
    const upperSymbol = symbol.toUpperCase();
    
    // Check if cache needs updating (reduce frequency to once per day)
    if (now - cmcIdCache.lastUpdate > cmcIdCache.CACHE_DURATION || Object.keys(cmcIdCache.ids).length === 0) {
        try {
            const response = await fetch(`${CMC_API_BASE}/cryptocurrency/map`, {
                headers: {
                    'X-CMC_PRO_API_KEY': apiKey,
                    'Accept': 'application/json'
                }
            });
            
            const data = await response.json();
            
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
                tokens.sort((a, b) => {
                    const aRank = a.cmc_rank || Infinity;
                    const bRank = b.cmc_rank || Infinity;
                    return aRank - bRank;
                });
                cmcIdCache.ids[symbol] = tokens[0].id;
            });

            cmcIdCache.lastUpdate = now;
            
            // Only log once when cache is updated
            console.log('Updated CMC ID cache:', cmcIdCache.ids);
        } catch (error) {
            console.error('Error updating CMC ID cache:', error);
            if (Object.keys(cmcIdCache.ids).length === 0) {
                throw error;
            }
        }
    }
    
    return cmcIdCache.ids[upperSymbol] || null;
}

// Batch fetch historical prices for multiple tokens
async function fetchHistoricalPrices(tokens, timestamp) {
    console.log('fetchHistoricalPrices called with tokens:', tokens, 'timestamp:', timestamp);
    
    const apiKey = await getApiKey();
    if (!apiKey) {
        throw new Error('API key not found. Please set your CoinMarketCap API key in the extension options.');
    }

    const now = Date.now();
    const uniqueTokens = [...new Set(tokens.map(t => t.toUpperCase()))];
    console.log('Processing unique tokens:', uniqueTokens);

    const uncachedTokens = [];
    const results = {};

    // Check cache first
    for (const symbol of uniqueTokens) {
        const cachedData = priceCache.data[symbol];
        if (cachedData && now - cachedData.lastUpdate < priceCache.CACHE_DURATION) {
            console.log(`Using cached data for ${symbol}:`, cachedData.data);
            results[symbol] = cachedData.data;
        } else {
            console.log(`No cache hit for ${symbol}, will fetch`);
            uncachedTokens.push(symbol);
        }
    }

    if (uncachedTokens.length > 0) {
        try {
            console.log('Fetching CMC IDs for tokens:', uncachedTokens);
            const idMap = {};
            const allIds = await Promise.all(uncachedTokens.map(symbol => getCMCId(symbol, apiKey)));
            
            uncachedTokens.forEach((symbol, index) => {
                if (allIds[index] !== null) {
                    idMap[symbol] = allIds[index];
                    console.log(`Mapped ${symbol} to ID ${allIds[index]}`);
                } else {
                    console.log(`No CMC ID found for ${symbol}`);
                    results[symbol] = {
                        error: true,
                        message: `Token not found: ${symbol}`
                    };
                }
            });

            const validTokens = Object.keys(idMap);
            console.log('Valid tokens with CMC IDs:', validTokens);
            
            if (validTokens.length === 0) return results;

            // Historical data fetch
            const timeStart = timestamp - (15 * 60);
            const timeEnd = timestamp + (15 * 60);
            
            const historicalParams = new URLSearchParams({
                id: Object.values(idMap).join(','),
                time_start: Math.floor(timeStart),
                time_end: Math.floor(timeEnd),
                interval: '5m'
            });

            const historicalUrl = `${CMC_HISTORICAL_BASE}/cryptocurrency/quotes/historical?${historicalParams}`;
            console.log('Fetching historical data:', historicalUrl);
            
            const response = await fetch(historicalUrl, {
                headers: {
                    'X-CMC_PRO_API_KEY': apiKey,
                    'Accept': 'application/json'
                }
            });

            console.log('Historical API response status:', response.status);
            const responseText = await response.text();
            console.log('Historical API raw response:', responseText);
            
            if (!response.ok) {
                throw new Error(`Historical API error: ${response.status} - ${responseText}`);
            }

            const data = JSON.parse(responseText);

            // Current prices fetch
            const currentParams = new URLSearchParams({
                symbol: validTokens.join(','),
                convert: 'USD',
                skip_invalid: 'true'
            });
            
            const currentUrl = `${CMC_API_BASE}/cryptocurrency/quotes/latest?${currentParams}`;
            console.log('Fetching current prices:', currentUrl);
            
            const currentPricesResponse = await fetch(currentUrl, {
                headers: {
                    'X-CMC_PRO_API_KEY': apiKey,
                    'Accept': 'application/json'
                }
            });

            console.log('Current prices API response status:', currentPricesResponse.status);
            const currentPricesText = await currentPricesResponse.text();
            console.log('Current prices API raw response:', currentPricesText);
            
            if (!currentPricesResponse.ok) {
                throw new Error(`Current prices API error: ${currentPricesResponse.status} - ${currentPricesText}`);
            }

            const currentPricesData = JSON.parse(currentPricesText);

            // Process results
            for (const symbol of validTokens) {
                console.log(`Processing data for ${symbol}`);
                const id = idMap[symbol];
                const tokenData = data.data[id];
                const currentPriceData = currentPricesData.data[symbol];
                
                console.log(`Token ${symbol} historical data:`, tokenData);
                console.log(`Token ${symbol} current price data:`, currentPriceData);

                if (!tokenData || !tokenData.quotes || tokenData.quotes.length === 0) {
                    results[symbol] = {
                        error: true,
                        message: `No data available for ${symbol}`
                    };
                    continue;
                }

                if (!currentPriceData || !currentPriceData.quote || !currentPriceData.quote.USD) {
                    results[symbol] = {
                        error: true,
                        message: `No current price data available for ${symbol}`
                    };
                    continue;
                }

                const quotes = tokenData.quotes;
                let closestQuote = null;
                let minTimeDiff = Infinity;

                // Find closest quote to tweet timestamp
                quotes.forEach(quote => {
                    const quoteTime = new Date(quote.timestamp).getTime() / 1000;
                    const timeDiff = Math.abs(quoteTime - timestamp);
                    if (timeDiff < minTimeDiff) {
                        minTimeDiff = timeDiff;
                        closestQuote = quote;
                    }
                });

                if (!closestQuote) {
                    results[symbol] = {
                        error: true,
                        message: `No close data found for ${symbol}`
                    };
                    continue;
                }

                const processedData = {
                    historicalPrice: closestQuote.quote.USD.price,
                    currentPrice: currentPriceData.quote.USD.price,
                    performance: ((currentPriceData.quote.USD.price - closestQuote.quote.USD.price) / closestQuote.quote.USD.price) * 100,
                    timestamp: closestQuote.timestamp
                };

                results[symbol] = processedData;
                
                // Update cache
                priceCache.data[symbol] = {
                    data: processedData,
                    lastUpdate: now
                };
            }
        } catch (error) {
            console.error('Error in fetchHistoricalPrices:', error);
            throw error;
        }
    }

    console.log('Final results:', results);
    return results;
}

// Update the message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'fetchPerformanceBatch') {
        fetchHistoricalPrices(request.tokens, request.tweetTimestamp)
            .then(data => {
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
                    if (tokenData.error) {  // Check if it's an error object
                        return {
                            tokenSymbol: symbol,
                            error: true,
                            message: tokenData.message
                        };
                    }
                    return {
                        tokenSymbol: symbol,
                        historicalPrice: tokenData.historicalPrice,
                        currentPrice: tokenData.currentPrice,
                        performance: tokenData.performance,
                        closestTimestamp: tokenData.timestamp
                    };
                });
                sendResponse(results);
            })
            .catch(error => {
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
const CMC_API_BASE = 'https://pro-api.coinmarketcap.com/v1';
const CMC_HISTORICAL_BASE = 'https://pro-api.coinmarketcap.com/v2';
const cache = new Map();

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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('onMessage received request:', request, 'from sender:', sender);
    if (request.action === 'fetchPerformance') {
        (async () => {
            let apiKey;
            try {
                apiKey = await new Promise(resolve => {
                    chrome.storage.sync.get(['cmcApiKey'], result => {
                        console.log('chrome.storage.sync.get result:', result);
                        console.log('API Key retrieved in background:', result.cmcApiKey);
                        resolve(result.cmcApiKey);
                    });
                });

                if (!apiKey) {
                    console.error('API Key Not Set');
                    sendResponse({ error: 'API Key Not Set' });
                    return;
                }

                await testApiKey(apiKey);

                const coinId = await fetchCoinId(request.tokenSymbol, apiKey);
                if (!coinId) {
                    console.error(`Could not find coin ID for ${request.tokenSymbol}`);
                    sendResponse({ error: `Could not find coin ID for ${request.tokenSymbol}` });
                    return;
                }

                const historicalData = await fetchHistoricalQuote(coinId, request.tweetTimestamp, apiKey);
                if (!historicalData) {
                    console.error(`Could not fetch historical quote for ${request.tokenSymbol}`);
                    sendResponse({ error: `Could not fetch historical quote for ${request.tokenSymbol}` });
                    return;
                }
                const historicalPrice = historicalData.historicalPrice;
                const highPrice = historicalData.highPrice;
                const lowPrice = historicalData.lowPrice;
                const closestTimestamp = historicalData.closestTimestamp;


                const currentQuote = await fetchCurrentQuote(coinId, apiKey);
                if (!currentQuote) {
                    console.error(`Could not fetch current quote for ${request.tokenSymbol}`);
                    sendResponse({ error: `Could not fetch current quote for ${request.tokenSymbol}` });
                    return;
                }
                const currentPrice = currentQuote.quote.USD.price;

                const performance = ((currentPrice - historicalPrice) / historicalPrice) * 100;
                console.log('Calculated performance:', performance);
                sendResponse({
                    performance: performance,
                    historicalPrice: historicalPrice,
                    currentPrice: currentPrice,
                    highPrice: highPrice,
                    lowPrice: lowPrice,
                    closestTimestamp: closestTimestamp
                });


            } catch (error) {
                console.error("Error in background script:", error);
                sendResponse({ error: error.message });
            }
        })();
        return true;
    }
});
Here's a README for the TokenTweetTracker Chrome extension:

# TokenTweetTracker

A Chrome extension that tracks cryptocurrency token prices mentioned in tweets. When you see a tweet with a token symbol (e.g., `$BTC`), the extension adds a "⌾ Price" button that shows historical and current price data.

## Features

- Detects cryptocurrency tokens mentioned with `$` symbol in tweets
- Shows price performance since tweet posting time
- Displays historical price, current price, and high/low ranges
- Integrates with CoinMarketCap's API for reliable price data

## Installation Guide

1. **Clone the Repository**
```bash
git clone https://github.com/yourusername/TokenTweetTracker.git
cd TokenTweetTracker
```

2. **Get a CoinMarketCap API Key**
   - Visit [CoinMarketCap's API Portal](https://pro.coinmarketcap.com/)
   - Sign up for a free account
   - Generate an API key from your dashboard

3. **Load the Extension in Chrome**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (top-right toggle)
   - Click "Load unpacked"
   - Select the `TokenTweetTracker` directory

4. **Configure the Extension**
   - Click the extension icon in Chrome's toolbar
   - Enter your CoinMarketCap API key
   - Click "Save API Key"

5. **Test the Extension**
   - Visit [Twitter](https://twitter.com)
   - Find a tweet mentioning a token (e.g., `$BTC`)
   - Click the "⌾ Price" button next to the tweet

## How It Works

The extension works by:
1. Monitoring tweets for `$` symbols followed by letters (see content.js)

```11:22:content.js
function findCryptoEntities(text) {
    console.log('findCryptoEntities called with text:', text);
    const tokens = [];
    const tokenRegex = /\$([a-zA-Z]+)\b/g; // Only letters after the $
    let match;

    while ((match = tokenRegex.exec(text)) !== null) {
        tokens.push({ type: 'token', symbol: match[1], index: match.index, length: match[0].length });
    }
    console.log('findCryptoEntities found tokens:', tokens);
    return tokens;
}
```


2. Adding a price button to tweets with detected tokens (see content.js)

```149:256:content.js
function processTweet(tweetElement) {
    console.log('processTweet called with tweetElement:', tweetElement);
    if (tweetElement.hasAttribute('data-crypto-processed')) {
        console.log('processTweet: Tweet already processed.');
        return;
    }
    tweetElement.setAttribute('data-crypto-processed', 'true');

    const tweetTextElement = tweetElement.querySelector('[data-testid="tweetText"]');
    if (!tweetTextElement) {
        console.log('processTweet: No tweetTextElement found.');
        return;
    }

    const tweetText = tweetTextElement.textContent;
    const cryptoEntities = findCryptoEntities(tweetText);

    if (cryptoEntities.length > 0) {
        console.log('processTweet: Crypto entities found:', cryptoEntities);
        const timestamp = getTweetTimestamp(tweetElement);

        // Find the container that has the Grok button and three-dot menu
        const topRightContainer = tweetElement.querySelector('div.css-175oi2r.r-1awozwy.r-18u37iz.r-1cmwbt1.r-1wtj0ep');
        if (topRightContainer) {
            // Create a new div to wrap our button in the same style as other top actions
            const buttonWrapper = document.createElement('div');
            buttonWrapper.className = 'css-175oi2r r-18u37iz r-1h0z5md';
            
            // Create the button with the same styling as the Grok button
            const getPerformanceButton = document.createElement('button');
            getPerformanceButton.textContent = '⌾ Price';
            getPerformanceButton.classList.add('get-performance-button');
            getPerformanceButton.setAttribute('role', 'button');

            // Add debugging
            console.log('Button created with classes:', getPerformanceButton.className);
            console.log('Button computed style:', window.getComputedStyle(getPerformanceButton));

            // Debug the class overwrite issue
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                        console.log('Button classes changed to:', getPerformanceButton.className);
                    }
                });
            });

            observer.observe(getPerformanceButton, {
                attributes: true
            });

            // Let's also check what classes Twitter is applying
            console.log('Twitter button example:', 
                document.querySelector('div[role="group"] button')?.className
            );

            // Instead of overwriting, let's add Twitter's classes while keeping ours
            getPerformanceButton.classList.add(
                'css-175oi2r',
                'r-1777fci',
                'r-bt1l66',
                'r-bztko3',
                'r-lrvibr',
                'r-1loqt21',
                'r-1ny4l3l'
            );

            buttonWrapper.appendChild(getPerformanceButton);
            
            // Insert before the div that contains the three-dot menu
            const threeDotContainer = topRightContainer.querySelector('div.css-175oi2r.r-1awozwy.r-6koalj.r-18u37iz');
            if (threeDotContainer) {
                topRightContainer.insertBefore(buttonWrapper, threeDotContainer);
            } else {
                topRightContainer.appendChild(buttonWrapper);
            }

            let popup = null;

            getPerformanceButton.addEventListener('click', async () => {
                if (popup) {
                    popup.remove();
                }

                try {
                    // Fetch data for all tokens in parallel
                    const responses = await Promise.all(cryptoEntities.map(entity => 
                        new Promise((resolve, reject) => {
                            chrome.runtime.sendMessage({
                                action: 'fetchPerformance',
                                tokenSymbol: entity.symbol,
                                tweetTimestamp: timestamp
                            }, response => {
                                if (chrome.runtime.lastError) {
                                    reject(new Error(chrome.runtime.lastError.message));
                                } else {
                                    resolve({...response, tokenSymbol: entity.symbol});
                                }
                            });
                        })
                    ));

                    popup = createPopup(responses, getPerformanceButton);
                } catch (error) {
                    console.error('Error fetching performance:', error);
                    createPopup({ error: true, message: error.message }, getPerformanceButton);
                }
            });
```


3. Fetching historical and current prices using CoinMarketCap's API (see background.js)

```228:296:background.js
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
```


## Known Issues

1. **Token Detection**
   - Currently detects any `$` followed by letters as a token
   - No validation against actual cryptocurrency symbols
   - May show false positives for non-crypto mentions (e.g., `$USD`)

2. **API Limitations**
   - Requires personal CoinMarketCap API key
   - Free API tier has rate limits
   - Historical data fetching sometimes fails due to API constraints

3. **Performance**
   - May slow down Twitter browsing with many token mentions
   - Cache implementation is memory-only and clears on browser restart

4. **UI/UX**
   - Button styling might break with Twitter UI updates
   - Popup positioning can be inconsistent
   - No dark mode support

## Future Improvements

- Add token symbol validation
- Support multiple price data providers
- Implement persistent caching
- Add customizable time ranges
- Include trading volume data
- Support for dark mode
- Add price alerts functionality

## Dependencies

- Chrome Browser
- CoinMarketCap API Key (Free tier available)

## Privacy Note

This extension requires a CoinMarketCap API key to function. Your API key is stored locally in Chrome's storage and is only used for price data requests. No personal data is collected or transmitted.

## Contributing

Feel free to submit issues, fork the repository, and create pull requests for any improvements.

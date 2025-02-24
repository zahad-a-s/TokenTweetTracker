# TokenTweetTracker

A Chrome extension that tracks cryptocurrency token prices mentioned in tweets on Twitter (X). When you see a tweet with a token symbol (e.g., `$BTC`), the extension adds a "⌾ Price" button. Clicking this button displays historical and current price data, along with the performance percentage since the tweet was posted.

## Features

-   Detects cryptocurrency tokens mentioned with a `$` symbol in tweets on twitter.com and x.com.
-   Shows price performance (percentage change) since the tweet's posting time.
-   Displays historical price (closest to the tweet time), current price, and high/low prices within a 5-minute window around the tweet's timestamp.
-   Integrates with CoinMarketCap's API for price data.
-   Supports multiple tokens in a single tweet, displaying data in a tabbed interface within the popup.
-   Handles loading and error states gracefully.
-   Caches API responses to improve performance and reduce API calls.  The cache for price data lasts for 5 minutes, and the cache for CoinMarketCap IDs lasts for 24 hours.
-   Includes dark mode support that automatically adapts to Twitter's theme.
-   Cleans up popups on navigation, ensuring only one popup is visible at a time.

## Installation Guide

1.  **Download the Extension**

    -   Go to the GitHub repository: `https://github.com/yourusername/TokenTweetTracker`
    -   Click the green "Code" button.
    -   Select "Download ZIP" from the dropdown menu.
    -   Extract the downloaded ZIP file to a folder on your computer.

2.  **Load into Google Chrome**

    -   Open Google Chrome
    -   Type `chrome://extensions` in the address bar and press Enter
    -   Enable "Developer mode" using the toggle switch in the top-right corner
    -   Click "Load unpacked" in the top-left corner
    -   Navigate to and select the extracted TokenTweetTracker folder
    -   The extension should now appear in your extensions list

3.  **Get a CoinMarketCap API Key**

    -   Visit [CoinMarketCap's API Portal](https://pro.coinmarketcap.com/)
    -   Sign up for a free account (Basic plan).
    -   Generate an API key from your dashboard.  **Important:** Keep your API key secret.

4.  **Load the Extension in Chrome**

    -   Open Chrome and go to `chrome://extensions/`
    -   Enable "Developer mode" (top-right toggle)
    -   Click "Load unpacked"
    -   Select the `TokenTweetTracker` directory.

5.  **Configure the Extension**

    -   Click the TokenTweetTracker extension icon in Chrome's toolbar.
    -   Enter your CoinMarketCap API key in the input field.
    -   Click "Save API Key".  The key is stored locally using `chrome.storage.sync`.

6.  **Test the Extension**

    -   Visit [Twitter/X](https://x.com).
    -   Find a tweet mentioning a token (e.g., `$BTC`, `$ETH`, `$SOL`).
    -   Click the "⌾ Price" button that appears next to the tweet's top-right actions (should be left of the xAI/Grok button).

## How It Works

The extension works by:

1.  **Monitoring Tweets:** The `content.js` script uses a `MutationObserver` to monitor the Twitter/X DOM for new tweets.
    ```javascript:content.js
    startLine: 344
    endLine: 359
    ```

2.  **Detecting Tokens:** The `findCryptoEntities` function in `content.js` identifies potential cryptocurrency tokens using a regular expression.
    ```javascript:content.js
    startLine: 14
    endLine: 25
    ```

3.  **Adding the Price Button:**  The `processTweet` function adds a "⌾ Price" button to tweets containing detected tokens.  The button is inserted into the top-right action area of the tweet.
    ```javascript:content.js
    startLine: 230
    endLine: 342
    ```

4.  **Fetching Price Data:** When the button is clicked, the `content.js` script sends a message to `background.js` to fetch price data.  `background.js` uses several functions to interact with the CoinMarketCap API:
    -   `getCMCId`: Retrieves the CoinMarketCap ID for a given token symbol, using a caching mechanism.
        ```javascript:background.js
        startLine: 252
        endLine: 301
        ```
    -   `fetchHistoricalPrices`: Fetches historical price data for one or more tokens, centered around the tweet's timestamp.
        ```javascript:background.js
        startLine: 304
        endLine: 484
        ```
    -   `fetchCurrentQuote`:  Fetches the latest price data.
        ```javascript:background.js
        startLine: 172
        endLine: 221
        ```

5.  **Displaying the Popup:** The `content.js` script creates a popup to display the fetched price data. The `createPopup`, `setPopupLoadingState`, `setPopupErrorState`, and `setPopupDataState` functions manage the popup's content and appearance.
    ```javascript:content.js
    startLine: 68
    endLine: 227
    ```

6. **Handling Navigation:** The extension cleans up any open popups when the user navigates within Twitter/X or leaves the page.
    ```javascript:content.js
    startLine: 563
    endLine: 593
    ```

## Known Issues

1.  **Token Detection:**
    -   Currently detects *any* `$` followed by letters as a token.
    -   No validation against a list of actual cryptocurrency symbols, thus showing false positives (stocks, currencies, etc.).

2.  **API Limitations:**
    -   Requires a *personal* CoinMarketCap API key. I'll update this if there's enough interest. 
    -   The free "Basic" API tier has severe limitations on historical data.

3.  **Performance:**
    -   On pages with many token mentions, there might be a slight performance impact due to DOM manipulation and API calls.

4.  **UI/UX:**
    -   Button styling might be affected by future Twitter UI updates.  The extension attempts to match Twitter's button styles, but this is inherently fragile.
    -   Popup positioning is relative to the button; it might appear off-screen or in unexpected locations in some cases.
    -   The popup's appearance is designed to match both light and dark Twitter themes, but more comprehensive theming could be added.

## Future Improvements

-   **Token Validation:** Implement a mechanism to validate detected tokens against a known list of cryptocurrency symbols (e.g., fetched from an API or maintained locally).
-   **High/Low Price:** Add High and Low prices (since time of tweet) to the popup. This was previously enabled but led to hitting rate limits. 
-   **Multiple API Providers:**  Consider supporting other price data providers (like CoinGecko) as fallbacks or alternatives to CoinMarketCap.
-   **Persistent Caching:**  Improve caching to persist across browser restarts (e.g., using `chrome.storage.local`).
-   **Customizable Time Ranges:** Allow users to select different time ranges for historical price data.
-   **Trading Volume:** Include trading volume data in the popup.
-   **Configuration Options:** Add a popup or options page to allow users to customize settings (e.g., preferred currency, data providers).
-   **Refactor `background.js`:** The `fetchHistoricalPrices` function in `background.js` will be refactored for better readability and maintainability.

## Dependencies

-   Chrome Browser
-   CoinMarketCap API Key (Free "Basic" tier available)

## Privacy Note

This extension requires a CoinMarketCap API key to function. Your API key is stored *locally* in Chrome's storage (`chrome.storage.sync`) and is *only* used for making requests to the CoinMarketCap API. No personal data is collected or transmitted by the extension itself. However, CoinMarketCap may log your API requests. Refer to CoinMarketCap's privacy policy for details.

## Contributing

Feel free to submit issues, fork the repository, and create pull requests for any improvements.

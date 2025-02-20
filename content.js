// API Key - Consider letting the user input this, or use a backend to avoid exposing it.
// For this example, we'll directly include it, but this is NOT recommended for production.
const COINGECKO_API_BASE = 'https://api.coingecko.com/api/v3';
// CoinMarketCap requires an API key, which adds complexity for a free extension.
// Using CoinGecko as it's generally more accessible without an immediate key requirement for basic use.

const CMC_API_BASE = 'https://pro-api.coinmarketcap.com';
const CMC_SANDBOX_API_BASE = 'https://sandbox-api.coinmarketcap.com/v2'; // For testing

// Function to find crypto tokens ($[TOKEN])
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

// Function to get the tweet timestamp
function getTweetTimestamp(tweetElement) {
    console.log('getTweetTimestamp called with tweetElement:', tweetElement);
    const timeElement = tweetElement.querySelector('time[datetime]');
    if (timeElement) {
        const timestamp = new Date(timeElement.getAttribute('datetime')).getTime() / 1000;
        console.log('getTweetTimestamp found timestamp:', timestamp);
        return timestamp;
    }
    console.log('getTweetTimestamp: No timestamp found.');
    return null;
}

// Add this helper function
function formatPrice(price) {
    if (price === null || price === undefined) return 'N/A';
    
    if (price < 0.01) {
        // Find first non-zero decimal place and show one more digit
        let decimals = 2;
        while (price < 1 / Math.pow(10, decimals) && decimals < 8) {
            decimals++;
        }
        return `$${price.toFixed(decimals + 1)}`;
    } else if (price < 0.10) {
        return `$${price.toFixed(3)}`; // Show 3 decimal places
    } else {
        return `$${price.toFixed(2)}`; // Standard 2 decimal places
    }
}

// Function to create the styled popup
function createPopup(data, button) {
    const popup = document.createElement('div');
    popup.classList.add('crypto-popup');

    if (data.error) {
        popup.innerHTML = `
            <div class="popup-header">
                <h2>Error</h2>
                <span class="close-button">&times;</span>
            </div>
            <div class="popup-content">
                <p>${data.message}</p>
            </div>
        `;
    } else {
        // If data is an array, we have multiple tokens
        const tokens = Array.isArray(data) ? data : [data];
        
        let tabsHtml = '';
        if (tokens.length > 1) {
            tabsHtml = `
                <div class="popup-tabs">
                    ${tokens.map((token, index) => `
                        <button class="popup-tab ${index === 0 ? 'active' : ''}" 
                                data-index="${index}">
                            $${token.tokenSymbol}
                        </button>
                    `).join('')}
                </div>
            `;
        }

        const contentHtml = tokens.map((token, index) => `
            <div class="popup-content" data-index="${index}" 
                 style="display: ${index === 0 ? 'block' : 'none'}">
                <p>Performance: <span class="${token.performance >= 0 ? 'positive' : 'negative'}">${token.performance.toFixed(2)}%</span></p>
                <p>Historical: ${formatPrice(token.historicalPrice)}</p>
                <p>Current: ${formatPrice(token.currentPrice)}</p>
                <p>High: ${formatPrice(token.highPrice)}</p>
                <p>Low: ${formatPrice(token.lowPrice)}</p>
                <p>Time: ${token.closestTimestamp}</p>
            </div>
        `).join('');

        popup.innerHTML = `
            <div class="popup-header">
                <h2>Token Performance</h2>
                <span class="close-button">&times;</span>
            </div>
            ${tabsHtml}
            ${contentHtml}
        `;

        // Add tab switching functionality if there are multiple tokens
        if (tokens.length > 1) {
            const tabs = popup.querySelectorAll('.popup-tab');
            const contents = popup.querySelectorAll('.popup-content');
            
            tabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    const index = tab.dataset.index;
                    tabs.forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    contents.forEach(content => {
                        content.style.display = content.dataset.index === index ? 'block' : 'none';
                    });
                });
            });
        }
    }

    document.body.appendChild(popup);

    const closeButton = popup.querySelector('.close-button');
    closeButton.addEventListener('click', () => {
        popup.remove();
    });

    // Position the popup relative to the button
    positionPopup(popup, button);

    return popup;
}

function positionPopup(popup, button) {
    const buttonRect = button.getBoundingClientRect();

    // Position the popup below and slightly to the left of the button
    popup.style.left = `${buttonRect.left + window.scrollX - 10}px`; // 10px to the left
    popup.style.top = `${buttonRect.bottom + window.scrollY + 5}px`; // 5px below
}

// Main function to process a single tweet
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
                    const response = await new Promise((resolve, reject) => {
                        chrome.runtime.sendMessage({
                            action: 'fetchPerformanceBatch',
                            tokens: cryptoEntities.map(entity => entity.symbol),
                            tweetTimestamp: timestamp
                        }, response => {
                            if (chrome.runtime.lastError) {
                                reject(new Error(chrome.runtime.lastError.message));
                            } else {
                                // Ensure response is always an array
                                resolve(Array.isArray(response) ? response : []);
                            }
                        });
                    });

                    // Check if all tokens had errors
                    const allErrors = response.every(result => result.error);
                    if (allErrors && response.length > 0) {
                        throw new Error(response[0].message);
                    }

                    // Sort tokens by order of appearance in tweet
                    const sortedTokens = response.map(tokenData => ({
                        ...tokenData,
                        index: cryptoEntities.findIndex(entity => 
                            entity.symbol.toUpperCase() === tokenData.tokenSymbol.toUpperCase()
                        )
                    })).sort((a, b) => a.index - b.index);

                    popup = createPopup(sortedTokens, getPerformanceButton);
                } catch (error) {
                    console.error('Error fetching performance:', error);
                    createPopup({ error: true, message: error.message }, getPerformanceButton);
                }
            });
        } else {
            console.log('processTweet: No top-right container found.');
        }
    } else {
        console.log('processTweet: No crypto entities found.');
    }
}

// Set up the MutationObserver
const observer = new MutationObserver(mutations => {
    console.log('MutationObserver triggered:', mutations);
    mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
                if (node.matches('article[data-testid="tweet"]')) {
                    processTweet(node);
                } else {
                    const tweetElements = node.querySelectorAll('article[data-testid="tweet"]');
                    tweetElements.forEach(processTweet);
                }
            }
        });
    });
});

// Start observing the entire document body
observer.observe(document.body, { childList: true, subtree: true });

// Process initial tweets on page load
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded event fired.');
    const initialTweets = document.querySelectorAll('article[data-testid="tweet"]');
    initialTweets.forEach(processTweet);
}); 
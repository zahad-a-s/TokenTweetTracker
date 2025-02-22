// API Key - Consider letting the user input this, or use a backend to avoid exposing it.
// For this example, we'll directly include it, but this is NOT recommended for production.
const COINGECKO_API_BASE = 'https://api.coingecko.com/api/v3';
// CoinMarketCap requires an API key, which adds complexity for a free extension.
// Using CoinGecko as it's generally more accessible without an immediate key requirement for basic use.

const CMC_API_BASE = 'https://pro-api.coinmarketcap.com';
const CMC_SANDBOX_API_BASE = 'https://sandbox-api.coinmarketcap.com/v2'; // For testing

// Add this near the top of the file with other constants
let currentPopup = null;

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
    
    if (price < 0.0001) {
        // For extremely small prices (like SHIB), show 8 decimals
        return `$${price.toFixed(8)}`;
    } else if (price < 1) {
        // For prices under $1, show 4 decimals
        return `$${price.toFixed(4)}`;
    } else if (price < 10) {
        // For prices under $10, show 3 decimals
        return `$${price.toFixed(3)}`;
    } else {
        // For larger prices, show 2 decimals
        return `$${price.toFixed(2)}`;
    }
}

// Add this function to handle popup cleanup
function cleanupPopup() {
    if (currentPopup) {
        currentPopup.remove();
        currentPopup = null;
    }
}

// Function to create the popup (now handles all states)
function createPopup(button) {
    cleanupPopup();
    
    const popup = document.createElement('div');
    popup.classList.add('crypto-popup');
    popup.setAttribute('data-theme', isTwitterDarkMode() ? 'dark' : 'light');
    
    const header = document.createElement('div');
    header.className = 'popup-header';
    header.innerHTML = `
        <h2>Loading Prices...</h2>
        <span class="close-button">&times;</span>
    `;
    
    const closeButton = header.querySelector('.close-button');
    closeButton.addEventListener('click', cleanupPopup);
    
    popup.appendChild(header);
    
    // Rename this to main-content to avoid confusion
    const mainContent = document.createElement('div');
    mainContent.className = 'main-content';
    popup.appendChild(mainContent);
    
    document.body.appendChild(popup);
    positionPopup(popup, button);

    currentPopup = popup; // Store reference to current popup
    return popup;
}

function setPopupLoadingState(popup) {
    const content = popup.querySelector('.main-content');
    popup.querySelector('.popup-header h2').textContent = 'Loading Prices...';
    content.innerHTML = '<div class="loading-spinner"></div>';
}

function setPopupErrorState(popup, error) {
    const content = popup.querySelector('.main-content');
    popup.querySelector('.popup-header h2').textContent = 'Error';
    content.innerHTML = `<p class="error-message">${error.message}</p>`;
}

function setPopupDataState(popup, data) {
    const tokens = Array.isArray(data) ? data : [data];
    popup.querySelector('.popup-header h2').textContent = 'Token Performance';
    
    let content = '';
    
    if (tokens.length > 1) {
        content += `
            <div class="popup-tabs">
                <button class="tab-arrow left" disabled>←</button>
                <div class="tabs-container">
                    ${tokens.map((token, index) => `
                        <button class="popup-tab ${index === 0 ? 'active' : ''}" 
                                data-index="${index}">
                            $${token.tokenSymbol}
                        </button>
                    `).join('')}
                </div>
                <button class="tab-arrow right">→</button>
            </div>
        `;
    }

    content += `<div class="token-contents">`;
    content += tokens.map((token, index) => {
        if (!token || token.error) {
            return `
                <div class="token-content" data-index="${index}" 
                     style="display: ${index === 0 ? 'block' : 'none'}">
                    <p class="error-message">${token.message || 'Unknown error'}</p>
                </div>
            `;
        }
        
        try {
            return `
                <div class="token-content" data-index="${index}" 
                     style="display: ${index === 0 ? 'block' : 'none'}">
                    <p>Performance: <span class="${token.performance >= 0 ? 'positive' : 'negative'}">${Number(token.performance).toFixed(2)}%</span></p>
                    <p>Historical: ${formatPrice(token.historicalPrice)}</p>
                    <p>Current: ${formatPrice(token.currentPrice)}</p>
                    <p>Time: ${token.closestTimestamp}</p>
                </div>
            `;
        } catch (error) {
            console.error('Error processing token data:', error, token);
            return `
                <div class="token-content" data-index="${index}" 
                     style="display: ${index === 0 ? 'block' : 'none'}">
                    <p class="error-message">Error displaying data for ${token.tokenSymbol}</p>
                </div>
            `;
        }
    }).join('');
    content += '</div>';

    const mainContent = popup.querySelector('.main-content');
    mainContent.innerHTML = content;

    if (tokens.length > 1) {
        const tabsContainer = popup.querySelector('.tabs-container');
        const leftArrow = popup.querySelector('.tab-arrow.left');
        const rightArrow = popup.querySelector('.tab-arrow.right');
        const tabs = popup.querySelectorAll('.popup-tab');
        const contents = popup.querySelectorAll('.token-content');
        
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

        // Scrolling
        const updateArrowStates = () => {
            leftArrow.disabled = tabsContainer.scrollLeft <= 0;
            rightArrow.disabled = tabsContainer.scrollLeft >= tabsContainer.scrollWidth - tabsContainer.clientWidth;
        };

        leftArrow.addEventListener('click', () => {
            tabsContainer.scrollBy({ left: -100, behavior: 'smooth' });
        });

        rightArrow.addEventListener('click', () => {
            tabsContainer.scrollBy({ left: 100, behavior: 'smooth' });
        });

        tabsContainer.addEventListener('scroll', updateArrowStates);
        updateArrowStates();
    }
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
                
                popup = createPopup(getPerformanceButton);
                
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
                                resolve(Array.isArray(response) ? response : []);
                            }
                        });
                    });

                    setPopupDataState(popup, response);
                } catch (error) {
                    setPopupErrorState(popup, error);
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

// Update the style element with new CSS for tabs
const style = document.createElement('style');
style.textContent = `
    .loading-spinner {
        width: 30px;
        height: 30px;
        border: 3px solid #f3f3f3;
        border-top: 3px solid #3498db;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 20px auto;
    }
    
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }

    .error-message {
        color: #e74c3c;
        font-style: italic;
    }

    .popup-tabs {
        display: flex;
        align-items: center;
        overflow-x: hidden;
        position: relative;
        padding: 0 24px; /* Increased space for arrows */
        max-width: 300px;
        margin: 4px 0;
        border-bottom: none;
    }

    .tabs-container {
        display: flex;
        overflow-x: scroll;
        scroll-behavior: smooth;
        -ms-overflow-style: none;
        scrollbar-width: none;
    }

    .tabs-container::-webkit-scrollbar {
        display: none;
    }

    .tab-arrow {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        background: transparent;
        color: rgb(83, 100, 113);
        border: none;
        width: 24px;
        height: 24px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1;
        font-size: 20px;
        transition: background-color 0.2s;
        border-radius: 50%;
    }

    .tab-arrow:hover:not(:disabled) {
        background-color: rgba(15, 20, 25, 0.1);
        color: rgb(15, 20, 25);
    }

    .tab-arrow.left {
        left: 0;
    }

    .tab-arrow.right {
        right: 0;
    }

    .tab-arrow:disabled {
        opacity: 0.3;
        cursor: not-allowed;
    }

    .popup-tab {
        white-space: nowrap;
        padding: 8px 16px;
        margin: 0 2px;
        border: none;
        background: none;
        cursor: pointer;
        color: rgb(83, 100, 113);
        border-radius: 9999px;
        transition: background-color 0.2s, color 0.2s;
    }

    .popup-tab:hover {
        background-color: rgba(15, 20, 25, 0.1);
        color: rgb(15, 20, 25);
    }

    .popup-tab.active {
        color: rgb(29, 155, 240);
        font-weight: 500;
    }

    .popup-tab.active:hover {
        background-color: rgba(29, 155, 240, 0.1);
        color: rgb(29, 155, 240);
    }

    .crypto-popup {
        background-color: var(--popup-bg);
        border: 1px solid var(--border-color);
        color: var(--text-color);
        box-shadow: rgb(101 119 134 / 20%) 0px 0px 15px, rgb(101 119 134 / 15%) 0px 0px 3px 1px;
    }

    .popup-header {
        border-bottom: none;
        padding: 12px 16px 8px;
    }

    .close-button {
        color: var(--text-color);
    }

    .tab-arrow {
        color: var(--secondary-text);
    }

    .tab-arrow:hover:not(:disabled) {
        background-color: var(--hover-bg);
        color: var(--text-color);
    }

    .popup-tab {
        color: var(--secondary-text);
    }

    .popup-tab:hover {
        background-color: var(--hover-bg);
        color: var(--text-color);
    }

    .error-message {
        color: var(--error-color);
    }

    .positive {
        color: var(--positive-color);
    }

    .negative {
        color: var(--negative-color);
    }

    .popup-header h2 {
        color: var(--text-color);
        margin: 0;
    }

    .token-contents {
        padding-top: 8px;
    }

    /* Dark theme */
    .crypto-popup[data-theme="dark"] {
        --popup-bg: rgb(32, 35, 39);
        --border-color: rgb(47, 51, 54);
        --text-color: rgb(247, 249, 249);
        --secondary-text: rgb(139, 152, 165);
        --hover-bg: rgba(239, 243, 244, 0.1);
        --error-color: #ff7b72;
        --positive-color: #7ee787;
        --negative-color: #ff7b72;
    }

    /* Light theme */
    .crypto-popup[data-theme="light"] {
        --popup-bg: rgb(255, 255, 255);
        --border-color: rgb(239, 243, 244);
        --text-color: rgb(15, 20, 25);
        --secondary-text: rgb(83, 100, 113);
        --hover-bg: rgba(15, 20, 25, 0.1);
        --error-color: #e74c3c;
        --positive-color: #28a745;
        --negative-color: #dc3545;
    }
`;
document.head.appendChild(style);

// Add this function to handle all types of navigation
function setupNavigationCleanup() {
    // Regular navigation events
    window.addEventListener('popstate', cleanupPopup);
    window.addEventListener('beforeunload', cleanupPopup);

    // Twitter's SPA navigation
    const originalPushState = history.pushState;
    history.pushState = function() {
        originalPushState.apply(this, arguments);
        cleanupPopup();
    };

    const originalReplaceState = history.replaceState;
    history.replaceState = function() {
        originalReplaceState.apply(this, arguments);
        cleanupPopup();
    };

    // Monitor URL changes
    let lastUrl = location.href;
    new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
            lastUrl = url;
            cleanupPopup();
        }
    }).observe(document, { subtree: true, childList: true });
}

// Call this at the bottom of your file
setupNavigationCleanup();

// Add this function to detect Twitter's theme
function isTwitterDarkMode() {
    const container = document.querySelector('html[style*="color-scheme"]');
    return container?.style.colorScheme === 'dark';
} 
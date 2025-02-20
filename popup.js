// You can add any popup functionality here if needed,
// like options to change API source or display general status.
document.addEventListener('DOMContentLoaded', () => {
  // Check if the content script is running (you can't directly check,
  // but this is a placeholder for potential popup interactions)
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (tabs && tabs.length > 0) {
      // You can send a message to the content script if needed
      // chrome.tabs.sendMessage(tabs[0].id, { message: "popupOpened" });
    } else {
      document.getElementById('status').textContent = 'Not active on a Twitter page.';
    }
  });

  const apiKeyInput = document.getElementById('apiKeyInput');
  const saveButton = document.getElementById('saveButton');
  const statusDiv = document.getElementById('status');

  // Load any previously saved API key
  chrome.storage.sync.get(['cmcApiKey'], function(result) {
    console.log('Loaded API Key:', result.cmcApiKey);
    if (result.cmcApiKey) {
      apiKeyInput.value = result.cmcApiKey;
    }
  });

  saveButton.addEventListener('click', () => {
    const apiKey = apiKeyInput.value.trim();
    if (apiKey) {
      // Save the API key using chrome.storage.sync
      chrome.storage.sync.set({ 'cmcApiKey': apiKey }, function() {
        console.log('API Key saved:', apiKey);
        statusDiv.textContent = 'API Key saved.';
        statusDiv.style.color = 'green';
        setTimeout(() => { statusDiv.textContent = ''; }, 3000); // Clear message after 3 seconds
      });
    } else {
      statusDiv.textContent = 'Please enter an API key.';
      statusDiv.style.color = 'red';
    }
  });

  // Optional:  You could add a message listener here to communicate with content.js
  // For example, to tell content.js to re-scan tweets when the API key is saved.
}); 
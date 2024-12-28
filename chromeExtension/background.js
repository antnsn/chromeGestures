// Optimized message handling for tab operations
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[Debug] Background received message:', message);

    if (!sender.tab) {
        console.error('No sender tab information');
        return false;
    }

    switch (message.command) {
        case 'close_tab':
            chrome.tabs.remove(sender.tab.id)
                .catch(error => console.error('Error closing tab:', error));
            break;
            
        case 'reopen_tab':
            chrome.sessions.restore()
                .catch(error => console.error('Error reopening tab:', error));
            break;
    }

    return false; // Don't keep message channel open
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message === 'close_tab') {
        chrome.tabs.remove(sender.tab.id); // Close the current tab
    }
});

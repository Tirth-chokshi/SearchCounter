chrome.action.onClicked.addListener((tab) => {
  // Inject script to manually trigger counters
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      // Use manual trigger function
      if (typeof window.manualAddCounters === 'function') {
        window.manualAddCounters();
      } else if (typeof addCounters === 'function') {
        addCounters();
      } else {
        console.log('[Counter] Functions not available, content script may not be loaded');
        // Force reload content script
        location.reload();
      }
    }
  });
});

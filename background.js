let isMobile = false;

chrome.action.onClicked.addListener((tab) => {
  isMobile = !isMobile;

  chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [1],
    addRules: isMobile ? [{
      id: 1,
      priority: 1,
      action: {
        type: 'modifyHeaders',
        requestHeaders: [{
          header: 'user-agent',
          operation: 'set',
          value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1.1 Mobile/15E148 Safari/604.1'
        }]
      },
      condition: { urlFilter: '*://*.google.com/*', resourceTypes: ['main_frame'] }
    }] : []
  }, () => {
    chrome.tabs.reload(tab.id);
  });
});

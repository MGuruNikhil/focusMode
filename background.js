const blockRules = [];

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({ blockedUrls: [], timerEnd: null });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'unblockWebsites') {
    unblockWebsites();
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'startBlocking') {
    startBlocking(message.urls, message.duration);
    sendResponse({ status: 'Blocking started' });
  } else if (message.action === 'getTimerStatus') {
    chrome.storage.sync.get(['timerEnd'], (data) => {
      sendResponse({ timerEnd: data.timerEnd || null });
    });
    return true; // Keep the messaging channel open for async response
  } else if (message.action === 'stopBlocking') {
    clearBlocking();
    sendResponse({ status: 'Blocking stopped' });
  }
});

function startBlocking(urls, duration) {
  const currentTime = Date.now();
  const endTime = currentTime + duration * 60000; // duration in minutes

  const rules = urls.map((url, index) => ({
    id: index + 1,
    priority: 1,
    action: { type: 'block' },
    condition: { urlFilter: url, resourceTypes: ['main_frame'] }
  }));

  blockRules.push(...rules);

  chrome.declarativeNetRequest.updateDynamicRules({
    addRules: blockRules,
    removeRuleIds: blockRules.map(rule => rule.id)
  });

  chrome.storage.sync.set({ timerEnd: endTime });

  chrome.alarms.create('unblockWebsites', { when: endTime });
}

function unblockWebsites() {
  clearBlocking();
}

function clearBlocking() {
  const ruleIdsToRemove = blockRules.map(rule => rule.id);

  chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: ruleIdsToRemove
  }, () => {
    chrome.storage.sync.set({ timerEnd: null });
    chrome.alarms.clear('unblockWebsites'); // Clear the alarm if stopping manually
    blockRules.length = 0; // Clear the in-memory blockRules
  });
}

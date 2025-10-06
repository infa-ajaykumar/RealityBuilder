let config = {};
let detectedAlerts = [];

const MONITORING_ALARM_NAME = 'opsgenie-monitor-alarm';

// Consolidated message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'startMonitoring':
      startMonitoring(message.config);
      break;
    case 'stopMonitoring':
      stopMonitoring();
      break;
    case 'getAlerts':
      sendResponse({ alerts: detectedAlerts });
      break;
    case 'foundAlerts':
      handleFoundAlerts(message.alerts);
      break;
  }
  return true; // Keep the message channel open for asynchronous response
});

function handleFoundAlerts(alerts) {
    console.log('Received alerts from content script:', alerts);
    detectedAlerts = alerts;
    chrome.action.setBadgeText({ text: String(detectedAlerts.length || '') });

    // Notify the popup if it's open
    chrome.runtime.sendMessage({ action: 'updateAlerts', alerts: detectedAlerts }).catch(e => console.log("Popup not open."));

    // Show a system notification if there are new alerts
    if (detectedAlerts.length > 0) {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: 'Opsgenie Alert Monitor',
            message: `Found ${detectedAlerts.length} alert(s) matching your criteria.`,
            priority: 2
        });
    }
}

// Function to start monitoring
function startMonitoring(newConfig) {
  config = newConfig;
  console.log('Monitoring started with config:', config);

  chrome.storage.local.set({ config, isMonitoring: true });

  chrome.alarms.create(MONITORING_ALARM_NAME, {
    delayInMinutes: 0, // Fire immediately
    periodInMinutes: config.monitoringInterval / 60,
  });

  chrome.action.setBadgeBackgroundColor({ color: '#007bff' });
}

// Function to stop monitoring
function stopMonitoring() {
  console.log('Monitoring stopped.');
  chrome.storage.local.set({ isMonitoring: false });
  chrome.alarms.clear(MONITORING_ALARM_NAME);
  chrome.action.setBadgeText({ text: '' });
  detectedAlerts = [];
}

// Listener for the alarm
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === MONITORING_ALARM_NAME) {
    chrome.storage.local.get(['config', 'isMonitoring'], (result) => {
      if (result.isMonitoring && result.config) {
        console.log('Alarm triggered, checking for alerts...');
        config = result.config; // Update config
        triggerMonitoring();
      }
    });
  }
});

// Function to trigger the content script
async function triggerMonitoring() {
  if (!config.opsgenieUrl) {
    console.error('Opsgenie URL is not configured.');
    return;
  }

  try {
    const tabs = await chrome.tabs.query({ url: `${config.opsgenieUrl}*`, status: 'complete' });

    if (tabs.length === 0) {
      console.warn(`No active tab for URL: ${config.opsgenieUrl}.`);
      chrome.action.setBadgeText({ text: '?' });
      return;
    }

    const tab = tabs[0];

    // Inject the content script and then send it the config
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js'],
    });

    chrome.tabs.sendMessage(tab.id, {
        action: 'scanDOM',
        config: config
    });

    console.log('Content script instructed to scan.');

  } catch (error) {
    console.error('Error during monitoring trigger:', error);
    chrome.action.setBadgeText({ text: 'ERR' });
  }
}

// Restore monitoring state on extension startup
chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.get(['config', 'isMonitoring'], (result) => {
    if (result.isMonitoring && result.config) {
      console.log('Restoring monitoring state on startup.');
      startMonitoring(result.config);
    }
  });
});
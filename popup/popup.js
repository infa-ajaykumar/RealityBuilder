document.addEventListener('DOMContentLoaded', () => {
  const configForm = document.getElementById('config-form');
  const opsgenieUrlInput = document.getElementById('opsgenie-url');
  const alertTypeInput = document.getElementById('alert-type');
  const actionTypeSelect = document.getElementById('action-type');
  const intervalInput = document.getElementById('monitoring-interval');
  const autoActionCheckbox = document.getElementById('auto-action-enabled');
  const startButton = document.getElementById('start-monitoring');
  const stopButton = document.getElementById('stop-monitoring');
  const statusMessage = document.getElementById('status-message');
  const alertsList = document.getElementById('alerts-list');

  // Load saved configuration and update UI
  const loadConfig = () => {
    chrome.storage.local.get(['config', 'isMonitoring'], ({ config, isMonitoring }) => {
      if (config) {
        opsgenieUrlInput.value = config.opsgenieUrl || '';
        alertTypeInput.value = config.alertType || '';
        actionTypeSelect.value = config.actionType || 'Acknowledge';
        intervalInput.value = config.monitoringInterval || 60;
        autoActionCheckbox.checked = config.autoActionEnabled || false;
      }
      updateUI(isMonitoring || false);
    });
  };

  // Update UI elements based on monitoring state
  const updateUI = (isMonitoring) => {
    startButton.disabled = isMonitoring;
    stopButton.disabled = !isMonitoring;
    opsgenieUrlInput.disabled = isMonitoring;
    alertTypeInput.disabled = isMonitoring;
    actionTypeSelect.disabled = isMonitoring;
    intervalInput.disabled = isMonitoring;
    autoActionCheckbox.disabled = isMonitoring;
    statusMessage.textContent = isMonitoring ? `Monitoring: ${opsgenieUrlInput.value}` : 'Not currently monitoring.';
  };

  // Event listener for starting monitoring
  configForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const config = {
      opsgenieUrl: opsgenieUrlInput.value,
      alertType: alertTypeInput.value,
      actionType: actionTypeSelect.value,
      monitoringInterval: parseInt(intervalInput.value, 10),
      autoActionEnabled: autoActionCheckbox.checked,
    };

    chrome.storage.local.set({ config, isMonitoring: true }, () => {
      chrome.runtime.sendMessage({ action: 'startMonitoring', config });
      updateUI(true);
    });
  });

  // Event listener for stopping monitoring
  stopButton.addEventListener('click', () => {
    chrome.storage.local.set({ isMonitoring: false }, () => {
      chrome.runtime.sendMessage({ action: 'stopMonitoring' });
      updateUI(false);
    });
  });

  // Listen for updates from the background script
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'updateAlerts') {
      alertsList.innerHTML = ''; // Clear previous list
      if (message.alerts && message.alerts.length > 0) {
        message.alerts.forEach(alertText => {
          const li = document.createElement('li');
          li.textContent = alertText;
          alertsList.appendChild(li);
        });
      } else {
        alertsList.innerHTML = '<li>No matching alerts found.</li>';
      }
    }
  });

  // Initial load
  loadConfig();
  // Request initial alert list update from background
  chrome.runtime.sendMessage({ action: 'getAlerts' });
});
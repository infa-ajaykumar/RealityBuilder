// Listen for a message from the background script to start scanning
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'scanDOM') {
    console.log('Content script received scanDOM command with config:', message.config);
    const alerts = findMatchingAlerts(message.config);

    // Send the found alerts back to the background script
    chrome.runtime.sendMessage({ action: 'foundAlerts', alerts: alerts });
  }
});

/**
 * Finds alerts on the page that match the user's criteria.
 * @param {object} config - The user's configuration.
 * @returns {string[]} - An array of strings, where each string is the text of a matching alert.
 */
function findMatchingAlerts(config) {
  // --- IMPORTANT ---
  // These selectors are configured to work with the included `sample_alert.html`.
  // You may need to adjust them to match your live Opsgenie page's DOM structure.
  const ALERT_ROW_SELECTOR = '.alert-list-item'; // A selector for the container of a single alert
  const ALERT_TEXT_SELECTOR = '.alert-message'; // A selector for the element containing the alert's description/text

  const matchingAlerts = [];
  const alertRows = document.querySelectorAll(ALERT_ROW_SELECTOR);

  if (alertRows.length === 0) {
    console.log('No alert rows found with selector:', ALERT_ROW_SELECTOR);
    return [];
  }

  alertRows.forEach(row => {
    const alertTextElement = row.querySelector(ALERT_TEXT_SELECTOR);
    if (alertTextElement) {
      const alertText = alertTextElement.textContent.trim();

      // Check if the alert text contains the user-specified type/status
      if (alertText.toLowerCase().includes(config.alertType.toLowerCase())) {
        matchingAlerts.push(alertText);

        // If auto-action is enabled, perform the specified action
        if (config.autoActionEnabled) {
          performAction(row, config.actionType);
        }
      }
    }
  });

  console.log(`Found ${matchingAlerts.length} matching alerts.`);
  return matchingAlerts;
}

/**
 * Placeholder for performing an action like "Acknowledge" or "Close".
 * @param {HTMLElement} alertRow - The DOM element for the alert row.
 * @param {string} actionType - The action to perform ('Acknowledge' or 'Close').
 */
function performAction(alertRow, actionType) {
  // --- IMPORTANT ---
  // These selectors are also placeholders.
  const ACK_BUTTON_SELECTOR = 'button.acknowledge-button';
  const CLOSE_BUTTON_SELECTOR = 'button.close-button';

  let button;
  if (actionType === 'Acknowledge') {
    button = alertRow.querySelector(ACK_BUTTON_SELECTOR);
  } else if (actionType === 'Close') {
    button = alertRow.querySelector(CLOSE_BUTTON_SELECTOR);
  }

  if (button) {
    console.log(`Performing action: ${actionType}`);
    button.click();
  } else {
    console.warn(`Could not find button for action '${actionType}' in alert row.`);
  }
}
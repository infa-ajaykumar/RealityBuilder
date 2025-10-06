# Opsgenie Alert Monitor Chrome Extension

This Chrome extension allows you to monitor a specific Opsgenie alert page for alerts that match your criteria. When a matching alert is found, it can notify you and, if configured, automatically perform an action like "Acknowledge" or "Close".

## Features

- **Configurable Monitoring**: Specify the exact Opsgenie URL, alert type/status, and monitoring frequency.
- **Automated Actions**: Automatically "Acknowledge" or "Close" alerts (feature in development).
- **Desktop Notifications**: Get native desktop notifications when new alerts are detected.
- **Badge Count**: The extension icon shows the number of currently detected alerts.
- **Popup UI**: A simple interface to configure settings, start/stop monitoring, and see a list of detected alerts.
- **Persistent Settings**: Your configuration is saved locally and restored when you restart your browser.

## Installation

1.  Clone or download this repository to your local machine.
2.  Open Google Chrome and navigate to `chrome://extensions`.
3.  Enable "Developer mode" using the toggle in the top-right corner.
4.  Click the "Load unpacked" button.
5.  Select the directory where you saved this project.
6.  The Opsgenie Alert Monitor extension should now appear in your list of extensions.

## How to Use

1.  Click the extension icon in your Chrome toolbar to open the popup.
2.  **Opsgenie URL**: Enter the full URL of the Opsgenie alert page you want to monitor (e.g., `https://your-org.opsgenie.com/alert`).
3.  **Alert Type/Status**: Enter a keyword or phrase to identify the alerts you want to track (e.g., `open`, `P1`, `unacknowledged`). The check is case-insensitive.
4.  **Action to Perform**: Choose "Acknowledge" or "Close" from the dropdown. (Note: This feature is not yet fully implemented and requires correct selectors).
5.  **Monitoring Interval**: Set how often (in seconds) the extension should check for alerts.
6.  Click **"Start Monitoring"**.

The extension will now periodically check the specified URL. Make sure you have a tab open to that URL for the monitoring to work.

## **IMPORTANT**: Configuring DOM Selectors

The most critical part of configuring this extension is ensuring it can correctly identify alerts on the page. This is done using CSS selectors in the `content.js` file. The default selectors are **placeholders** and will likely **not** work with your Opsgenie instance out-of-the-box.

You must update them by following these steps:

1.  **Open `content.js`** in a text editor.
2.  Navigate to your Opsgenie alert page in Chrome.
3.  **Right-click** on an alert you want to monitor and select **"Inspect"** to open Chrome DevTools.
4.  Find the main HTML element that contains a single alert row. Note its class name or another unique selector. This is your `ALERT_ROW_SELECTOR`.
5.  Within that row, find the element that contains the alert's summary text. This is your `ALERT_TEXT_SELECTOR`.
6.  Update the placeholder values at the top of `content.js`:

    ```javascript
    // content.js

    // --- IMPORTANT ---
    // Update these selectors to match your Opsgenie page's HTML structure.
    const ALERT_ROW_SELECTOR = '.your-alert-row-class'; // e.g., '.alert-list-item' or '[data-testid="alert-list-item"]'
    const ALERT_TEXT_SELECTOR = '.your-alert-text-class'; // e.g., '.alert-message-text'
    ```

7.  Save the `content.js` file and reload the extension from the `chrome://extensions` page.

## Testing with `sample_alert.html`

To help you test your selector configuration without needing live alerts, a `sample_alert.html` file is included. You can open this file in your browser, configure the extension to monitor its local file path, and test the scraping logic.

## Troubleshooting

-   **Not working?** The most common issue is incorrect selectors in `content.js`. Double-check them using DevTools.
-   **Badge shows '?'**: This means the extension could not find an open tab matching the configured URL. Make sure the tab is open and the URL is correct.
-   **Badge shows 'ERR'**: An error occurred while trying to run the monitor. Check the extension's console for more details (right-click the extension icon > "Inspect popup" and check the "Console" tab, or view the service worker logs from `chrome://extensions`).
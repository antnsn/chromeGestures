// Debug function
function debugLog(message, data) {
  // Logging disabled by default to avoid spamming the console.
  // To re-enable, replace this body with a console.log.
}

// Load and save settings
async function loadSettings() {
  try {
    debugLog("Loading settings from storage");
    const result = await chrome.storage.sync.get("gestureSettings");
    debugLog("Loaded settings", result);

    // If no settings exist, create and save default settings
    if (!result.gestureSettings) {
      const defaultSettings = {
        activationButton: 2,
        sensitivity: 3,
        tolerance: 3,
      };
      await chrome.storage.sync.set({ gestureSettings: defaultSettings });
      debugLog("Saved default settings", defaultSettings);
      result.gestureSettings = defaultSettings;
    }

    const select = document.getElementById("activationKey");
    if (select) {
      // Clear any existing selection
      Array.from(select.options).forEach((opt) => (opt.selected = false));

      // Set the new value
      const value = result.gestureSettings.activationButton.toString();
      select.value = value;
      const option = select.querySelector(`option[value="${value}"]`);
      if (option) {
        option.selected = true;
        debugLog("Selected option", { value, text: option.text });
      }
    }

    const sensitivitySelect = document.getElementById("sensitivity");
    if (sensitivitySelect) {
      const sensitivity = (result.gestureSettings.sensitivity ?? 3).toString();
      sensitivitySelect.value = sensitivity;
    }

    const toleranceSelect = document.getElementById("tolerance");
    if (toleranceSelect) {
      const tolerance = (result.gestureSettings.tolerance ?? 3).toString();
      toleranceSelect.value = tolerance;
    }
  } catch (error) {
    console.error("Error loading settings:", error);
  }
}

async function saveSettings() {
  try {
    const select = document.getElementById("activationKey");
    const sensitivitySelect = document.getElementById("sensitivity");
    const toleranceSelect = document.getElementById("tolerance");

    if (!select || !sensitivitySelect || !toleranceSelect) return;

    const activationButton = parseInt(select.value, 10);
    const sensitivity = parseInt(sensitivitySelect.value, 10) || 3;
    const tolerance = parseInt(toleranceSelect.value, 10) || 3;
    const settings = {
      activationButton,
      sensitivity,
      tolerance,
    };

    debugLog("Saving settings", settings);
    await chrome.storage.sync.set({ gestureSettings: settings });

    // Get the current active tab
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab) {
      try {
        // Try to notify content script
        await chrome.tabs.sendMessage(tab.id, {
          type: "settingsUpdated",
          settings,
        });
      } catch (e) {
        // If content script is not available, reload the tab to apply new settings
        debugLog("Content script not available, reloading tab");
        await chrome.tabs.reload(tab.id);
      }
    }
  } catch (error) {
    console.error("Error in saveSettings:", error);
  }
}

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", async () => {
  debugLog("DOM Content Loaded");
  await loadSettings();

  // Add change event listener
  const select = document.getElementById("activationKey");
  const sensitivitySelect = document.getElementById("sensitivity");
  const toleranceSelect = document.getElementById("tolerance");

  if (select) {
    select.addEventListener("change", saveSettings);
    debugLog("Added activationKey change event listener");
  }

  if (sensitivitySelect) {
    sensitivitySelect.addEventListener("change", saveSettings);
    debugLog("Added sensitivity change event listener");
  }

  if (toleranceSelect) {
    toleranceSelect.addEventListener("change", saveSettings);
    debugLog("Added tolerance change event listener");
  }
});

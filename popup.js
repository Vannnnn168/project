/* popup.js */
const LABELS = { off: "Disabled", "12m": "12 Months", "6m_ss": "6 Months (SS)", "6m": "6 Months", "6m_2": "6 Months (Alt)" };
const stateEl = document.getElementById("state");
const controlBox = document.getElementById("control-box");
const machineIdDisplay = document.getElementById("machine-id-display");
const licenseInput = document.getElementById("license-key-input");
const activateBtn = document.getElementById("activate-btn");

const LOCAL_SECRET = "YOUR_SUPER_SECRET_SIGNING_KEY_123!";
const REVOKE_LIST_URL = "https://raw.githubusercontent.com/Vannnnn168/project/main/revoked.json";

async function getRealMachineID() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["gapt_machine_id"], async (data) => {
      if (data && data.gapt_machine_id) return resolve(data.gapt_machine_id);

      const getCpuInfo = () => new Promise((res) => {
        if (chrome.system && chrome.system.cpu) {
          chrome.system.cpu.getInfo((info) => res((info.modelName || "CPU") + "-" + (info.numOfProcessors || 4)));
        } else { res("CPU-UNKNOWN"); }
      });

      const getStorageInfo = () => new Promise((res) => {
        if (chrome.system && chrome.system.storage) {
          chrome.system.storage.getInfo((units) => {
            const first = units && units.length > 0 ? units[0] : null;
            res(first ? ((first.name || "DISK") + "-" + (first.capacity || 0)) : "STORAGE-UNKNOWN");
          });
        } else { res("STORAGE-UNKNOWN"); }
      });

      const [cpu, storage] = await Promise.all([getCpuInfo(), getStorageInfo()]);
      const raw = `${cpu}___${storage}`;
      const msgBuffer = new TextEncoder().encode(raw);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();

      const machineId = `${hashHex.slice(0, 4)}-${hashHex.slice(4, 8)}-${hashHex.slice(8, 12)}-${hashHex.slice(12, 16)}`;
      chrome.storage.local.set({ gapt_machine_id: machineId }, () => resolve(machineId));
    });
  });
}

async function verifyOfflineKey(machineId, inputKey) {
  try {
    const enc = new TextEncoder();
    const keyData = enc.encode(LOCAL_SECRET);
    const msgData = enc.encode(machineId.toUpperCase().trim());

    const cryptoKey = await crypto.subtle.importKey(
      "raw", keyData, { name: "HMAC", hash: { name: "SHA-256" } }, false, ["sign"]
    );
    
    const signature = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
    const hashArray = Array.from(new Uint8Array(signature));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();

    const expectedKey = `${hashHex.slice(0,4)}-${hashHex.slice(4,8)}-${hashHex.slice(8,12)}-${hashHex.slice(12,16)}`;
    return inputKey.trim().toUpperCase() === expectedKey;
  } catch (e) {
    return false;
  }
}

async function isKeyRevoked(inputKey) {
  try {
    const response = await fetch(REVOKE_LIST_URL);
    if (!response.ok) return false;
    const revokedKeys = await response.json();
    return revokedKeys.includes(inputKey.trim().toUpperCase());
  } catch (e) {
    return false;
  }
}

async function initActivation() {
  const machineId = await getRealMachineID();
  machineIdDisplay.textContent = machineId;

  chrome.storage.local.get(["gapt_activated", "gapt_license_key"], async (data) => {
    if (data.gapt_activated && data.gapt_license_key) {
      const revoked = await isKeyRevoked(data.gapt_license_key);
      if (revoked) {
        chrome.storage.local.remove(["gapt_activated", "gapt_license_key"]);
        stateEl.className = "error";
        stateEl.textContent = "This license key has been revoked!";
        return;
      }

      const isValid = await verifyOfflineKey(machineId, data.gapt_license_key);
      if (isValid) {
        licenseInput.value = data.gapt_license_key;
        licenseInput.disabled = true;
        activateBtn.textContent = "Active ✓";
        activateBtn.disabled = true;
        controlBox.classList.remove("locked");
        checkInjectionState();
      } else {
        chrome.storage.local.remove(["gapt_activated", "gapt_license_key"]);
      }
    }
  });
}

activateBtn.addEventListener("click", async () => {
  const key = licenseInput.value.trim();
  const machineId = machineIdDisplay.textContent;

  if (!key || key.length < 15) {
    stateEl.className = "error";
    stateEl.textContent = "Please enter a valid license key.";
    return;
  }

  // Prevent activation if key has been revoked on GitHub blocklist
  const revoked = await isKeyRevoked(key);
  if (revoked) {
    stateEl.className = "error";
    stateEl.textContent = "This license key has been revoked and cannot be used!";
    return;
  }

  const isValid = await verifyOfflineKey(machineId, key);

  if (isValid) {
    chrome.storage.local.set({ gapt_activated: true, gapt_license_key: key }, () => {
      licenseInput.disabled = true;
      activateBtn.textContent = "Active ✓";
      activateBtn.disabled = true;
      controlBox.classList.remove("locked");
      stateEl.className = "ok";
      stateEl.textContent = "Activated successfully!";
    });
  } else {
    stateEl.className = "error";
    stateEl.textContent = "Invalid key for this machine!";
  }
});

function paintState(st) {
  chrome.storage.local.get(["gapt_activated"], (data) => {
    if (!data.gapt_activated) return;
    const layer = (st && st.layer) || "off";
    const mounted = !!(st && st.mounted) && layer !== "off";
    stateEl.className = mounted ? "ok" : "warn";
    stateEl.textContent = mounted
      ? "Mounted: " + (LABELS[layer] || layer) + " — Ready"
      : "Injection not detected on current page (refresh one.google.com)";
  });
}

function checkInjectionState() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const t = tabs && tabs[0];
    if (!t) return;
    chrome.tabs.sendMessage(t.id, { type: "getState" }, (resp) => {
      if (chrome.runtime.lastError || !resp) return;
      paintState(resp);
    });
  });
}

chrome.storage.local.get(["gapt_layer", "gapt_activated"], (r) => {
  initActivation();
  const layer = (r && r.gapt_layer) || "off";
  document.querySelectorAll('input[name="layer"]').forEach((el) => {
    el.checked = el.value === layer;
    el.addEventListener("change", () => {
      if (!el.checked) return;
      chrome.storage.local.set({ gapt_layer: el.value }, () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          const t = tabs && tabs[0];
          if (!t) return checkInjectionState();
          chrome.tabs.sendMessage(t.id, { type: "setLayer", layer: el.value }, () => {
            void chrome.runtime.lastError;
            setTimeout(checkInjectionState, 350);
          });
        });
      });
    });
  });
  if (r.gapt_activated) {
    checkInjectionState();
    setInterval(checkInjectionState, 1500);
  }
});
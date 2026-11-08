// license_client.js
async function getMachineID() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["gapt_machine_id"], async (data) => {
      if (data && data.gapt_machine_id) {
        return resolve(data.gapt_machine_id);
      }
      // Generate a robust pseudo-unique machine fingerprint
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      const debugInfo = gl ? gl.getExtension('WEBGL_debug_renderer_info') : null;
      const renderer = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'unknown';
      
      const rawId = navigator.hardwareConcurrency + "-" + 
                    navigator.maxTouchPoints + "-" + 
                    renderer + "-" + 
                    screen.width + "x" + screen.height;
      
      const msgBuffer = new TextEncoder().encode(rawId);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
      
      const machineId = `${hashHex.slice(0,4)}-${hashHex.slice(4,8)}-${hashHex.slice(8,12)}-${hashHex.slice(12,16)}`;
      chrome.storage.local.set({ gapt_machine_id: machineId }, () => resolve(machineId));
    });
  });
}

// Simple client-side offline verification check (or verify via API)
function verifyKeyFormat(key) {
  const regex = /^[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/;
  return regex.test(key.trim().toUpperCase());
}
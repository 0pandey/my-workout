
/* My Workout — Settings V3 */

(() => {
  const KEY = "my-workout-profile-v1";

  const defaults = {
    weight: 70,
    height: 178,
    strengthGoal: 3,
    runningGoal: 2
  };

  const $s = id => document.getElementById(id);

  function readProfile() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || "{}");
      return { ...defaults, ...saved };
    } catch {
      return { ...defaults };
    }
  }

  let profile = readProfile();
  let editing = false;

  function renderSettings() {
    const root = $s("settingsPage");
    if (!root) return;

    root.innerHTML = `
      <div class="card settings-v3">
        <div class="sv3-heading">
          <span>MY WORKOUT</span>
          <h2>Settings</h2>
          <p>Your profile & preferences</p>
        </div>

        <div class="sv3-panel">
          <div class="sv3-panel-title">
            <h3>👤 My Profile</h3>
            <button id="sv3-edit" type="button"
              class="secondary" ${editing ? 'hidden' : ''}>
              ✎ Edit
            </button>
          </div>

          <div id="sv3-overview" ${editing ? 'hidden' : ''}>
            <div class="sv3-metrics">
              <div class="sv3-metric">
                <span>Weight</span>
                <strong>${profile.weight}<small> kg</small></strong>
              </div>
              <div class="sv3-metric">
                <span>Height</span>
                <strong>${profile.height}<small> cm</small></strong>
              </div>
            </div>

            <div class="sv3-goals">
              <h3>🎯 Weekly Training Goal</h3>
              <div>
                <span>🏋️ Strength Training</span>
                <strong>${profile.strengthGoal} days/week</strong>
              </div>
              <div>
                <span>🏃 Running</span>
                <strong>${profile.runningGoal} days/week</strong>
              </div>
            </div>
          </div>

          <form id="sv3-form" ${editing ? '' : 'hidden'}>
            <label>Weight (kg)</label>
            <input id="sv3-weight" type="number"
              min="1" max="500" step="0.1"
              value="${profile.weight}" required>

            <label>Height (cm)</label>
            <input id="sv3-height" type="number"
              min="50" max="250" step="0.1"
              value="${profile.height}" required>

            <label>Strength Training (days/week)</label>
            <input id="sv3-strength" type="number"
              min="0" max="7" step="1"
              value="${profile.strengthGoal}" required>

            <label>Running (days/week)</label>
            <input id="sv3-running" type="number"
              min="0" max="7" step="1"
              value="${profile.runningGoal}" required>

            <p id="sv3-error" class="sv3-error"
              role="alert"></p>

            <div class="sv3-actions">
              <button id="sv3-cancel" type="button"
                class="secondary">Cancel</button>
              <button type="submit">Save Changes</button>
            </div>
          </form>
        </div>

        <div class="sv3-panel">
          <h3>💾 Data & Backup</h3>
          <p class="muted">
            สำรองข้อมูลการฝึกและรูปภาพ
            เพื่อใช้เมื่อเปลี่ยนโทรศัพท์
          </p>

          <div class="sv3-backup">
            <button id="backup" type="button">
              ↓ Backup Data
            </button>
            <button id="restore" type="button"
              class="secondary">
              ↑ Restore Data
            </button>
          </div>

          <input id="restoreFile" type="file"
            accept="application/json,.json"
            class="hidden">

          <p class="muted sv3-note">
            ข้อมูลเก็บในอุปกรณ์นี้
            ควรสำรองเป็นระยะ
          </p>
        </div>
      </div>
    `;

    $s("sv3-edit").onclick = () => {
      editing = true;
      renderSettings();
    };

    $s("sv3-cancel").onclick = () => {
      editing = false;
      renderSettings();
    };

    $s("sv3-form").onsubmit = event => {
      event.preventDefault();

      const weight = Number($s("sv3-weight").value);
      const height = Number($s("sv3-height").value);
      const strengthGoal = Number($s("sv3-strength").value);
      const runningGoal = Number($s("sv3-running").value);

      const valid =
        weight > 0 && weight <= 500 &&
        height >= 50 && height <= 250 &&
        Number.isInteger(strengthGoal) &&
        Number.isInteger(runningGoal) &&
        strengthGoal >= 0 &&
        runningGoal >= 0 &&
        strengthGoal + runningGoal <= 7;

      if (!valid) {
        $s("sv3-error").textContent =
          "กรุณาตรวจสอบข้อมูลและจำนวนวันฝึก";
        return;
      }

      const updated = {
        weight,
        height,
        strengthGoal,
        runningGoal
      };

      try {
        localStorage.setItem(KEY, JSON.stringify(updated));
        profile = updated;
        editing = false;
        renderSettings();
      } catch {
        $s("sv3-error").textContent =
          "บันทึกไม่สำเร็จ กรุณาลองใหม่";
      }
    };
  }

  // Keep the original backup/restore handlers alive:
  // This file only replaces the visual layout after initialization.
  document.addEventListener("DOMContentLoaded", () => {
    const backupButton = $s("backup");
    const restoreButton = $s("restore");
    const restoreFile = $s("restoreFile");

    const originalBackup = backupButton?.onclick;
    const originalRestore = restoreButton?.onclick;
    const originalFileChange = restoreFile?.onchange;

    function refresh() {
      renderSettings();

      $s("backup").onclick = originalBackup;
      $s("restore").onclick = originalRestore;
      $s("restoreFile").onchange = originalFileChange;
    }

    // Rebind after each profile view update.
    const originalRender = renderSettings;
    renderSettings = function () {
      originalRender();
      $s("backup").onclick = originalBackup;
      $s("restore").onclick = originalRestore;
      $s("restoreFile").onchange = originalFileChange;
    };

    refresh();
  });
})();

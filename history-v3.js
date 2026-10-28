
/* My Workout — History V3
   Reads existing IndexedDB-loaded records and exercises.
   Does not delete or rewrite workout data.
*/

const HistoryV3 = (() => {
  let period = "month";
  let selectedYear = new Date().getFullYear();
  let selectedMonth = new Date().getMonth();
  let category = "all";
  let search = "";
  let selectedDate = null;
  let page = 1;

  const PAGE_SIZE = 15;

  const escapeHTML = value =>
    String(value ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[c]);

  function typeOf(ex, detail = {}) {
    if (ex?.type === "cardio") return "cardio";
    if (ex?.type === "timed") return "timed";
    if (ex?.type === "strength") return "strength";

    const name = (ex?.name || "").toLowerCase();
    if (/run|วิ่ง|jog|walk|เดิน/.test(name)) return "cardio";
    if (/plank|แพลงก์|hold/.test(name)) return "timed";

    if ("distance" in detail || "minutes" in detail)
      return "cardio";

    return "strength";
  }

  function activities(record) {
    const ids = new Set([
      ...Object.keys(record.done || {}),
      ...Object.keys(record.details || {})
    ]);

    return [...ids].map(id => {
      const ex = exercises.find(e => String(e.id) === String(id));
      const detail = record.details?.[id] || {};
      const type = typeOf(ex, detail);
      const sets = Array.isArray(detail.sets) ? detail.sets : [];

      const hasSets = sets.some(s =>
        s.done ||
        s.weight !== "" && s.weight != null ||
        s.reps !== "" && s.reps != null ||
        s.seconds !== "" && s.seconds != null
      );

      const hasCardio =
        detail.distance !== "" && detail.distance != null ||
        detail.minutes !== "" && detail.minutes != null;

      const hasLegacy =
        detail.weight !== "" && detail.weight != null ||
        detail.reps !== "" && detail.reps != null;

      const recorded = !!record.done?.[id] ||
        hasSets || hasCardio || hasLegacy;

      return {
        id,
        name: ex?.name || detail.name || "ท่าที่ลบไปแล้ว",
        type,
        detail,
        sets,
        completed: !!record.done?.[id] ||
          (sets.length > 0 && sets.every(s => !!s.done)),
        recorded
      };
    }).filter(a => a.recorded);
  }

  function sessions() {
    return Object.entries(records)
      .map(([date, record]) => ({
        date,
        title: typeof titles !== "undefined" &&
          typeof dayOf === "function"
          ? titles[dayOf(date)] || "Workout"
          : "Workout",
        activities: activities(record)
      }))
      .filter(s => s.activities.length > 0)
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  function inPeriod(s) {
    if (period === "all") return true;

    const [year, month] = s.date.split("-").map(Number);

    if (year !== selectedYear) return false;
    if (period === "year") return true;

    return month === selectedMonth + 1;
  }

  function periodSessions() {
    return sessions().filter(inPeriod);
  }

  function filteredSessions() {
    const query = search.toLowerCase().trim();

    return periodSessions().filter(s => {
      const matching = s.activities.filter(a =>
        (category === "all" ||
          (category === "strength" && a.type !== "cardio") ||
          (category === "cardio" && a.type === "cardio")) &&
        (!query ||
          a.name.toLowerCase().includes(query) ||
          s.title.toLowerCase().includes(query) ||
          s.date.includes(query))
      );

      return matching.length > 0;
    });
  }

  function summary(list) {
    const strength = list.filter(s =>
      s.activities.some(a => a.type !== "cardio")
    ).length;

    const cardio = list.filter(s =>
      s.activities.some(a => a.type === "cardio")
    ).length;

    const distance = list.reduce((sum, s) =>
      sum + s.activities.reduce((n, a) =>
        n + (a.type === "cardio"
          ? Number(a.detail.distance) || 0 : 0), 0), 0);

    return { days: list.length, strength, cardio, distance };
  }

  function formatDate(date) {
    const [y, m, d] = date.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
      day: "numeric", month: "short", year: "numeric"
    });
  }

  function pace(a) {
    const km = Number(a.detail.distance);
    const minutes = Number(a.detail.minutes);

    if (!(km > 0 && minutes > 0)) return "—";

    const seconds = Math.round(minutes * 60 / km);
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")} /km`;
  }

  function stat(label, value) {
    return `<div class="hv3-stat">
      <span>${escapeHTML(label)}</span>
      <strong>${escapeHTML(value)}</strong>
    </div>`;
  }

  function renderDetails(session) {
    const html = session.activities.map(a => {
      let rows = "";

      if (a.type === "cardio") {
        rows = `<div class="hv3-cardio">
          <div><span>Distance</span><strong>${escapeHTML(a.detail.distance || "—")} km</strong></div>
          <div><span>Duration</span><strong>${escapeHTML(a.detail.minutes || "—")} min</strong></div>
          <div><span>Avg Pace</span><strong>${escapeHTML(pace(a))}</strong></div>
        </div>`;
      } else if (a.sets.length) {
        const timed = a.type === "timed";
        rows = `<div class="hv3-set-head">
          <span>SET</span><span>${timed ? "SECONDS" : "WEIGHT"}</span>
          <span>${timed ? "" : "REPS"}</span><span>DONE</span>
        </div>` + a.sets.map((s, i) => `
          <div class="hv3-set-row">
            <span>${i + 1}</span>
            <span>${escapeHTML(timed
              ? (s.seconds ?? s.reps ?? "—")
              : (s.weight ?? "—"))}${timed ? " sec" : " kg"}</span>
            <span>${timed ? "" : escapeHTML(s.reps ?? "—")}</span>
            <span class="${s.done ? "hv3-done" : ""}">${s.done ? "✓" : "○"}</span>
          </div>`).join("");
      } else {
        rows = `<p class="hv3-muted">${
          a.completed ? "✓ Completed · Legacy record" :
          "มีข้อมูลบันทึกแบบเก่า"
        }</p>`;
      }

      return `<section class="hv3-exercise">
        <div class="hv3-exercise-title">
          <strong>${escapeHTML(a.name)}</strong>
          <span>${a.completed ? "✓ Completed" : "In progress"}</span>
        </div>
        ${rows}
      </section>`;
    }).join("");

    return `<div class="hv3-details">
      <button class="hv3-back" data-action="back">← Back to History</button>
      <div class="hv3-detail-title">
        <span>${escapeHTML(formatDate(session.date))}</span>
        <h3>${escapeHTML(session.title)}</h3>
        <p>${session.activities.length} recorded exercises</p>
      </div>
      ${html}
      <button class="hv3-edit" data-action="edit"
        data-date="${escapeHTML(session.date)}">
        ✎ Edit this workout
      </button>
    </div>`;
  }

  function render() {
    const root = document.getElementById("history");
    if (!root) return;

    const all = periodSessions();
    const stats = summary(all);
    const filtered = filteredSessions();
    const maxPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    page = Math.min(page, maxPages);

    const yearOptions = [...new Set([
      new Date().getFullYear(),
      selectedYear,
      ...sessions().map(s => Number(s.date.slice(0, 4)))
    ])].sort((a, b) => b - a);

    const monthNames = Array.from({length:12}, (_,i) =>
      new Date(2026,i,1).toLocaleDateString("en-US",{month:"long"})
    );

    root.innerHTML = `
      <div class="hv3">
        <div class="hv3-title">
          <span>YOUR FITNESS JOURNEY</span>
          <h2>Workout History</h2>
          <p>Track your progress over time</p>
        </div>

        <div class="hv3-tabs">
          ${[["month","Month"],["year","Year"],["all","All Time"]]
            .map(([v,l])=>`<button data-period="${v}"
              class="${period===v?"active":""}">${l}</button>`).join("")}
        </div>

        <div class="hv3-period">
          ${period !== "all" ? `
            <select id="hv3-year">${yearOptions.map(y=>
              `<option value="${y}" ${y===selectedYear?"selected":""}>${y}</option>`
            ).join("")}</select>` : ""}
          ${period === "month" ? `
            <select id="hv3-month">${monthNames.map((m,i)=>
              `<option value="${i}" ${i===selectedMonth?"selected":""}>${m}</option>`
            ).join("")}</select>` : ""}
        </div>

        <div class="hv3-stats">
          ${stat("Workout Days",stats.days)}
          ${stat("Strength Days",stats.strength)}
          ${stat("Cardio Days",stats.cardio)}
          ${stat("Running Distance",`${stats.distance.toFixed(1)} km`)}
        </div>

        ${selectedDate
          ? (() => {
              const selected = sessions().find(s => s.date === selectedDate);
              return selected ? renderDetails(selected) : "";
            })()
          : `
          <div class="hv3-section-title">Workout Records</div>
          <input id="hv3-search" type="search"
            placeholder="Search exercise or date..."
            value="${escapeHTML(search)}">

          <div class="hv3-filters">
            ${[["all","All"],["strength","Strength"],["cardio","Running"]]
              .map(([v,l])=>`<button data-category="${v}"
                class="${category===v?"active":""}">${l}</button>`).join("")}
          </div>

          <div class="hv3-records">
            ${filtered.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE)
              .map(s => {
                const acts=s.activities.filter(a =>
                  category==="all" ||
                  (category==="cardio" ? a.type==="cardio" : a.type!=="cardio")
                );
                const types=acts.some(a=>a.type==="cardio")
                  ?"🏃":"🏋️";
                const completed=acts.filter(a=>a.completed).length;
                return `<button class="hv3-record" data-date="${escapeHTML(s.date)}">
                  <span class="hv3-record-icon">${types}</span>
                  <span class="hv3-record-info">
                    <strong>${escapeHTML(s.title)}</strong>
                    <small>${escapeHTML(formatDate(s.date))}</small>
                    <em>${completed}/${acts.length} completed · ${acts.length} exercises</em>
                  </span>
                  <span class="hv3-chevron">›</span>
                </button>`;
              }).join("") ||
              `<p class="hv3-muted">ไม่พบประวัติในช่วงเวลานี้</p>`}
          </div>

          <div class="hv3-pagination">
            <button data-action="prev" ${page===1?"disabled":""}>← Previous</button>
            <span>${page} / ${maxPages}</span>
            <button data-action="next" ${page===maxPages?"disabled":""}>Next →</button>
          </div>`}
      </div>`;

    bindEvents(root);
  }

  function bindEvents(root) {
    root.querySelectorAll("[data-period]").forEach(b => {
      b.onclick = () => {
        period = b.dataset.period;
        selectedDate = null;
        page = 1;
        render();
      };
    });

    root.querySelector("#hv3-year")?.addEventListener("change", e => {
      selectedYear = Number(e.target.value);
      selectedDate = null;
      page = 1;
      render();
    });

    root.querySelector("#hv3-month")?.addEventListener("change", e => {
      selectedMonth = Number(e.target.value);
      selectedDate = null;
      page = 1;
      render();
    });

    root.querySelectorAll("[data-category]").forEach(b => {
      b.onclick = () => {
        category = b.dataset.category;
        page = 1;
        render();
      };
    });

    root.querySelector("#hv3-search")?.addEventListener("input", e => {
      const value = e.target.value;
      const pos = e.target.selectionStart;
      search = value;
      page = 1;
      render();
      const input = root.querySelector("#hv3-search");
      input?.focus();
      input?.setSelectionRange(pos, pos);
    });

    root.querySelectorAll(".hv3-record").forEach(b => {
      b.onclick = () => {
        selectedDate = b.dataset.date;
        render();
      };
    });

    root.querySelector('[data-action="back"]')?.addEventListener("click", () => {
      selectedDate = null;
      render();
    });

    root.querySelector('[data-action="edit"]')?.addEventListener("click", e => {
      document.getElementById("date").value =
        e.currentTarget.dataset.date;
      selectedDate = null;
      showTab("home");
      render();
    });

    root.querySelector('[data-action="prev"]')?.addEventListener("click", () => {
      page = Math.max(1,page-1);
      render();
    });

    root.querySelector('[data-action="next"]')?.addEventListener("click", () => {
      page++;
      render();
    });
  }

  return { render };
})();

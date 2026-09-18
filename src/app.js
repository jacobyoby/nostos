import { getDevicePosition } from "./lib/geolocation.js";
import {
  escapeHtml,
  filterDirectory,
  nearestLibraries,
  progressStats,
  resolveLocationQuery,
  safeHttpUrl,
  statusOf,
  title,
} from "./lib/nostos.js";

/** @type {import('./lib/nostos-types.js').LibraryRecord[]} */
let all = [];

const q = document.getElementById("q");
const countySel = document.getElementById("county");
const statusSel = document.getElementById("status");
const legalSel = document.getElementById("legal");
const rows = document.getElementById("rows");
const empty = document.getElementById("empty");

const finderLocation = document.getElementById("finder-location");
const finderCounty = document.getElementById("finder-county");
const finderType = document.getElementById("finder-type");
const finderResults = document.getElementById("finder-results");
const finderEmpty = document.getElementById("finder-empty");
const finderStatus = document.getElementById("finder-status");
const btnGeo = document.getElementById("btn-geo");
const btnFind = document.getElementById("btn-find");

let finderOrigin = /** @type {{ lat: number; lon: number; label: string } | null} */ (null);

function setPanel(name) {
  for (const el of document.querySelectorAll("[data-panel]")) {
    el.hidden = el.getAttribute("data-panel") !== name;
  }
  for (const tab of document.querySelectorAll("[data-tab]")) {
    const active = tab.getAttribute("data-tab") === name;
    tab.setAttribute("aria-selected", active ? "true" : "false");
  }
}

function renderProgress() {
  const s = progressStats(all);
  document.getElementById("progress").innerHTML = [
    ["Outlets", s.total],
    ["Systems", s.systems],
    ["Counties", s.counties],
    ["Reached", s.reached],
    ["Posted / partner", s.postedPartner],
    ["Legal-help programs", s.legal],
  ]
    .map(([k, v]) => `<div class="tile"><b>${v}</b><span>${escapeHtml(k)}</span></div>`)
    .join("");
  document.getElementById("bar").style.width = `${s.donePct.toFixed(1)}%`;
}

function renderDirectory() {
  const list = filterDirectory(all, {
    term: q.value,
    county: countySel.value,
    status: statusSel.value,
    legal: legalSel.value,
  });
  rows.innerHTML = list
    .map((r) => {
      const s = statusOf(r);
      const website = safeHttpUrl(r.website);
      const name = website
        ? `<a href="${escapeHtml(website)}" rel="noopener noreferrer" target="_blank">${escapeHtml(title(r.outlet_name))}</a>`
        : escapeHtml(title(r.outlet_name));
      const evidence = safeHttpUrl(r.legal_help_evidence);
      const legal =
        r.has_legal_help_program === true
          ? `<span class="legal">${evidence ? `<a href="${escapeHtml(evidence)}" rel="noopener noreferrer" target="_blank">yes</a>` : "yes"}</span>`
          : r.has_legal_help_program === false
            ? "no"
            : "<span style='color:var(--muted)'>?</span>";
      const notes = r.outreach && r.outreach.notes ? escapeHtml(r.outreach.notes) : "";
      return `<tr data-fscs="${escapeHtml(r.fscskey)}-${escapeHtml(r.fscs_seq)}" data-testid="directory-row">
        <td>${name}<br><small style="color:var(--muted)">${escapeHtml(r.outlet_type || "")}${r.phone ? ` · ${escapeHtml(r.phone)}` : ""}</small></td>
        <td>${escapeHtml(title(r.system_name))}</td><td>${escapeHtml(title(r.county))}</td>
        <td>${escapeHtml([title(r.address), title(r.city), r.zip].filter(Boolean).join(", "))}</td>
        <td>${legal}</td>
        <td><span class="st st-${escapeHtml(s)}">${escapeHtml(s)}</span>${notes ? `<br><small>${notes}</small>` : ""}</td>
      </tr>`;
    })
    .join("");
  empty.hidden = list.length > 0;
}

function renderFinder() {
  if (!finderOrigin) {
    finderResults.innerHTML = "";
    finderEmpty.hidden = false;
    finderEmpty.textContent = "Enter a ZIP or town, or use your location.";
    return;
  }
  const hits = nearestLibraries(all, finderOrigin.lat, finderOrigin.lon, {
    county: finderCounty.value,
    outletType: finderType.value,
    limit: 40,
  });
  finderStatus.textContent = `Near ${finderOrigin.label} (${finderOrigin.lat.toFixed(4)}, ${finderOrigin.lon.toFixed(4)})`;
  finderResults.innerHTML = hits
    .map(({ record: r, distanceMi }) => {
      const phone = r.phone ? escapeHtml(r.phone) : "";
      const hours =
        r.hours_open_weekly != null && Number.isFinite(r.hours_open_weekly)
          ? `${r.hours_open_weekly} h/wk`
          : "—";
      return `<tr data-testid="finder-row" data-fscs="${escapeHtml(r.fscskey)}-${escapeHtml(r.fscs_seq)}">
        <td>${distanceMi.toFixed(1)} mi</td>
        <td>${escapeHtml(title(r.outlet_name))}<br><small style="color:var(--muted)">${escapeHtml(r.outlet_type || "")}</small></td>
        <td>${escapeHtml(title(r.county))}</td>
        <td>${escapeHtml([title(r.address), title(r.city), r.zip].filter(Boolean).join(", "))}</td>
        <td>${phone}</td>
        <td>${escapeHtml(hours)}</td>
      </tr>`;
    })
    .join("");
  finderEmpty.hidden = hits.length > 0;
  if (hits.length === 0) finderEmpty.textContent = "No libraries match these filters.";
}

function runFinderFromInput() {
  const loc = resolveLocationQuery(finderLocation.value, all);
  if (!loc) {
    finderOrigin = null;
    finderStatus.textContent = "Could not resolve that ZIP or town.";
    renderFinder();
    return;
  }
  finderOrigin = loc;
  renderFinder();
}

async function init() {
  const dataUrl = new URL("../data/nj-libraries.json", import.meta.url).href;
  const res = await fetch(dataUrl, { cache: "no-store" });
  if (!res.ok) throw new Error(`nj-libraries.json fetch failed: ${res.status}`);
  all = await res.json();

  const s = progressStats(all);
  for (const c of s.countyList) {
    const o = document.createElement("option");
    o.value = c;
    o.textContent = title(c);
    countySel.appendChild(o);
    const o2 = o.cloneNode(true);
    finderCounty.appendChild(o2);
  }

  const types = [...new Set(all.map((r) => r.outlet_type).filter(Boolean))].sort();
  for (const t of types) {
    const o = document.createElement("option");
    o.value = t;
    o.textContent = title(t);
    finderType.appendChild(o);
  }

  for (const el of [q, countySel, statusSel, legalSel]) el.addEventListener("input", renderDirectory);
  finderCounty.addEventListener("change", renderFinder);
  finderType.addEventListener("change", renderFinder);
  btnFind.addEventListener("click", runFinderFromInput);
  finderLocation.addEventListener("keydown", (e) => {
    if (e.key === "Enter") runFinderFromInput();
  });

  btnGeo.addEventListener("click", async () => {
    finderStatus.textContent = "Requesting location…";
    try {
      const pos = await getDevicePosition();
      finderOrigin = { lat: pos.lat, lon: pos.lon, label: "your location" };
      renderFinder();
    } catch (err) {
      finderStatus.textContent = err instanceof Error ? err.message : "Location denied — use ZIP or town instead.";
      finderOrigin = null;
      renderFinder();
    }
  });

  for (const tab of document.querySelectorAll("[data-tab]")) {
    tab.addEventListener("click", () => setPanel(tab.getAttribute("data-tab") || "finder"));
  }

  renderProgress();
  renderDirectory();
  setPanel("finder");
}

init().catch((err) => {
  document.body.innerHTML = `<main><p role="alert">Failed to load: ${escapeHtml(err.message)}</p></main>`;
});

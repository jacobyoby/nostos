import { getDevicePosition } from "./lib/geolocation.js";
import {
  SERVICE_NAMES,
  contactField,
  escapeHtml,
  filterDirectory,
  findOutlet,
  hoursStatus,
  makeProposal,
  nearestLibraries,
  outletKey,
  progressStats,
  proposalIssueUrl,
  resolveLocationQuery,
  safeHttpUrl,
  servicesOf,
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
const outletEl = document.getElementById("outlet");

let finderOrigin = /** @type {{ lat: number; lon: number; label: string } | null} */ (null);

function parseRoute() {
  const raw = (location.hash || "#/").replace(/^#/, "") || "/";
  const outlet = raw.match(/^\/outlet\/([^/?#]+)/);
  if (outlet) return { name: "outlet", key: decodeURIComponent(outlet[1]) };
  if (raw.startsWith("/directory")) return { name: "directory" };
  return { name: "finder" };
}

function setPanel(name) {
  for (const el of document.querySelectorAll("[data-panel]")) {
    el.hidden = el.getAttribute("data-panel") !== name;
  }
  for (const tab of document.querySelectorAll("[data-tab]")) {
    const active = tab.getAttribute("data-tab") === name;
    tab.setAttribute("aria-selected", active ? "true" : "false");
  }
}

function go(path) {
  location.hash = path;
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

function libraryLink(r) {
  const key = outletKey(r);
  return `<a href="#/outlet/${encodeURIComponent(key)}" data-testid="outlet-link">${escapeHtml(title(r.outlet_name))}</a>`;
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
      const notes = r.outreach && r.outreach.notes ? escapeHtml(r.outreach.notes) : "";
      const legal =
        r.has_legal_help_program === true
          ? `<span class="legal">yes</span>`
          : r.has_legal_help_program === false
            ? "no"
            : "<span style='color:var(--muted)'>?</span>";
      return `<tr data-fscs="${escapeHtml(outletKey(r))}" data-testid="directory-row">
        <td>${libraryLink(r)}<br><small style="color:var(--muted)">${escapeHtml(r.outlet_type || "")}${r.phone ? ` · ${escapeHtml(r.phone)}` : ""}</small></td>
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
      const hours = hoursStatus(r);
      return `<tr data-testid="finder-row" data-fscs="${escapeHtml(outletKey(r))}">
        <td>${distanceMi.toFixed(1)} mi</td>
        <td>${libraryLink(r)}<br><small style="color:var(--muted)">${escapeHtml(r.outlet_type || "")}</small></td>
        <td>${escapeHtml(title(r.county))}</td>
        <td>${escapeHtml([title(r.address), title(r.city), r.zip].filter(Boolean).join(", "))}</td>
        <td>${phone}</td>
        <td>${escapeHtml(hours.label)}</td>
      </tr>`;
    })
    .join("");
  finderEmpty.hidden = hits.length > 0;
  if (hits.length === 0) finderEmpty.textContent = "No libraries match these filters.";
}

function contactLine(label, innerHtml) {
  return `<dt>${escapeHtml(label)}</dt><dd>${innerHtml}</dd>`;
}

function renderOutlet(key) {
  const r = findOutlet(all, key);
  if (!r) {
    outletEl.innerHTML = `<p data-testid="outlet-missing">No outlet ${escapeHtml(key)}.</p>`;
    return;
  }
  const hours = hoursStatus(r);
  const phone = contactField(r.admin_phone) || (r.phone ? { value: r.phone, verified_on: null } : null);
  const email = contactField(r.admin_email);
  const form = contactField(r.contact_form_url);
  const director = contactField(r.director);
  const board = contactField(r.board_url);
  const website = safeHttpUrl(r.website);
  const formUrl = form ? safeHttpUrl(form.value) : null;
  const boardUrl = board ? safeHttpUrl(board.value) : null;
  const services = servicesOf(r);
  const serviceOpts = SERVICE_NAMES.map((n) => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join("");

  const contactRows = [
    phone
      ? contactLine("Phone", `<a href="tel:${escapeHtml(phone.value)}" data-testid="admin-phone">${escapeHtml(phone.value)}</a>`)
      : contactLine("Phone", "Not published"),
    email
      ? contactLine("Email", `<a href="mailto:${escapeHtml(email.value)}">${escapeHtml(email.value)}</a>`)
      : contactLine("Email", "Not published"),
    formUrl
      ? contactLine("Contact form", `<a href="${escapeHtml(formUrl)}" rel="noopener noreferrer" target="_blank">Form</a>`)
      : contactLine("Contact form", "Not published"),
    director ? contactLine("Director", escapeHtml(director.value)) : contactLine("Director", "Not published"),
    boardUrl
      ? contactLine("Board", `<a href="${escapeHtml(boardUrl)}" rel="noopener noreferrer" target="_blank">Governing body</a>`)
      : contactLine("Board", "Not published"),
    website
      ? contactLine("Website", `<a href="${escapeHtml(website)}" rel="noopener noreferrer" target="_blank">${escapeHtml(website)}</a>`)
      : contactLine("Website", "Not published"),
  ].join("");

  outletEl.innerHTML = `
    <h2 data-testid="outlet-name">${escapeHtml(title(r.outlet_name))}</h2>
    <p class="sub">${escapeHtml(title(r.system_name))} · ${escapeHtml(title(r.county))} · ${escapeHtml(hours.label)}</p>
    <p>${escapeHtml([title(r.address), title(r.city), r.zip].filter(Boolean).join(", "))}</p>
    <div class="outlet-contact" data-testid="outlet-contact">
      <h2>Contact the library</h2>
      <dl>${contactRows}</dl>
    </div>
    <h3>Services</h3>
    <div data-testid="outlet-services">${
      services.length
        ? services
            .map((s) => {
              const ev = s.evidence_url ? ` <a href="${escapeHtml(s.evidence_url)}" rel="noopener noreferrer" target="_blank">evidence</a>` : "";
              return `<span class="chip">${escapeHtml(s.name)}${ev}</span>`;
            })
            .join("")
        : `<p class="sub">None recorded yet. Null beats guessed.</p>`
    }</div>
    <div class="proposal">
      <h3>Propose an update</h3>
      <p class="sub">Name a service, hours or a closure, or a book/resource at this location. No ratings, stars, or reviews.</p>
      <form data-testid="proposal-form">
        <input type="hidden" name="outlet_key" value="${escapeHtml(outletKey(r))}">
        <label for="proposal-kind">Kind</label>
        <select id="proposal-kind" name="kind" data-testid="proposal-kind">
          <option value="service">Service</option>
          <option value="hours">Hours or closure</option>
          <option value="resource">Book / resource is here</option>
        </select>
        <label for="proposal-value">Value</label>
        <select id="proposal-service" data-testid="proposal-service">${serviceOpts}</select>
        <input id="proposal-value" name="value" type="text" maxlength="200" data-testid="proposal-value" hidden>
        <label for="proposal-evidence">Evidence URL (optional)</label>
        <input id="proposal-evidence" name="evidence_url" type="url" data-testid="proposal-evidence" placeholder="https://…">
        <label for="proposal-contact">Your contact (optional)</label>
        <input id="proposal-contact" name="submitter_contact" type="text" data-testid="proposal-contact">
        <p id="proposal-error" data-testid="proposal-error" class="sub" hidden></p>
        <p><button type="submit" class="action" data-testid="proposal-submit">Send to moderation queue</button></p>
      </form>
    </div>
  `;

  const formEl = outletEl.querySelector("[data-testid=proposal-form]");
  const kindEl = outletEl.querySelector("[data-testid=proposal-kind]");
  const serviceEl = outletEl.querySelector("[data-testid=proposal-service]");
  const valueEl = outletEl.querySelector("[data-testid=proposal-value]");
  const errEl = outletEl.querySelector("[data-testid=proposal-error]");

  function syncKind() {
    const service = kindEl.value === "service";
    serviceEl.hidden = !service;
    valueEl.hidden = service;
  }
  kindEl.addEventListener("change", syncKind);
  syncKind();

  formEl.addEventListener("submit", (e) => {
    e.preventDefault();
    const kind = kindEl.value;
    const value = kind === "service" ? serviceEl.value : valueEl.value;
    const result = makeProposal({
      outlet_key: outletKey(r),
      kind,
      value,
      evidence_url: outletEl.querySelector("[data-testid=proposal-evidence]").value,
      submitter_contact: outletEl.querySelector("[data-testid=proposal-contact]").value,
    });
    if (!result.ok) {
      errEl.hidden = false;
      errEl.textContent = result.error;
      return;
    }
    errEl.hidden = true;
    window.location.href = proposalIssueUrl(result.proposal);
  });
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

function applyRoute() {
  const route = parseRoute();
  if (route.name === "outlet") {
    setPanel("outlet");
    renderOutlet(route.key);
    return;
  }
  if (route.name === "directory") {
    setPanel("directory");
    return;
  }
  setPanel("finder");
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
    finderCounty.appendChild(o.cloneNode(true));
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
    tab.addEventListener("click", () => {
      const name = tab.getAttribute("data-tab") || "finder";
      go(name === "directory" ? "/directory" : "/");
    });
  }
  document.querySelector("[data-testid=outlet-back]").addEventListener("click", () => {
    history.length > 1 ? history.back() : go("/");
  });

  window.addEventListener("hashchange", applyRoute);
  renderProgress();
  renderDirectory();
  applyRoute();
}

init().catch((err) => {
  document.body.innerHTML = `<main><p role="alert">Failed to load: ${escapeHtml(err.message)}</p></main>`;
});

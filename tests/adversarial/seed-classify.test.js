import assert from "node:assert/strict";
import { test } from "node:test";
import {
  classifyServiceLink,
  extractDirector,
  extractLinks,
  isBoardLink,
  pickAdminEmail,
} from "../../scripts/site-facts.mjs";
import { seedFromSites } from "../../scripts/seed_from_sites.mjs";

test("classifyServiceLink uses path and visible text, not board-games", () => {
  assert.equal(
    classifyServiceLink({ href: "https://www.npl.org/notary-services-2/", text: "Notary Services" }).name,
    "notary",
  );
  assert.equal(
    classifyServiceLink({ href: "https://www.npl.org/public-access-computers/", text: "Computers" }).name,
    "computer access",
  );
  assert.equal(classifyServiceLink({ href: "https://www.npl.org/adult-board-games-day/", text: "Adult Board Games Day" }), null);
});

test("extractLinks reads href and text", () => {
  const links = extractLinks(
    `<a href="/esl">Literacy &amp; English as a Second Language</a>`,
    "https://theoceancountylibrary.org/",
  );
  assert.equal(links[0].href, "https://theoceancountylibrary.org/esl");
  assert.match(links[0].text, /English as a Second Language/);
});

test("isBoardLink rejects libcal calendars and board-games", () => {
  assert.equal(
    isBoardLink({ href: "https://example.org/board-of-trustees/", text: "Board of Trustees" }),
    true,
  );
  assert.equal(
    isBoardLink({ href: "https://npl.libcal.com/", text: "Board of Trustees calendar" }),
    false,
  );
  assert.equal(
    isBoardLink({ href: "https://example.org/board-games/", text: "Adult Board Games" }),
    false,
  );
});

test("pickAdminEmail prefers same-domain info@", () => {
  assert.equal(
    pickAdminEmail(["zara@gmail.com", "info@hobokenlibrary.org"], "https://hobokenlibrary.org/"),
    "info@hobokenlibrary.org",
  );
});

test("extractDirector reads Library Director from JSON-LD", () => {
  const html = `<script type="application/ld+json">{"@type":"Person","name":"Jane Quill","jobTitle":"Library Director"}</script>`;
  assert.equal(extractDirector(html), "Jane Quill");
});

test("seedFromSites records evidenced services and weekday hours, never weekly totals", async () => {
  const libraries = [
    {
      system_name: "HOBOKEN PUBLIC LIBRARY",
      outlet_name: "HOBOKEN PUBLIC LIBRARY",
      outlet_type: "central",
      website: "https://hobokenlibrary.org/",
      services: null,
      hours: null,
      admin_email: null,
    },
    {
      system_name: "HOBOKEN PUBLIC LIBRARY",
      outlet_name: "HOBOKEN BRANCH",
      outlet_type: "branch",
      website: "https://hobokenlibrary.org/",
      services: null,
      hours: null,
      admin_email: null,
    },
  ];
  const pages = {
    "https://hobokenlibrary.org/": {
      url: "https://hobokenlibrary.org/",
      html: `<a href="/notary/">Notary</a><a href="/hours/">Hours</a><a href="mailto:info@hobokenlibrary.org">Email</a>`,
      status: 200,
    },
    "https://hobokenlibrary.org/notary/": {
      url: "https://hobokenlibrary.org/notary/",
      html: `<p>Notary service by appointment.</p>`,
      status: 200,
    },
    "https://hobokenlibrary.org/hours/": {
      url: "https://hobokenlibrary.org/hours/",
      html: `<p>Monday: 10:00 AM – 8:00 PM</p><p>Tuesday: 10:00 AM – 8:00 PM</p><p>Wednesday: 10:00 AM – 8:00 PM</p><p>Thursday: 10:00 AM – 8:00 PM</p><p>Friday: 10:00 AM – 5:00 PM</p><p>Saturday: 10:00 AM – 5:00 PM</p><p>Sunday: Closed</p>`,
      status: 200,
    },
  };
  const summary = await seedFromSites(libraries, async (url) => pages[url] || { url, html: "", status: 404 });
  assert.equal(summary.extra_hours, 1);
  assert.equal(libraries[0].hours.days[0].day, "monday");
  assert.equal(libraries[0].hours.days[0].open, "10:00");
  assert.equal(libraries[0].hours.days[0].close, "20:00");
  assert.equal(libraries[1].hours, null);
  assert.ok(libraries[0].services.some((s) => s.name === "notary"));
  assert.equal(libraries[0].admin_email.value, "info@hobokenlibrary.org");
  assert.equal(libraries[1].admin_email.value, "info@hobokenlibrary.org");
});

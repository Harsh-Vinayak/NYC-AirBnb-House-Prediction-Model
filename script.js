/* StayType AI — front-end for the NYC Airbnb room-type FastAPI model */
"use strict";

/* ───────── config ───────── */
const DEFAULT_API = "http://127.0.0.1:8000";

/* The pickled pipeline was trained on exactly these values (see OneHotEncoder categories). */
const LOCATIONS = {
  Brooklyn:  { Bushwick: [40.6944, -73.9213], Williamsburg: [40.7081, -73.9571] },
  Manhattan: { Harlem:   [40.8116, -73.9465], Midtown:      [40.7549, -73.9840] },
  Queens:    { Astoria:  [40.7644, -73.9235] },
};

/* Order of model.classes_ (alphabetical). If your API ever returns "Classes", that is used instead. */
const CLASSES = ["Entire home/apt", "Private room"];
const CLASS_META = {
  "Entire home/apt": {
    key: "entire", label: "Entire home / apt", c1: "#2dd4bf", c2: "#7dd3fc",
    blurb: "Guests get the whole place to themselves — typical of higher-priced, longer-stay listings.",
  },
  "Private room": {
    key: "private", label: "Private room", c1: "#f59e0b", c2: "#fde68a",
    blurb: "A room of their own inside a shared home — typically lower price per night.",
  },
};

const PRESETS = {
  studio:  { borough: "Brooklyn",  hood: "Williamsburg", price: 185, minimum_nights: 3, availability_365: 220, number_of_reviews: 42, reviews_per_month: 1.2, calculated_host_listings_count: 1 },
  room:    { borough: "Manhattan", hood: "Harlem",       price: 65,  minimum_nights: 2, availability_365: 300, number_of_reviews: 18, reviews_per_month: 0.6, calculated_host_listings_count: 3 },
  midtown: { borough: "Manhattan", hood: "Midtown",      price: 240, minimum_nights: 2, availability_365: 150, number_of_reviews: 85, reviews_per_month: 2.1, calculated_host_listings_count: 2 },
};

/* Same constraints as the Pydantic model */
const RULES = {
  latitude: { min: -90, max: 90, label: "Latitude" },
  longitude: { min: -180, max: 180, label: "Longitude" },
  price: { min: 0, exclusiveMin: true, label: "Price" },
  minimum_nights: { min: 1, max: 365, int: true, label: "Minimum nights" },
  number_of_reviews: { min: 0, int: true, label: "Total reviews" },
  reviews_per_month: { min: 0, label: "Reviews per month" },
  calculated_host_listings_count: { min: 0, int: true, label: "Host listings" },
  availability_365: { min: 0, max: 365, int: true, label: "Availability" },
};
const NUM_FIELDS = Object.keys(RULES);

/* ───────── helpers ───────── */
const $ = (s, r = document) => r.querySelector(s);
const el = (tag, props = {}, ...kids) => {
  const n = Object.assign(document.createElement(tag), props);
  kids.forEach((k) => n.append(k));
  return n;
};
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
};
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

let API = (store.get("stp_api") || DEFAULT_API).replace(/\/+$/, "");
let borough = "Brooklyn";
let hood = "Williamsburg";
let history = [];

/* ───────── location chips ───────── */
function renderBoroughs() {
  const wrap = $("#boroughChips");
  wrap.replaceChildren();
  Object.keys(LOCATIONS).forEach((b) => {
    const chip = el("button", { type: "button", className: "chip", textContent: b });
    chip.setAttribute("role", "radio");
    chip.setAttribute("aria-checked", String(b === borough));
    chip.onclick = () => {
      borough = b;
      hood = Object.keys(LOCATIONS[b])[0];
      renderBoroughs(); renderHoods(); applyHoodCoords();
    };
    wrap.append(chip);
  });
}
function renderHoods() {
  const wrap = $("#hoodChips");
  wrap.replaceChildren();
  Object.keys(LOCATIONS[borough]).forEach((h, i) => {
    const chip = el("button", { type: "button", className: "chip", textContent: h });
    chip.style.animationDelay = `${i * 60}ms`;
    chip.setAttribute("role", "radio");
    chip.setAttribute("aria-checked", String(h === hood));
    chip.onclick = () => { hood = h; renderHoods(); applyHoodCoords(); };
    wrap.append(chip);
  });
}
function applyHoodCoords() {
  const [lat, lon] = LOCATIONS[borough][hood];
  $("#latitude").value = lat;
  $("#longitude").value = lon;
  moveMarker(lat, lon, hood);
}

/* ───────── radar mini-map ───────── */
const BOX = { lonMin: -74.0, lonMax: -73.9, latMin: 40.68, latMax: 40.83 };
function project(lat, lon) {
  const x = 20 + ((lon - BOX.lonMin) / (BOX.lonMax - BOX.lonMin)) * 260;
  const y = 20 + ((BOX.latMax - lat) / (BOX.latMax - BOX.latMin)) * 180;
  return [Math.max(10, Math.min(290, x)), Math.max(10, Math.min(210, y))];
}
function buildRadar() {
  const g = $("#gridLines");
  for (let x = 0; x <= 300; x += 30) g.append(svg("line", { x1: x, y1: 0, x2: x, y2: 220 }));
  for (let y = 0; y <= 220; y += 30) g.append(svg("line", { x1: 0, y1: y, x2: 300, y2: y }));
  const dots = $("#hoodDots");
  Object.values(LOCATIONS).forEach((hoods) =>
    Object.entries(hoods).forEach(([name, [lat, lon]]) => {
      const [x, y] = project(lat, lon);
      const c = svg("circle", { cx: x, cy: y, r: 3, class: "hood-dot", "data-h": name });
      const t = svg("text", { x: x + 7, y: y + 3, class: "hood-label", "data-h": name });
      t.textContent = name;
      dots.append(c, t);
    })
  );
}
function svg(tag, attrs) {
  const n = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  return n;
}
function moveMarker(lat, lon, label) {
  const [x, y] = project(lat, lon);
  $("#marker").setAttribute("transform", `translate(${x} ${y})`);
  document.querySelectorAll("[data-h]").forEach((n) => n.classList.toggle("on", n.dataset.h === label));
  $("#radarTag").textContent = label ? `${label} · ${(+lat).toFixed(3)}, ${(+lon).toFixed(3)}` : `Custom · ${(+lat).toFixed(3)}, ${(+lon).toFixed(3)}`;
}

/* ───────── slider ↔ number sync ───────── */
function bindSlider(id) {
  const num = $("#" + id), rng = $("#" + id + "R");
  const paint = () => {
    const pct = ((Math.min(Math.max(+num.value || 0, +rng.min), +rng.max) - rng.min) / (rng.max - rng.min)) * 100;
    rng.style.setProperty("--fill", pct + "%");
  };
  rng.addEventListener("input", () => { num.value = rng.value; paint(); });
  num.addEventListener("input", () => { rng.value = num.value; paint(); });
  num._paint = () => { rng.value = num.value; paint(); };
  paint();
}

function fillForm(p) {
  borough = p.borough; hood = p.hood;
  renderBoroughs(); renderHoods(); applyHoodCoords();
  NUM_FIELDS.filter((k) => k in p).forEach((k) => { $("#" + k).value = p[k]; });
  ["price", "minimum_nights", "availability_365"].forEach((id) => $("#" + id)._paint());
  clearErrors();
}

/* ───────── validation ───────── */
function clearErrors() {
  $("#formError").hidden = true;
  document.querySelectorAll("input.invalid").forEach((i) => i.classList.remove("invalid"));
}
function validate() {
  const data = {};
  const problems = [];
  for (const k of NUM_FIELDS) {
    const input = $("#" + k), r = RULES[k], raw = input.value.trim();
    const v = Number(raw);
    let msg = null;
    if (raw === "" || Number.isNaN(v)) msg = `${r.label} is required.`;
    else if (r.int && !Number.isInteger(v)) msg = `${r.label} must be a whole number.`;
    else if (r.exclusiveMin ? v <= r.min : v < r.min) msg = `${r.label} must be ${r.exclusiveMin ? "greater than" : "at least"} ${r.min}.`;
    else if (r.max !== undefined && v > r.max) msg = `${r.label} must be ${r.max} or less.`;
    if (msg) { problems.push(msg); input.classList.add("invalid"); }
    data[k] = v;
  }
  return { data, problems };
}
function showError(msg) {
  const e = $("#formError");
  e.textContent = msg; e.hidden = false;
}

/* ───────── API ───────── */
async function checkApi() {
  const dot = $("#apiDot"), label = $("#apiLabel");
  dot.className = "dot"; label.textContent = "Checking API…";
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const r = await fetch(API + "/", { signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) throw new Error(r.status);
    dot.className = "dot ok"; label.textContent = "API online";
  } catch {
    dot.className = "dot bad"; label.textContent = "API offline";
  }
}

function parseApiError(status, body) {
  if (status === 422 && Array.isArray(body?.detail)) {
    return body.detail.map((d) => `${(d.loc || []).slice(1).join(".")}: ${d.msg}`).join(" · ");
  }
  return body?.detail ? String(body.detail) : `Server responded with status ${status}.`;
}

async function predict(payload) {
  let res;
  try {
    res = await fetch(API + "/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error(`Can't reach ${API}. Is the FastAPI server running (uvicorn main:app --reload)?`);
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(parseApiError(res.status, body));
  return body;
}

/* ───────── result rendering ───────── */
const card = () => $("#resultCard");
const setState = (s, extra) => { card().dataset.state = s; if (extra) card().dataset.result = extra; };

function countUp(node, to, ms = 1100) {
  if (reduceMotion) { node.textContent = Math.round(to); return; }
  const t0 = performance.now();
  const tick = (now) => {
    const p = Math.min((now - t0) / ms, 1);
    node.textContent = Math.round(to * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function renderResult(resp, payload) {
  const classes = Array.isArray(resp.Classes) ? resp.Classes : CLASSES;
  const probs = resp.Probability;
  const name = resp.Predicted_room_type;
  const meta = CLASS_META[name] || CLASS_META["Private room"];
  const topIdx = classes.indexOf(name);
  const top = (probs[topIdx] ?? Math.max(...probs)) * 100;

  setState("result", meta.key);
  $("#verdictName").textContent = meta.label;
  $("#verdictBlurb").textContent = meta.blurb;

  // ring (start empty → animate)
  const ring = $("#ringBar");
  ring.style.transition = "none"; ring.style.strokeDashoffset = 100; void ring.getBoundingClientRect();
  ring.style.transition = ""; ring.style.strokeDashoffset = 100 - top;
  $("#bigPct").textContent = "0"; countUp($("#bigPct"), top);

  // bars
  const bars = $("#bars"); bars.replaceChildren();
  classes.forEach((c, i) => {
    const m = CLASS_META[c] || { label: c, c1: "#999", c2: "#ccc" };
    const pct = (probs[i] ?? 0) * 100;
    const fill = el("div", { className: "fill" });
    fill.style.setProperty("--c1", m.c1); fill.style.setProperty("--c2", m.c2);
    const val = el("span", { textContent: "0.0%" });
    bars.append(el("div", { className: "bar-row" },
      el("div", { className: "top" }, el("span", { textContent: m.label }), val),
      el("div", { className: "track" }, fill)));
    requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.width = pct + "%"; }));
    animateText(val, pct);
  });

  $("#confNote").textContent =
    top >= 85 ? "High confidence — the model is very sure about this one."
    : top >= 65 ? "Moderate confidence — a few features pull toward the other class."
    : "Low confidence — this listing sits close to the decision boundary.";

  addHistory(name, meta.key, top, payload);
}
function animateText(node, to) {
  if (reduceMotion) { node.textContent = to.toFixed(1) + "%"; return; }
  const t0 = performance.now();
  const tick = (now) => {
    const p = Math.min((now - t0) / 1200, 1);
    node.textContent = (to * (1 - Math.pow(1 - p, 3))).toFixed(1) + "%";
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function addHistory(name, key, pct, p) {
  history.unshift({ name, key, pct, hood: p.neighbourhood, price: p.price });
  history = history.slice(0, 5);
  renderHistory();
}
function renderHistory() {
  const ul = $("#history"); ul.replaceChildren();
  if (!history.length) {
    ul.append(el("li", { className: "empty", textContent: "Nothing yet — your last 5 predictions land here." }));
    return;
  }
  history.forEach((h, i) => {
    const li = el("li", {},
      el("div", {}, el("div", { textContent: `${h.hood} · $${h.price}` }),
        el("div", { className: "meta", textContent: `${h.pct.toFixed(1)}% confidence` })),
      el("span", { className: "tag " + h.key, textContent: CLASS_META[h.name]?.label || h.name }));
    if (i > 0) li.style.animation = "none";
    ul.append(li);
  });
}

/* ───────── submit ───────── */
let lastPayload = null;
async function onSubmit(e) {
  e?.preventDefault();
  clearErrors();
  const { data, problems } = validate();
  if (problems.length) { showError(problems.join(" ")); return; }

  const payload = { ...data, neighbourhood_group: borough, neighbourhood: hood };
  lastPayload = payload;

  const btn = $("#submitBtn");
  btn.classList.add("loading"); $(".cta-label", btn).textContent = "Classifying…";
  setState("loading");
  if (window.innerWidth <= 920) card().scrollIntoView({ behavior: "smooth", block: "center" });

  const minWait = new Promise((r) => setTimeout(r, reduceMotion ? 0 : 900)); // let the scan animation breathe
  try {
    const [resp] = await Promise.all([predict(payload), minWait]);
    renderResult(resp, payload);
    checkApi();
  } catch (err) {
    await minWait;
    $("#errMsg").textContent = err.message;
    setState("error");
    $("#apiDot").className = "dot bad"; $("#apiLabel").textContent = "API offline";
  } finally {
    btn.classList.remove("loading"); $(".cta-label", btn).textContent = "Classify listing";
  }
}

/* ───────── background particles ───────── */
function particles() {
  if (reduceMotion) return;
  const cv = $("#bg"), ctx = cv.getContext("2d");
  let w, h, pts = [];
  const resize = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    w = cv.width = innerWidth * dpr; h = cv.height = innerHeight * dpr;
    cv.style.width = innerWidth + "px"; cv.style.height = innerHeight + "px";
    const n = Math.min(70, Math.floor(innerWidth / 20));
    pts = Array.from({ length: n }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - .5) * .35 * dpr, vy: (Math.random() - .5) * .35 * dpr, r: (Math.random() * 1.4 + .6) * dpr,
    }));
  };
  resize(); addEventListener("resize", resize);
  const link = 130 * (devicePixelRatio || 1);
  (function frame() {
    if (!document.hidden) {
      ctx.clearRect(0, 0, w, h);
      for (const p of pts) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fillStyle = "rgba(160,190,255,.55)"; ctx.fill();
      }
      for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y, d = Math.hypot(dx, dy);
        if (d < link) {
          ctx.strokeStyle = `rgba(130,160,255,${(1 - d / link) * .18})`;
          ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y); ctx.stroke();
        }
      }
    }
    requestAnimationFrame(frame);
  })();
}

/* ───────── init ───────── */
document.addEventListener("DOMContentLoaded", () => {
  buildRadar();
  ["price", "minimum_nights", "availability_365"].forEach(bindSlider);
  fillForm(PRESETS.studio);

  $("#form").addEventListener("submit", onSubmit);
  $("#retryBtn").addEventListener("click", () => onSubmit());
  document.querySelectorAll("[data-preset]").forEach((b) =>
    b.addEventListener("click", () => { fillForm(PRESETS[b.dataset.preset]); setState("idle"); }));
  NUM_FIELDS.forEach((k) => $("#" + k).addEventListener("input", (e) => {
    e.target.classList.remove("invalid");
    if (k === "latitude" || k === "longitude") moveMarker($("#latitude").value || 0, $("#longitude").value || 0, null);
  }));
  $("#clearHist").addEventListener("click", () => { history = []; renderHistory(); });

  // API settings popover
  const pop = $("#apiPop"), btn = $("#apiStatus");
  $("#apiUrl").value = API;
  btn.addEventListener("click", () => { pop.hidden = !pop.hidden; btn.setAttribute("aria-expanded", String(!pop.hidden)); });
  $("#apiSave").addEventListener("click", () => {
    API = ($("#apiUrl").value.trim() || DEFAULT_API).replace(/\/+$/, "");
    store.set("stp_api", API); pop.hidden = true; btn.setAttribute("aria-expanded", "false"); checkApi();
  });
  document.addEventListener("click", (e) => { if (!e.target.closest(".api")) pop.hidden = true; });

  // cursor-follow glow on cards
  document.querySelectorAll(".card").forEach((c) =>
    c.addEventListener("pointermove", (e) => {
      const r = c.getBoundingClientRect();
      c.style.setProperty("--mx", e.clientX - r.left + "px");
      c.style.setProperty("--my", e.clientY - r.top + "px");
    }));

  particles();
  checkApi();
});
/* Glassy IP Scanner — website interactions.
   Theme data mirrors src/renderer/src/lib.ts so the site's look matches the app. */

const THEMES = [
  {
    id: "gallery",
    name: "Gallery Glass",
    type: "Gallery",
    vars: { "--glassy-bg": "#0b1020", "--glassy-panel": "rgba(17, 26, 48, 0.68)", "--glassy-panel2": "rgba(14, 21, 38, 0.60)", "--glassy-deep": "#070b16", "--glassy-border": "#223052", "--glassy-borderlight": "#2e3f6b", "--glassy-accent": "#38bdf8", "--glassy-accent2": "#a78bfa", "--glassy-good": "#34d399", "--glassy-warn": "#fbbf24", "--glassy-bad": "#f87171", "--glassy-muted": "#8b98b8", "--glassy-text": "#e2e8f0", "--glassy-glow": "0 0 24px rgba(56, 189, 248, 0.25)", "--glassy-gallery-overlay": "rgba(7, 11, 22, 0.55)" }
  },
  {
    id: "galleryblack",
    name: "Gallery Black Glass",
    type: "Gallery",
    vars: { "--glassy-bg": "#0b1020", "--glassy-panel": "rgba(8, 10, 17, 0.74)", "--glassy-panel2": "rgba(5, 7, 12, 0.66)", "--glassy-deep": "#05070d", "--glassy-border": "#1b2338", "--glassy-borderlight": "#2b3a55", "--glassy-accent": "#cbd5e1", "--glassy-accent2": "#94a3b8", "--glassy-good": "#34d399", "--glassy-warn": "#fbbf24", "--glassy-bad": "#f87171", "--glassy-muted": "#8b98b8", "--glassy-text": "#e2e8f0", "--glassy-glow": "0 0 24px rgba(203, 213, 225, 0.22)", "--glassy-gallery-overlay": "rgba(0, 0, 0, 0.62)" }
  },
  {
    id: "gallerygreen",
    name: "Gallery Green Glass",
    type: "Gallery",
    vars: { "--glassy-bg": "#0b1020", "--glassy-panel": "rgba(12, 30, 22, 0.68)", "--glassy-panel2": "rgba(9, 24, 17, 0.60)", "--glassy-deep": "#04120c", "--glassy-border": "#1e3b2f", "--glassy-borderlight": "#2c5847", "--glassy-accent": "#34d399", "--glassy-accent2": "#a3e635", "--glassy-good": "#6ee7b7", "--glassy-warn": "#fbbf24", "--glassy-bad": "#f87171", "--glassy-muted": "#87a89a", "--glassy-text": "#e7f5ee", "--glassy-glow": "0 0 24px rgba(52, 211, 153, 0.25)", "--glassy-gallery-overlay": "rgba(5, 18, 11, 0.50)" }
  },
  {
    id: "galleryblue",
    name: "Gallery Blue Glass",
    type: "Gallery",
    vars: { "--glassy-bg": "#0b1020", "--glassy-panel": "rgba(13, 24, 46, 0.68)", "--glassy-panel2": "rgba(10, 19, 37, 0.60)", "--glassy-deep": "#04070d", "--glassy-border": "#1e3452", "--glassy-borderlight": "#2b4c7a", "--glassy-accent": "#60a5fa", "--glassy-accent2": "#22d3ee", "--glassy-good": "#34d399", "--glassy-warn": "#fbbf24", "--glassy-bad": "#fb7185", "--glassy-muted": "#8aa4c8", "--glassy-text": "#e0f2fe", "--glassy-glow": "0 0 24px rgba(96, 165, 250, 0.25)", "--glassy-gallery-overlay": "rgba(5, 10, 24, 0.50)" }
  },
  {
    id: "galleryred",
    name: "Gallery Red Glass",
    type: "Gallery",
    vars: { "--glassy-bg": "#0b1020", "--glassy-panel": "rgba(38, 16, 20, 0.68)", "--glassy-panel2": "rgba(30, 12, 15, 0.60)", "--glassy-deep": "#170506", "--glassy-border": "#47222a", "--glassy-borderlight": "#66313b", "--glassy-accent": "#fb7185", "--glassy-accent2": "#fbbf24", "--glassy-good": "#34d399", "--glassy-warn": "#facc15", "--glassy-bad": "#fb7185", "--glassy-muted": "#d39aa3", "--glassy-text": "#fde8ea", "--glassy-glow": "0 0 24px rgba(251, 113, 133, 0.25)", "--glassy-gallery-overlay": "rgba(24, 5, 8, 0.50)" }
  },
  {
    id: "galleryorange",
    name: "Gallery Orange Glass",
    type: "Gallery",
    vars: { "--glassy-bg": "#0b1020", "--glassy-panel": "rgba(40, 24, 12, 0.68)", "--glassy-panel2": "rgba(32, 18, 9, 0.60)", "--glassy-deep": "#180b03", "--glassy-border": "#4a3017", "--glassy-borderlight": "#6b4520", "--glassy-accent": "#fb923c", "--glassy-accent2": "#fbbf24", "--glassy-good": "#34d399", "--glassy-warn": "#fbbf24", "--glassy-bad": "#f87171", "--glassy-muted": "#d3ad92", "--glassy-text": "#fdf0e3", "--glassy-glow": "0 0 24px rgba(251, 146, 60, 0.25)", "--glassy-gallery-overlay": "rgba(26, 11, 3, 0.50)" }
  },
  {
    id: "gallerypurple",
    name: "Gallery Purple Glass",
    type: "Gallery",
    vars: { "--glassy-bg": "#0b1020", "--glassy-panel": "rgba(30, 18, 48, 0.68)", "--glassy-panel2": "rgba(24, 14, 38, 0.60)", "--glassy-deep": "#0f0718", "--glassy-border": "#3a2a55", "--glassy-borderlight": "#553d78", "--glassy-accent": "#a78bfa", "--glassy-accent2": "#f472b6", "--glassy-good": "#34d399", "--glassy-warn": "#fbbf24", "--glassy-bad": "#f87171", "--glassy-muted": "#b5a6d8", "--glassy-text": "#f3ecfc", "--glassy-glow": "0 0 24px rgba(167, 139, 250, 0.25)", "--glassy-gallery-overlay": "rgba(14, 5, 24, 0.50)" }
  },
  {
    id: "midnight",
    name: "Midnight",
    type: "Solid",
    vars: { "--glassy-bg": "#0b1020", "--glassy-panel": "#111a30", "--glassy-panel2": "#0e1526", "--glassy-deep": "#070b16", "--glassy-border": "#223052", "--glassy-borderlight": "#2e3f6b", "--glassy-accent": "#38bdf8", "--glassy-accent2": "#a78bfa", "--glassy-good": "#34d399", "--glassy-warn": "#fbbf24", "--glassy-bad": "#f87171", "--glassy-muted": "#8b98b8", "--glassy-text": "#e2e8f0", "--glassy-glow": "0 0 24px rgba(56, 189, 248, 0.25)" }
  },
  {
    id: "ocean",
    name: "Ocean",
    type: "Solid",
    vars: { "--glassy-bg": "#04141f", "--glassy-panel": "#082b3d", "--glassy-panel2": "#06212f", "--glassy-deep": "#020d14", "--glassy-border": "#0e3d56", "--glassy-borderlight": "#17567a", "--glassy-accent": "#22d3ee", "--glassy-accent2": "#60a5fa", "--glassy-good": "#34d399", "--glassy-warn": "#facc15", "--glassy-bad": "#fb7185", "--glassy-muted": "#7aa2bb", "--glassy-text": "#e0f2fe", "--glassy-glow": "0 0 24px rgba(34, 211, 238, 0.25)" }
  },
  {
    id: "forest",
    name: "Forest",
    type: "Solid",
    vars: { "--glassy-bg": "#0c1512", "--glassy-panel": "#14241d", "--glassy-panel2": "#0f1d17", "--glassy-deep": "#070d0a", "--glassy-border": "#1e3b2f", "--glassy-borderlight": "#2c5847", "--glassy-accent": "#34d399", "--glassy-accent2": "#a3e635", "--glassy-good": "#4ade80", "--glassy-warn": "#fbbf24", "--glassy-bad": "#f87171", "--glassy-muted": "#87a89a", "--glassy-text": "#e7f5ee", "--glassy-glow": "0 0 24px rgba(52, 211, 153, 0.25)" }
  },
  {
    id: "sunset",
    name: "Sunset",
    type: "Solid",
    vars: { "--glassy-bg": "#1d0f1e", "--glassy-panel": "#2d1530", "--glassy-panel2": "#251226", "--glassy-deep": "#150a16", "--glassy-border": "#47224a", "--glassy-borderlight": "#653466", "--glassy-accent": "#fb7185", "--glassy-accent2": "#fbbf24", "--glassy-good": "#4ade80", "--glassy-warn": "#fbbf24", "--glassy-bad": "#fb7185", "--glassy-muted": "#b58ab5", "--glassy-text": "#fce7f3", "--glassy-glow": "0 0 24px rgba(251, 113, 133, 0.25)" }
  },
  {
    id: "royal",
    name: "Royal",
    type: "Solid",
    vars: { "--glassy-bg": "#0d0b21", "--glassy-panel": "#171436", "--glassy-panel2": "#13102c", "--glassy-deep": "#08071a", "--glassy-border": "#2a2652", "--glassy-borderlight": "#3d3780", "--glassy-accent": "#818cf8", "--glassy-accent2": "#c084fc", "--glassy-good": "#34d399", "--glassy-warn": "#fbbf24", "--glassy-bad": "#f87171", "--glassy-muted": "#9aa3d8", "--glassy-text": "#e6e7f5", "--glassy-glow": "0 0 24px rgba(129, 140, 248, 0.25)" }
  },
  {
    id: "candy",
    name: "Candy",
    type: "Solid",
    vars: { "--glassy-bg": "#1a0b2e", "--glassy-panel": "#261040", "--glassy-panel2": "#1f0c36", "--glassy-deep": "#120623", "--glassy-border": "#3d1d63", "--glassy-borderlight": "#5b2f8f", "--glassy-accent": "#f472b6", "--glassy-accent2": "#22d3ee", "--glassy-good": "#4ade80", "--glassy-warn": "#fbbf24", "--glassy-bad": "#fb7185", "--glassy-muted": "#c39bd8", "--glassy-text": "#fae8ff", "--glassy-glow": "0 0 24px rgba(244, 114, 182, 0.28)" }
  },
  {
    id: "paper",
    name: "Paper",
    type: "Light",
    vars: { "--glassy-bg": "#f1f5f9", "--glassy-panel": "#ffffff", "--glassy-panel2": "#e2e8f0", "--glassy-deep": "#cbd5e1", "--glassy-border": "#cbd5e1", "--glassy-borderlight": "#94a3b8", "--glassy-accent": "#2563eb", "--glassy-accent2": "#7c3aed", "--glassy-good": "#16a34a", "--glassy-warn": "#d97706", "--glassy-bad": "#dc2626", "--glassy-muted": "#64748b", "--glassy-text": "#1e293b", "--glassy-glow": "0 0 24px rgba(37, 99, 235, 0.18)" }
  }
];

const rootEl = document.documentElement;
let activeTheme = "gallery";

function applyTheme(id) {
  const theme = THEMES.find((t) => t.id === id) || THEMES[0];
  for (const [key, value] of Object.entries(theme.vars)) {
    rootEl.style.setProperty(key, value);
  }
  rootEl.dataset.theme = id;
  document.body.classList.toggle("gallery", theme.type === "Gallery");
  activeTheme = id;
  document.querySelectorAll(".theme-card").forEach((card) => {
    card.classList.toggle("active", card.dataset.theme === id);
  });
}

function buildThemePicker() {
  const grid = document.getElementById("themeGrid");
  THEMES.forEach((theme) => {
    const card = document.createElement("button");
    card.className = "theme-card";
    card.dataset.theme = theme.id;
    card.setAttribute("aria-pressed", "false");
    card.innerHTML =
      '<span class="theme-swatch">' +
      '<span style="background:var(--glassy-deep)"></span>' +
      '<span style="background:' + theme.vars["--glassy-accent"] + '"></span>' +
      '<span style="background:' + theme.vars["--glassy-accent2"] + '"></span>' +
      "</span>" +
      '<span class="theme-name">' + theme.name + "</span>" +
      '<span class="theme-type">' + theme.type + " · " + theme.id + "</span>";
    card.addEventListener("click", () => {
      applyTheme(theme.id);
      card.setAttribute("aria-pressed", "true");
    });
    grid.appendChild(card);
  });
  applyTheme(activeTheme);
}

/* Mobile nav. */
const toggle = document.querySelector(".nav-toggle");
const navLinks = document.getElementById("navLinks");
toggle.addEventListener("click", () => {
  const open = navLinks.classList.toggle("open");
  toggle.setAttribute("aria-expanded", String(open));
});
navLinks.querySelectorAll("a").forEach((a) =>
  a.addEventListener("click", () => {
    navLinks.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
  })
);

/* Scroll reveal. */
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("in");
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12 }
);
document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));

/* FAQ accordion. */
document.querySelectorAll(".faq-item").forEach((item) => {
  const q = item.querySelector(".faq-q");
  const a = item.querySelector(".faq-a");
  q.addEventListener("click", () => {
    const open = item.classList.toggle("open");
    q.setAttribute("aria-expanded", String(open));
    a.style.maxHeight = open ? a.scrollHeight + "px" : "0";
  });
});

buildThemePicker();

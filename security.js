
"use strict";

(() => {
  if (window.__KM_SECURITY_V2__) return;
  window.__KM_SECURITY_V2__ = true;

  const CONFIG = Object.freeze({
    VERSION: "2.0",
    MAX_INPUT: 80,
    MAX_LOGS: 100,
    SEARCH_DELAY: 200,
    MAX_SEARCHES: 60,
    SEARCH_WINDOW: 60000,

    CATEGORIES: [
      "all",
      "action",
      "puzzle",
      "multiplayer",
      "classic",
      "strategy"
    ],

    DOMAINS: [
      "poki.com",
      "roblox.com",
      "minecraft.net",
      "2048.gg",
      "minesweeper.online",
      "playsnake.org",
      "sudoku.com",
      "chess.com"
    ]
  });

  const state = {
    logs: [],
    searches: [],
    blocked: 0,
    errors: 0,
    active: true
  };

  const log = (type, detail) => {
    const event = {
      type,
      detail: String(detail).slice(0, 100),
      time: new Date().toISOString()
    };

    state.logs.push(event);

    if (state.logs.length > CONFIG.MAX_LOGS) {
      state.logs.shift();
    }

    console.info("[KM SECURITY]", type);
  };

  const block = (type, detail) => {
    state.blocked++;
    log(type, detail);
  };

  // 1. COMPROBAR ELEMENTOS
  const search = document.getElementById("search");
  const container = document.getElementById("games");
  const count = document.getElementById("gameCount");
  const empty = document.getElementById("empty");
  const clear = document.getElementById("clearSearch");

  if (!search || !container || !count || !empty || !clear) {
    log("CRITICAL", "Faltan elementos esenciales");
    state.active = false;
    return;
  }

  const games = [...container.querySelectorAll(".game")];
  const buttons = [...document.querySelectorAll(".category")];
  const allowed = new Set(CONFIG.CATEGORIES);

  // 2. FILTRO DE ENTRADAS
  function sanitize(value) {
    return String(value)
      .slice(0, CONFIG.MAX_INPUT)
      .normalize("NFKC")
      .replace(/[\u0000-\u001F\u007F]/g, "")
      .trim()
      .toLowerCase();
  }

  // 3. VALIDAR DOMINIOS
  function validURL(href) {
    try {
      const url = new URL(href);

      return url.protocol === "https:" &&
        CONFIG.DOMAINS.some(domain =>
          url.hostname === domain ||
          url.hostname.endsWith("." + domain)
        );
    } catch {
      return false;
    }
  }

  function validateLinks() {
    document.querySelectorAll("a.play").forEach(link => {
      if (!validURL(link.href)) {
        link.removeAttribute("href");
        link.setAttribute("aria-disabled", "true");
        block("INVALID_LINK", "Enlace no autorizado");
        return;
      }

      link.target = "_blank";
      link.rel = "noopener noreferrer";
    });
  }

  validateLinks();

  // 4. VALIDAR CATEGORÍAS
  buttons.forEach(button => {
    if (!allowed.has(button.dataset.cat)) {
      button.disabled = true;
      block("INVALID_CATEGORY", "Categoría rechazada");
    }
  });

  games.forEach(game => {
    const categories = (game.dataset.cat || "")
      .split(/\s+/)
      .filter(category =>
        allowed.has(category) && category !== "all"
      );

    game.dataset.cat = categories.join(" ");
  });

  // 5. CONTROL DE FRECUENCIA
  function allowSearch() {
    const now = Date.now();

    state.searches = state.searches.filter(
      time => now - time < CONFIG.SEARCH_WINDOW
    );

    if (state.searches.length >= CONFIG.MAX_SEARCHES) {
      block("SEARCH_LIMIT", "Límite de búsquedas alcanzado");
      return false;
    }

    state.searches.push(now);
    return true;
  }

  // 6. BUSCADOR
  let selectedCategory = "all";
  let timer = null;

  function filterGames() {
    const query = sanitize(search.value);

    let visible = 0;

    games.forEach(game => {
      const name = (game.textContent || "").toLowerCase();

      const categories = game.dataset.cat.split(/\s+/);

      const matchesName = name.includes(query);

      const matchesCategory =
        selectedCategory === "all" ||
        categories.includes(selectedCategory);

      const show = matchesName && matchesCategory;

      game.hidden = !show;

      if (show) visible++;
    });

    empty.style.display = visible === 0 ? "block" : "none";

    count.textContent =
      visible + (visible === 1 ? " game" : " games");
  }

  search.addEventListener("input", () => {
    if (search.value.length > CONFIG.MAX_INPUT) {
      search.value = search.value.slice(0, CONFIG.MAX_INPUT);
      log("INPUT_LIMIT", "Entrada demasiado larga");
    }

    clearTimeout(timer);

    timer = setTimeout(() => {
      if (allowSearch()) filterGames();
    }, CONFIG.SEARCH_DELAY);
  });

  // 7. CATEGORÍAS SEGURAS
  buttons.forEach(button => {
    button.addEventListener("click", () => {
      const category = button.dataset.cat;

      if (!allowed.has(category)) {
        block("CATEGORY_BLOCKED", category);
        return;
      }

      selectedCategory = category;

      buttons.forEach(item => {
        const active = item === button;

        item.classList.toggle("active", active);
        item.setAttribute("aria-pressed", String(active));
      });

      filterGames();
    });
  });

  // 8. LIMPIAR BÚSQUEDA
  clear.addEventListener("click", () => {
    clearTimeout(timer);
    search.value = "";
    filterGames();
    search.focus();
  });

  // 9. PROTECCIÓN DE IMÁGENES
  container.querySelectorAll(".art img").forEach(img => {
    img.addEventListener("error", () => {
      img.hidden = true;

      const fallback = img.nextElementSibling;

      if (fallback) fallback.style.display = "block";

      log("IMAGE_ERROR", img.alt || "Imagen");
    }, { once: true });
  });

  // 10. DETECTAR CAMBIOS EN TARJETAS
  const observer = new MutationObserver(records => {
    if (records.some(record =>
      record.type === "childList" ||
      record.type === "attributes"
    )) {
      log("DOM_CHANGE", "Cambio detectado en las tarjetas");
      validateLinks();
    }
  });

  observer.observe(container, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["href", "data-cat"]
  });

  // 11. ERRORES JAVASCRIPT
  window.addEventListener("error", event => {
    state.errors++;
    log("JS_ERROR", event.message || "Error desconocido");
  });

  window.addEventListener("unhandledrejection", () => {
    state.errors++;
    log("PROMISE_ERROR", "Error de promesa");
  });

  // 12. PANEL DE SEGURIDAD
  window.KMSecurity = Object.freeze({
    status() {
      return {
        active: state.active,
        version: CONFIG.VERSION,
        games: games.length,
        blocked: state.blocked,
        errors: state.errors,
        logs: state.logs.length
      };
    },

    logs() {
      return state.logs.map(event => ({ ...event }));
    },

    domains() {
      return [...CONFIG.DOMAINS];
    }
  });

  // 13. INICIALIZAR
  buttons.forEach(button => {
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.cat === "all")
    );
  });

  filterGames();

  log("SYSTEM", "Security System v2.0 iniciado");

  console.info(
    "%c KEVIN MORALES SECURITY V2.0 ",
    "background:#087ee5;color:white;padding:10px;font-weight:bold"
  );

})();

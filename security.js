
/*
==========================================
 KEVIN MORALES | GAME CENTER
 SECURITY SYSTEM v1.0
==========================================
 Protección del navegador:
 - Anti-XSS básico
 - Validación de entradas
 - Anti-Spam del buscador
 - Control de enlaces externos
 - Validación de categorías
 - Protección de navegación externa
 - Control de errores
 - Detección de modificaciones del DOM
==========================================
*/

"use strict";

(() => {
  if (window.__KM_SECURITY_ACTIVE__) return;
  window.__KM_SECURITY_ACTIVE__ = true;

  const CONFIG = {
    MAX_SEARCH_LENGTH: 80,
    SEARCH_DELAY: 180,
    MAX_SEARCH_PER_MINUTE: 60,
    MAX_EVENTS: 30,
    ALLOWED_CATEGORIES: [
      "all",
      "action",
      "puzzle",
      "multiplayer",
      "classic",
      "strategy"
    ],
    ALLOWED_GAME_DOMAINS: [
      "poki.com",
      "roblox.com",
      "minecraft.net",
      "2048.gg",
      "minesweeper.online",
      "playsnake.org",
      "sudoku.com",
      "chess.com"
    ]
  };

  const state = {
    searches: [],
    events: [],
    lastSearch: 0,
    timer: null,
    blocked: 0
  };

  const log = (type, detail) => {
    const event = {
      type,
      detail: String(detail).slice(0, 120),
      time: new Date().toISOString()
    };

    state.events.push(event);

    if (state.events.length > CONFIG.MAX_EVENTS) {
      state.events.shift();
    }

    console.info("[KM SECURITY]", type, detail);
  };

  // 1. VERIFICACIÓN DE ELEMENTOS
  const search = document.getElementById("search");
  const gamesContainer = document.getElementById("games");
  const count = document.getElementById("gameCount");
  const empty = document.getElementById("empty");
  const clearSearch = document.getElementById("clearSearch");

  if (!search || !gamesContainer || !count || !empty || !clearSearch) {
    log("ERROR", "Elementos esenciales no encontrados");
    return;
  }

  const games = [...gamesContainer.querySelectorAll(".game")];
  const buttons = [...document.querySelectorAll(".category")];

  // 2. VALIDACIÓN DE CATEGORÍAS
  const allowed = new Set(CONFIG.ALLOWED_CATEGORIES);

  buttons.forEach(button => {
    if (!allowed.has(button.dataset.cat)) {
      button.disabled = true;
      log("FILTER", "Categoría no permitida");
    }
  });

  // 3. VALIDACIÓN DE ENLACES
  function validateLinks() {
    document.querySelectorAll("a.play").forEach(link => {
      try {
        const url = new URL(link.href);

        const valid =
          url.protocol === "https:" &&
          CONFIG.ALLOWED_GAME_DOMAINS.some(domain =>
            url.hostname === domain ||
            url.hostname.endsWith("." + domain)
          );

        if (!valid) {
          link.removeAttribute("href");
          link.setAttribute("aria-disabled", "true");
          log("BLOCKED_LINK", url.hostname);
          return;
        }

        link.rel = "noopener noreferrer";
        link.target = "_blank";

      } catch {
        link.removeAttribute("href");
        log("INVALID_LINK", "URL incorrecta");
      }
    });
  }

  validateLinks();

  // 4. VALIDACIÓN DE CATEGORÍAS DE JUEGOS
  games.forEach(game => {
    const categories = (game.dataset.cat || "").split(/\s+/);

    game.dataset.cat = categories
      .filter(cat => allowed.has(cat) && cat !== "all")
      .join(" ");
  });

  // 5. FILTRO DE ENTRADAS
  function sanitizeInput(value) {
    return String(value)
      .slice(0, CONFIG.MAX_SEARCH_LENGTH)
      .replace(/[\u0000-\u001F\u007F]/g, "")
      .normalize("NFKC")
      .trim()
      .toLowerCase();
  }

  // 6. FILTRO ANTI-SPAM
  function checkSearchLimit() {
    const now = Date.now();

    state.searches = state.searches.filter(
      time => now - time < 60000
    );

    if (state.searches.length >= CONFIG.MAX_SEARCH_PER_MINUTE) {
      log("RATE_LIMIT", "Demasiadas búsquedas");
      return false;
    }

    state.searches.push(now);
    return true;
  }

  // 7. BUSCADOR SEGURO
  let category = "all";

  function filterGames() {
    const query = sanitizeInput(search.value);

    let visible = 0;

    games.forEach(game => {
      const name = (game.textContent || "").toLowerCase();
      const categories = game.dataset.cat.split(/\s+/);

      const matchesName = name.includes(query);

      const matchesCategory =
        category === "all" ||
        categories.includes(category);

      const show = matchesName && matchesCategory;

      game.hidden = !show;

      if (show) visible++;
    });

    empty.style.display = visible === 0 ? "block" : "none";

    count.textContent =
      visible + (visible === 1 ? " game" : " games");
  }

  search.addEventListener("input", () => {
    if (search.value.length > CONFIG.MAX_SEARCH_LENGTH) {
      search.value = search.value.slice(
        0,
        CONFIG.MAX_SEARCH_LENGTH
      );
    }

    clearTimeout(state.timer);

    state.timer = setTimeout(() => {
      if (!checkSearchLimit()) return;

      state.lastSearch = Date.now();
      filterGames();
    }, CONFIG.SEARCH_DELAY);
  });

  // 8. BOTONES DE CATEGORÍAS
  buttons.forEach(button => {
    button.addEventListener("click", () => {
      const selected = button.dataset.cat;

      if (!allowed.has(selected)) {
        log("BLOCKED_CATEGORY", selected);
        return;
      }

      category = selected;

      buttons.forEach(item => {
        const active = item === button;

        item.classList.toggle("active", active);
        item.setAttribute("aria-pressed", String(active));
      });

      filterGames();
    });
  });

  // 9. BOTÓN LIMPIAR
  clearSearch.addEventListener("click", () => {
    search.value = "";
    clearTimeout(state.timer);
    filterGames();
    search.focus();
  });

  // 10. CONTROL DE ERRORES DE IMÁGENES
  gamesContainer.querySelectorAll(".art img").forEach(img => {
    img.addEventListener("error", () => {
      img.hidden = true;

      const fallback = img.nextElementSibling;

      if (fallback) {
        fallback.style.display = "block";
      }

      log("IMAGE_ERROR", img.alt || "Imagen");
    }, { once: true });
  });

  // 11. DETECCIÓN BÁSICA DE CAMBIOS EN LAS TARJETAS
  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === "childList" &&
          record.addedNodes.length > 0) {
        log("DOM_CHANGE", "Contenido añadido a la página");
        validateLinks();
      }
    }
  });

  observer.observe(gamesContainer, {
    childList: true,
    subtree: true
  });

  // 12. CONTROL DE ERRORES JAVASCRIPT
  window.addEventListener("error", event => {
    log(
      "JS_ERROR",
      event.message || "Error desconocido"
    );
  });

  window.addEventListener("unhandledrejection", () => {
    log("PROMISE_ERROR", "Promesa rechazada");
  });

  // 13. PANEL DE ESTADO PARA EL PROPIETARIO
  window.KMSecurity = Object.freeze({
    status: () => ({
      active: true,
      games: games.length,
      events: state.events.length,
      blockedLinks: state.blocked
    }),

    logs: () => state.events.map(event => ({ ...event })),

    version: "1.0"
  });

  // 14. INICIAR SISTEMA
  buttons.forEach(button => {
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.cat === "all")
    );
  });

  filterGames();

  console.info(
    "%c KEVIN MORALES SECURITY ACTIVE ",
    "background:#087ee5;color:white;font-weight:bold;padding:10px"
  );

  log("SYSTEM", "Security System iniciado");

})();

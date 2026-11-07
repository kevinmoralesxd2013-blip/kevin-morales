
/*
========================================
 KEVIN MORALES | GAME CENTER
 ANTI-BLOCK SYSTEM v1.0
========================================
*/
"use strict";

(() => {
  if (window.KMAntiBlock) return;

  const CONFIG = {
    VERSION: "1.0",
    MAX_ERRORS: 20,
    MAX_LOGS: 100,
    CHECK_INTERVAL: 15000,
    WATCH_RESOURCES: true
  };

  const state = {
    active: true,
    errors: 0,
    logs: [],
    started: Date.now()
  };

  function log(type, detail) {
    state.logs.push({
      type,
      detail: String(detail).slice(0, 150),
      time: new Date().toISOString()
    });

    if (state.logs.length > CONFIG.MAX_LOGS) {
      state.logs.shift();
    }

    console.warn("[KM ANTI-BLOCK]", type, detail);
  }

  // 1. DETECTOR DE ERRORES
  window.addEventListener("error", event => {
    state.errors++;

    log(
      "SCRIPT_ERROR",
      event.message || "Error desconocido"
    );
  });

  // 2. DETECTOR DE PROMESAS FALLIDAS
  window.addEventListener("unhandledrejection", event => {
    state.errors++;

    log(
      "PROMISE_ERROR",
      event.reason?.message || "Promesa rechazada"
    );
  });

  // 3. DETECTOR DE RECURSOS
  window.addEventListener("error", event => {
    if (event.target !== window) {
      log(
        "RESOURCE_ERROR",
        event.target?.src ||
        event.target?.href ||
        "Recurso no disponible"
      );
    }
  }, true);

  // 4. COMPROBACIÓN DE ARCHIVOS PRINCIPALES
  function checkResources() {
    const resources = [
      ...document.querySelectorAll(
        'script[src], link[rel="stylesheet"]'
      )
    ];

    resources.forEach(resource => {
      if (resource.dataset.kmChecked) return;

      resource.dataset.kmChecked = "true";

      if (
        resource.tagName === "SCRIPT" &&
        !resource.src
      ) {
        log("INVALID_SCRIPT", "Script sin dirección");
      }
    });
  }

  // 5. PROTECCIÓN CONTRA BUCLES DE REDIRECCIÓN
  let redirectDetected = false;

  window.addEventListener("beforeunload", () => {
    try {
      sessionStorage.setItem(
        "km_last_navigation",
        String(Date.now())
      );
    } catch {}
  });

  function checkNavigation() {
    try {
      const previous = Number(
        sessionStorage.getItem("km_last_navigation")
      );

      if (
        previous &&
        Date.now() - previous < 500
      ) {
        log(
          "FAST_NAVIGATION",
          "Navegación demasiado rápida detectada"
        );
      }
    } catch {}
  }

  // 6. MODO SEGURO
  function safeMode() {
    document.documentElement.dataset.kmSafeMode = "true";

    log("SAFE_MODE", "Modo de funcionamiento seguro");
  }

  // 7. MONITOR DE DISPONIBILIDAD
  function monitor() {
    if (!document.body) return;

    if (!document.documentElement) {
      log("DOM_ERROR", "Documento no disponible");
      return;
    }

    checkResources();
  }

  // 8. DETECTOR DE MODIFICACIONES
  const observer = new MutationObserver(records => {
    if (records.length > 200) {
      log(
        "DOM_ACTIVITY",
        "Actividad excesiva en el documento"
      );
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  // 9. API DE CONTROL
  window.KMAntiBlock = Object.freeze({
    status() {
      return {
        active: state.active,
        version: CONFIG.VERSION,
        errors: state.errors,
        logs: state.logs.length,
        uptime: Math.floor(
          (Date.now() - state.started) / 1000
        )
      };
    },

    logs() {
      return state.logs.map(item => ({ ...item }));
    },

    safeMode,

    check() {
      monitor();
      return this.status();
    }
  });

  // 10. INICIAR
  checkNavigation();
  monitor();

  if (state.errors >= CONFIG.MAX_ERRORS) {
    safeMode();
  }

  setInterval(monitor, CONFIG.CHECK_INTERVAL);

  log("SYSTEM", "ANTI-BLOCK iniciado correctamente");

})();

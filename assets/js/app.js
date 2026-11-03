/* global createInfiniteDrift2, PORTFOLIO_PHOTOS */
(function () {
  "use strict";

  const PHOTOS = window.PORTFOLIO_PHOTOS || [];
  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  if (!PHOTOS.length) {
    console.warn("Manifest de fotos ausente. Rode scripts/build-photos.py.");
    return;
  }

  document.getElementById("photoCount").textContent = String(PHOTOS.length);
  document.getElementById("year").textContent = String(new Date().getFullYear());

  /* ------------------------------------------------------------ helpers */
  const photoAt = (index) => PHOTOS[((index % PHOTOS.length) + PHOTOS.length) % PHOTOS.length];

  function largestSrc(photo) {
    return photo.variants[photo.variants.length - 1].src;
  }

  function src800(photo) {
    const variant =
      photo.variants.find((v) => v.w <= 900) || photo.variants[0];
    return variant.src;
  }

  function srcset(photo) {
    return photo.variants.map((v) => `${v.src} ${v.w}w`).join(", ");
  }

  function imageEl(photo, options) {
    const opts = options || {};
    const img = document.createElement("img");
    img.src = opts.thumb ? photo.thumb : src800(photo);
    if (!opts.thumb) img.srcset = srcset(photo);
    if (opts.sizes) img.sizes = opts.sizes;
    img.alt = opts.alt || photo.alt;
    img.loading = opts.eager ? "eager" : "lazy";
    img.decoding = "async";
    img.draggable = false;
    return img;
  }

  function normalize(text) {
    return (text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  /* ------------------------------------------- 1. HERO / INFINITE DRIFT */
  const domeHost = document.getElementById("dome");
  const pauseBtn = document.getElementById("driftPause");
  const pauseLabel = document.getElementById("driftPauseLabel");

  const dome = createInfiniteDrift2(domeHost, {
    images: PHOTOS.map((p) => p.thumb),
    tileWidth: 220,
    tileHeight: 280,
    gap: 16,
    borderRadius: 20,
    curve: 0.35,
    curveRadius: 1.5,
    zoom: 0.08,
    vignette: 0.32,
    autoScrollX: 0.3,
    autoScrollY: 0.12,
    enableDrag: true,
    dpr: 1.75,
  });

  let domePaused = false;
  function setDomePaused(value) {
    domePaused = !!value;
    dome.setPaused(domePaused);
    pauseBtn.setAttribute("aria-pressed", String(domePaused));
    pauseLabel.textContent = domePaused ? "Retomar" : "Pausar";
    pauseBtn.setAttribute("aria-label", domePaused ? "Retomar feed contínuo" : "Pausar feed contínuo");
  }

  pauseBtn.addEventListener("click", function () {
    setDomePaused(!domePaused);
  });

  // fallback sem WebGL: faixa contínua em CSS
  if (dome.isFallback) {
    domeHost.textContent = "";
    const strip = document.createElement("div");
    strip.className = "fallback-strip";
    PHOTOS.concat(PHOTOS).forEach(function (photo) {
      const item = document.createElement("div");
      item.className = "fallback-item";
      item.appendChild(imageEl(photo, { thumb: true, alt: "" }));
      strip.appendChild(item);
    });
    domeHost.appendChild(strip);
  }

  /* ------------------------------------------------------ 2. GRID MOTION */
  const board = document.getElementById("motionBoard");
  // seleção editorial: retratos, carnaval, rua e cor
  const GRID_SELECTION = [2, 3, 4, 22, 23, 24, 26, 35, 36, 37, 38, 39, 48, 56, 60, 61];
  for (let i = 0; i < GRID_SELECTION.length; i += 1) {
    const photo = photoAt(GRID_SELECTION[i]);
    const tile = document.createElement("div");
    tile.className = "motion-tile lens";
    tile.dataset.photo = "";
    tile.dataset.photoId = photo.id;
    tile.appendChild(
      imageEl(photo, {
        alt: photo.alt,
        sizes: "(max-width: 900px) 30vw, 18vw",
      })
    );
    board.appendChild(tile);
  }

  const motionStage = document.querySelector(".motion-stage");
  if (motionStage && canHover) {
    motionStage.addEventListener("mousemove", function (event) {
      if (document.body.classList.contains("reduced-motion")) return;
      const rect = motionStage.getBoundingClientRect();
      const px = event.clientX / rect.width - 0.5;
      const py = event.clientY / rect.height - 0.5;
      board.style.transform =
        "rotateX(" + (18 - py * 16) + "deg) rotateY(" + (-8 + px * 20) +
        "deg) rotateZ(2.4deg) scale(1.12)";
    });
    motionStage.addEventListener("mouseleave", function () {
      board.style.transform =
        "rotateX(18deg) rotateY(-8deg) rotateZ(2.4deg) scale(1.12)";
    });
  }

  /* ------------------------------------------------- 3. ACCORDION GALLERY */
  const SERIES = [
    { title: "manifestações", cat: "fotografia social e engajada", index: 3, note: "Atos, manifestações e a luta por direitos." },
    { title: "teatro", cat: "espetáculos teatrais", index: 18, note: "Peças e montagens em ambientes fechados e abertos." },
    { title: "eventos e cursos", cat: "seminários e encontros", index: 8, note: "Cursos, seminários e encontros — Curso Defensoras 2024." },
    { title: "música", cat: "saraus e musicais", index: 17, note: "Shows, saraus e apresentações musicais." },
    { title: "biblioteca", cat: "coro novo · 2024", index: 9, note: "Apresentação na Biblioteca Pública Estadual." },
    { title: "ruas", cat: "cantos e corres", index: 33, note: "O cotidiano e os cantos do povo brasileiro." },
  ];

  const accordion = document.getElementById("accordionGallery");
  const panels = [];

  SERIES.forEach(function (serie, position) {
    const photo = photoAt(serie.index);
    const panel = document.createElement("article");
    panel.className = "acc-panel lens";
    panel.dataset.photo = "";
    panel.dataset.photoId = photo.id;
    panel.dataset.title = serie.title;
    panel.dataset.cat = serie.cat;
    panel.tabIndex = 0;
    panel.setAttribute("role", "button");
    panel.setAttribute("aria-expanded", "false");

    panel.appendChild(
      imageEl(photo, {
        alt: serie.title + " — " + photo.alt,
        sizes: "(max-width: 900px) 92vw, 26vw",
      })
    );

    const caption = document.createElement("div");
    caption.className = "acc-caption";
    caption.innerHTML =
      "<span>" + serie.cat + "</span>" +
      "<h3>" + serie.title + "</h3>" +
      "<p>" + serie.note + "</p>";
    panel.appendChild(caption);

    const counter = document.createElement("span");
    counter.className = "acc-index";
    counter.textContent = String(position + 1).padStart(2, "0");
    panel.appendChild(counter);

    panel.addEventListener("click", function () {
      togglePanel(panel);
    });
    panel.addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        togglePanel(panel);
      }
    });

    accordion.appendChild(panel);
    panels.push(panel);
  });

  function togglePanel(target) {
    const willOpen = !target.classList.contains("is-open");
    panels.forEach(function (panel) {
      panel.classList.remove("is-open");
      panel.setAttribute("aria-expanded", "false");
    });
    if (willOpen) {
      target.classList.add("is-open");
      target.setAttribute("aria-expanded", "true");
    }
  }

  /* ---------------------------------------------------- 4. COOL BENTO */
  const bentoPhoto = document.getElementById("bentoPhoto");
  const featured = photoAt(0);
  document.querySelector(".bento-featured").dataset.photoId = featured.id;
  bentoPhoto.src = src800(featured);
  bentoPhoto.srcset = srcset(featured);
  bentoPhoto.sizes = "(max-width: 640px) 92vw, 45vw";

  const gradCard = document.getElementById("gradCard");
  if (gradCard) {
    gradCard.addEventListener("mousemove", function (event) {
      const rect = gradCard.getBoundingClientRect();
      gradCard.style.setProperty("--mx", event.clientX - rect.left + "px");
      gradCard.style.setProperty("--my", event.clientY - rect.top + "px");
    });
  }

  /* -------------------------------------------------- 5. LENS (Item 8) */
  const LOUPE_SIZE = 150;
  const ZOOM = 2.6;

  document.querySelectorAll(".lens").forEach(function (host) {
    const img = host.querySelector("img");
    if (!img) return;

    const photo =
      PHOTOS.find((p) => p.id === host.dataset.photoId) || PHOTOS[0];

    const loupe = document.createElement("div");
    loupe.className = "lens-loupe";
    loupe.setAttribute("aria-hidden", "true");
    loupe.style.backgroundImage = "url('" + src800(photo) + "')";
    host.appendChild(loupe);

    let bgReady = false;

    host.addEventListener("mousemove", function (event) {
      if (!canHover) return;
      const rect = host.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
        loupe.style.display = "none";
        return;
      }
      if (!bgReady) {
        loupe.style.backgroundSize = rect.width * ZOOM + "px auto";
        bgReady = true;
      }
      loupe.style.display = "block";
      loupe.style.left =
        Math.max(0, Math.min(rect.width - LOUPE_SIZE, x - LOUPE_SIZE / 2)) + "px";
      loupe.style.top =
        Math.max(0, Math.min(rect.height - LOUPE_SIZE, y - LOUPE_SIZE / 2)) + "px";
      loupe.style.backgroundPosition =
        -(x * ZOOM - LOUPE_SIZE / 2) + "px " + -(y * ZOOM - LOUPE_SIZE / 2) + "px";
    });

    host.addEventListener("mouseleave", function () {
      loupe.style.display = "none";
    });
    host.addEventListener("mouseenter", function () {
      bgReady = false;
    });
  });

  /* ------------------------------------ 6. TRAIL DE FOTOS (Item 6) */
  const trailLayer = document.getElementById("trailLayer");
  let trailIndex = 0;
  let lastTrailAt = 0;
  const TRAIL_HOLD = 633; // +15% em relação ao valor anterior (550ms)
  const TRAIL_FADE = 920; // +15% em relação ao valor anterior (800ms)

  const photosBoundary = "[data-photo], .lens, img, .drift-canvas";

  window.addEventListener("mousemove", function (event) {
    if (!canHover) return;
    if (document.body.classList.contains("reduced-motion")) return;
    if (event.target.closest(photosBoundary)) return; // sobre fotos: só a lente

    const now = performance.now();
    if (now - lastTrailAt < 90) return;
    lastTrailAt = now;

    const photo = photoAt(trailIndex);
    trailIndex += 1;

    const item = document.createElement("div");
    item.className = "trail-item";
    item.style.left = event.clientX + "px";
    item.style.top = event.clientY + "px";

    const thumb = document.createElement("img");
    thumb.src = photo.thumb;
    thumb.alt = "";
    item.appendChild(thumb);

    trailLayer.appendChild(item);

    requestAnimationFrame(function () {
      item.style.opacity = "0.95";
      item.style.transform =
        "translate(-50%, -50%) scale(1) rotate(" + (Math.random() - 0.5) * 16 + "deg)";
    });

    window.setTimeout(function () {
      item.style.opacity = "0";
      item.style.transform =
        "translate(-50%, -50%) scale(0.62) translateY(18px)";
      window.setTimeout(function () {
        item.remove();
      }, TRAIL_FADE);
    }, TRAIL_HOLD);
  });

  /* ------------------------------------------------- 7. BUSCA / HEADER */
  const searchInput = document.getElementById("searchInput");
  const searchResults = document.getElementById("searchResults");

  function openSeries(panel) {
    document.getElementById("gallery").scrollIntoView({ behavior: "smooth", block: "start" });
    panels.forEach(function (item) {
      item.classList.remove("is-open");
      item.setAttribute("aria-expanded", "false");
    });
    panel.classList.add("is-open");
    panel.setAttribute("aria-expanded", "true");
    window.setTimeout(function () {
      panel.focus({ preventScroll: true });
    }, 450);
  }

  function closeSearch() {
    searchResults.hidden = true;
    searchResults.textContent = "";
    panels.forEach(function (panel) {
      panel.style.opacity = "";
    });
  }

  function runSearch(raw) {
    const query = normalize(raw.trim());
    if (!query) {
      closeSearch();
      return;
    }

    const matches = panels.filter(function (panel) {
      return (
        normalize(panel.dataset.title).includes(query) ||
        normalize(panel.dataset.cat).includes(query)
      );
    });

    panels.forEach(function (panel) {
      panel.style.opacity = matches.includes(panel) ? "" : "0.35";
    });

    searchResults.textContent = "";
    if (!matches.length) {
      const empty = document.createElement("p");
      empty.className = "search-empty";
      empty.textContent = "Nenhuma série encontrada.";
      searchResults.appendChild(empty);
    } else {
      matches.slice(0, 6).forEach(function (panel) {
        const button = document.createElement("button");
        button.type = "button";
        button.setAttribute("role", "option");
        button.innerHTML =
          "<span><strong>" + panel.dataset.title + "</strong><small>" +
          panel.dataset.cat + "</small></span><span aria-hidden=\"true\">→</span>";
        button.addEventListener("click", function () {
          closeSearch();
          searchInput.value = "";
          openSeries(panel);
        });
        searchResults.appendChild(button);
      });
    }
    searchResults.hidden = false;
  }

  if (searchInput) {
    searchInput.addEventListener("input", function () {
      runSearch(searchInput.value);
    });
    searchInput.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        searchInput.value = "";
        closeSearch();
        searchInput.blur();
      }
      if (event.key === "Enter") {
        const first = searchResults.querySelector("button");
        if (first) first.click();
      }
    });
    document.addEventListener("click", function (event) {
      if (
        !event.target.closest(".search-wrap") &&
        !event.target.closest("#searchResults")
      ) {
        closeSearch();
      }
    });
  }

  /* --------------------------------------------------- 8. NAV / MENU */
  const menuToggle = document.getElementById("menuToggle");
  const mobileNav = document.getElementById("mobileNav");

  if (menuToggle && mobileNav) {
    menuToggle.addEventListener("click", function () {
      const isOpen = mobileNav.hidden;
      mobileNav.hidden = !isOpen;
      menuToggle.setAttribute("aria-expanded", String(isOpen));
      menuToggle.setAttribute("aria-label", isOpen ? "Fechar menu" : "Abrir menu");
    });
    mobileNav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        mobileNav.hidden = true;
        menuToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  const navLinks = Array.from(document.querySelectorAll(".site-nav a"));
  const sections = navLinks
    .map(function (link) {
      const id = link.getAttribute("href");
      return { link: link, section: id ? document.querySelector(id) : null };
    })
    .filter((item) => item.section);

  if ("IntersectionObserver" in window) {
    const navObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          navLinks.forEach((link) => link.classList.remove("is-active"));
          const found = sections.find((item) => item.section === entry.target);
          if (found) found.link.classList.add("is-active");
        });
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );
    sections.forEach((item) => navObserver.observe(item.section));
  }

  /* ------------------------------------------------ 9. SPEED DIAL */
  const fabBtn = document.getElementById("fabBtn");
  const fabMenu = document.getElementById("fabMenu");
  const fabIcon = document.getElementById("fabIcon");

  if (fabBtn && fabMenu) {
    fabBtn.addEventListener("click", function () {
      const open = fabMenu.hidden;
      fabMenu.hidden = !open;
      fabBtn.setAttribute("aria-expanded", String(open));
      fabIcon.textContent = open ? "×" : "+";
    });
    document.getElementById("toTop").addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
      fabMenu.hidden = true;
      fabBtn.setAttribute("aria-expanded", "false");
      fabIcon.textContent = "+";
    });
  }

  /* ------------------------------------------- 10. A11Y / PREFERÊNCIAS */
  const contrastBtn = document.getElementById("contrastBtn");
  const motionBtn = document.getElementById("motionBtn");
  let currentFont = 16;

  document.querySelectorAll("[data-font]").forEach(function (button) {
    button.addEventListener("click", function () {
      const step = Number(button.dataset.font);
      currentFont = step === 0 ? 16 : Math.max(14, Math.min(22, currentFont + step * 2));
      document.documentElement.style.fontSize = currentFont + "px";
    });
  });

  contrastBtn.addEventListener("click", function () {
    const active = document.body.classList.toggle("high-contrast");
    contrastBtn.setAttribute("aria-pressed", String(active));
  });

  function applyMotionPreference(reduced) {
    document.body.classList.toggle("reduced-motion", reduced);
    motionBtn.setAttribute("aria-pressed", String(reduced));
    motionBtn.textContent = reduced ? "Movimento reduzido" : "Reduzir movimento";
    if (!dome.isFallback) setDomePaused(reduced);
    if (reduced) {
      trailLayer.textContent = "";
      board.style.transform =
        "rotateX(18deg) rotateY(-8deg) rotateZ(2.4deg) scale(1.12)";
    }
  }

  motionBtn.addEventListener("click", function () {
    applyMotionPreference(!document.body.classList.contains("reduced-motion"));
  });

  if (reduceMotionQuery.matches) applyMotionPreference(true);

  /* ---------------------------------------------------- 11. REVEAL */
  const revealTargets = document.querySelectorAll(
    ".section-head, .motion-stage, .acc-panel, .bento-card, .contact > *"
  );
  revealTargets.forEach(function (el) {
    el.classList.add("reveal");
    // o que já está na primeira dobra aparece imediatamente (sem "sumir" em telas altas)
    if (el.getBoundingClientRect().top < window.innerHeight * 1.1) {
      el.classList.add("in-view");
    }
  });

  if ("IntersectionObserver" in window) {
    const revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.06 }
    );
    revealTargets.forEach((el) => revealObserver.observe(el));
  } else {
    revealTargets.forEach((el) => el.classList.add("in-view"));
  }
})();

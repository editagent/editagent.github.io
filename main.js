// ---- showcase carousel ---------------------------------------------------
// One example on stage at a time; a horizontal filmstrip below pages 8 at a
// time. Images of hidden slides wait in data-src and are fetched when their
// slide (or its neighbor) is shown — the galleries hold ~250 images.
const hydrate = (slide) => {
  if (!slide) return;
  slide.querySelectorAll("img[data-src]").forEach((im) => {
    im.src = im.dataset.src;
    im.removeAttribute("data-src");
  });
};
const hydrateAround = (slides, i) => {
  const n = slides.length;
  hydrate(slides[i]);
  hydrate(slides[(i + 1) % n]);
  hydrate(slides[(i - 1 + n) % n]);
};

const lightboxOpen = () => document.getElementById("lightbox")?.classList.contains("on");

document.querySelectorAll(".showcase").forEach((sc) => {
  const slides = [...sc.querySelectorAll(".slide")];
  const thumbs = [...sc.querySelectorAll(".thumb")];
  if (!slides.length) return;
  const stripe = sc.querySelector(".thumbs");
  const view = sc.querySelector(".thumbview");
  const up = sc.querySelector(".railnav.up");
  const down = sc.querySelector(".railnav.down");
  const jumps = [...sc.querySelectorAll(".jump button")];
  const PER = 8;
  let i = 0;
  let page = 0;
  const pages = Math.max(1, Math.ceil(thumbs.length / PER));

  function sizeRail() {
    // each thumb is 1/PER of the strip's visible width
    if (!thumbs.length || window.innerWidth <= 860) { stripe.style.removeProperty("--tw"); return; }
    const gap = parseFloat(getComputedStyle(stripe).columnGap) || 6;
    stripe.style.setProperty("--tw", `${(view.clientWidth - gap * (PER - 1)) / PER}px`);
  }

  // the strip pages by transform; focus can also scroll .thumbview, so reset it
  function showPage(p) {
    page = Math.max(0, Math.min(pages - 1, p));
    const t0 = thumbs[0];
    if (view) view.scrollLeft = 0;
    if (t0 && window.innerWidth > 860) {
      const w = t0.getBoundingClientRect().width;
      const gap = parseFloat(getComputedStyle(stripe).columnGap) || 6;
      stripe.style.transform = `translateX(-${page * PER * (w + gap)}px)`;
    } else if (stripe) {
      stripe.style.transform = "";
    }
    if (up) up.disabled = page === 0;
    if (down) down.disabled = page >= pages - 1;
  }

  function paint() {
    hydrate(slides[i]);
    slides.forEach((s, k) => s.classList.toggle("on", k === i));
    thumbs.forEach((t, k) => t.classList.toggle("on", k === i));
    // a jump chip is lit while the stage shows one of its examples
    jumps.forEach((b, k) => {
      const end = k + 1 < jumps.length ? +jumps[k + 1].dataset.i : slides.length;
      const on = i >= +b.dataset.i && i < end;
      b.classList.toggle("on", on);
      if (on) b.setAttribute("aria-current", "true"); else b.removeAttribute("aria-current");
    });
    showPage(Math.floor(i / PER));
  }

  // once the visitor browses, the neighbors are fetched too, so arrows feel instant
  const go = (n) => { i = (n + slides.length) % slides.length; paint(); hydrateAround(slides, i); };
  sc.querySelector(".nav.prev").addEventListener("click", () => go(i - 1));
  sc.querySelector(".nav.next").addEventListener("click", () => go(i + 1));
  thumbs.forEach((t, k) => {
    t.addEventListener("click", () => go(k));
    t.addEventListener("focus", () => { if (window.innerWidth > 860) showPage(Math.floor(k / PER)); });
  });
  // on phones the stage is hidden, so a chip opens its first example fullscreen
  jumps.forEach((b) => b.addEventListener("click", () => {
    const poster = window.innerWidth <= 860 && sc.querySelector(`.mthumb[data-i="${b.dataset.i}"]`);
    if (poster) poster.click(); else go(+b.dataset.i);
  }));
  up?.addEventListener("click", () => go(Math.max(0, (page - 1) * PER)));
  down?.addEventListener("click", () => go(Math.min(slides.length - 1, (page + 1) * PER)));
  // arrow keys browse while focus is on this showcase
  sc.tabIndex = -1;
  sc.addEventListener("keydown", (e) => {
    if (lightboxOpen()) return;
    if (e.key === "ArrowLeft") { go(i - 1); e.preventDefault(); }
    else if (e.key === "ArrowRight") { go(i + 1); e.preventDefault(); }
  });

  window.addEventListener("resize", () => { sizeRail(); paint(); });
  if (thumbs.length) {
    const img = thumbs[0].querySelector("img");
    if (img && !img.complete) img.addEventListener("load", () => { sizeRail(); paint(); });
  }
  sizeRail();
  paint();
  sc._go = go;
  sc._index = () => i;
});


// ---- fullscreen lightbox -------------------------------------------------
// On phones the poster grid replaces the stage: tapping a poster moves that
// example's real slide into a fullscreen overlay. On desktop, the Enlarge
// button (or clicking an image on the stage) does the same.
const lb = document.getElementById("lightbox");
if (lb) {
  const lbBody = lb.querySelector(".lb-body");
  let ctx = null; // { sc, stage, slides, i, opener }
  let inerted = [];

  const restore = () => {
    if (!ctx || !lbBody.firstChild) return;
    ctx.stage.insertBefore(lbBody.firstChild, ctx.stage.children[ctx.i] || null);
  };
  const show = (i) => {
    restore();
    ctx.i = (i + ctx.slides.length) % ctx.slides.length;
    hydrateAround(ctx.slides, ctx.i);
    lbBody.appendChild(ctx.slides[ctx.i]);
    lbBody.scrollTop = 0;
  };
  const open = (sc, i) => {
    if (ctx) restore(); // put back the slide on show before switching galleries
    const opener = ctx ? ctx.opener : document.activeElement;
    ctx = { sc, stage: sc.querySelector(".stage"), slides: [...sc.querySelectorAll(".slide")], i, opener };
    lb.classList.add("on");
    document.body.style.overflow = "hidden";
    // the overlay is modal: everything behind it leaves the tab order (once, not on re-open)
    if (!inerted.length) {
      inerted = [...document.body.children].filter((el) => el !== lb && el.tagName !== "SCRIPT" && !el.inert);
      inerted.forEach((el) => { el.inert = true; });
    }
    show(i);
    lb.querySelector(".lb-close").focus();
  };
  const close = () => {
    if (!ctx) return;
    restore();
    const { sc, i, opener } = ctx;
    ctx = null;
    lb.classList.remove("on");
    document.body.style.overflow = "";
    inerted.forEach((el) => { el.inert = false; });
    inerted = [];
    if (sc._go) sc._go(i); // the stage follows what was browsed in the lightbox
    // return focus to what opened the overlay, or to its stand-in for this example
    const visible = (el) => el && el !== document.body && el.isConnected && el.getClientRects().length > 0;
    const back = visible(opener) ? opener
      : window.innerWidth <= 860 ? sc.querySelector(`.mthumb[data-i="${i}"]`) : sc.querySelector(".enlarge");
    back?.focus({ preventScroll: true });
  };

  document.querySelectorAll(".showcase").forEach((sc) => {
    sc.querySelectorAll(".mthumb").forEach((t) =>
      t.addEventListener("click", () => open(sc, +t.dataset.i)));
    sc.querySelector(".enlarge")?.addEventListener("click", () => sc._index && open(sc, sc._index()));
    sc.querySelector(".stage")?.addEventListener("click", (e) => {
      if (e.target.closest(".gcell img") && sc._index) open(sc, sc._index());
    });
  });
  lb.querySelector(".lb-close").addEventListener("click", close);
  lb.querySelector(".lb-prev").addEventListener("click", () => ctx && show(ctx.i - 1));
  lb.querySelector(".lb-next").addEventListener("click", () => ctx && show(ctx.i + 1));
  document.addEventListener("keydown", (e) => {
    if (!lb.classList.contains("on")) return;
    if (e.key === "Escape") close();
    else if (e.key === "ArrowLeft") ctx && show(ctx.i - 1);
    else if (e.key === "ArrowRight") ctx && show(ctx.i + 1);
  });
}

/* ---------------- table of contents: scrollspy + progress + toggle ---------------- */
(function () {
  var toc = document.getElementById('toc');
  var bar = document.getElementById('progressbar');
  var btn = document.getElementById('tocbtn');
  if (!toc) return;
  var links = Array.prototype.slice.call(toc.querySelectorAll('a[href^="#"]'));
  var targets = links.map(function (a) {
    var el = document.getElementById(a.getAttribute('href').slice(1));
    return el ? { a: a, el: el } : null;
  }).filter(Boolean);
  var groups = Array.prototype.slice.call(toc.querySelectorAll('li.toc-group'));
  var ticking = false;

  function update() {
    ticking = false;
    var doc = document.documentElement;
    if (bar) {
      var prog = doc.scrollTop / Math.max(1, doc.scrollHeight - doc.clientHeight);
      bar.style.width = (prog * 100).toFixed(2) + '%';
    }
    var cur = null;
    for (var i = 0; i < targets.length; i++) {
      if (targets[i].el.getBoundingClientRect().top <= 140) cur = targets[i];
    }
    if (!cur) cur = targets[0];
    links.forEach(function (a) { a.classList.toggle('on', !!cur && a === cur.a); });
    groups.forEach(function (g) { g.classList.toggle('open', !!cur && g.contains(cur.a)); });
    var onLink = cur && toc.querySelector('a.on');
    if (onLink) {
      var lr = onLink.getBoundingClientRect(), tr = toc.getBoundingClientRect();
      if (lr.top < tr.top || lr.bottom > tr.bottom) {
        toc.scrollTop += lr.top - tr.top - tr.height / 2;
      }
    }
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  update();

  if (btn) {
    btn.addEventListener('click', function () {
      var open = document.body.classList.toggle('toc-open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    links.forEach(function (a) {
      a.addEventListener('click', function () {
        document.body.classList.remove('toc-open');
        btn.setAttribute('aria-expanded', 'false');
      });
    });
  }
})();

/* ---------------- collapsed supplementary items open when linked to ---------------- */
(function () {
  function openTarget(id) {
    var el = id && document.getElementById(id);
    if (el && el.tagName === 'DETAILS') el.open = true;
  }
  openTarget(decodeURIComponent(location.hash.slice(1)));
  window.addEventListener('hashchange', function () {
    openTarget(decodeURIComponent(location.hash.slice(1)));
  });
  document.querySelectorAll('a[href^="#supp-"]').forEach(function (a) {
    a.addEventListener('click', function () { openTarget(a.getAttribute('href').slice(1)); });
  });
})();

/* ---------------- swipe hint only on tables that actually overflow ---------------- */
(function () {
  var wraps = document.querySelectorAll('.tabwrap');
  function fit() {
    wraps.forEach(function (w) {
      w.classList.toggle('fits', w.scrollWidth <= w.clientWidth + 1);
    });
  }
  fit();
  window.addEventListener('resize', fit, { passive: true });
  document.querySelectorAll('details').forEach(function (d) { d.addEventListener('toggle', fit); });
})();

/* ---------------- gallery tabs: multi-turn / single-turn ---------------- */
(function () {
  document.querySelectorAll('.gtabs').forEach(function (bar) {
    var tabs = Array.prototype.slice.call(bar.querySelectorAll('[role="tab"]'));
    function select(t, focus) {
      tabs.forEach(function (x) {
        var on = x === t;
        x.setAttribute('aria-selected', on ? 'true' : 'false');
        x.tabIndex = on ? 0 : -1;
        document.getElementById(x.getAttribute('aria-controls')).hidden = !on;
      });
      if (focus) t.focus();
      // the rail of a newly shown carousel measures itself on resize
      window.dispatchEvent(new Event('resize'));
    }
    tabs.forEach(function (t, k) {
      t.addEventListener('click', function () { select(t, false); });
      t.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          var n = (k + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
          select(tabs[n], true);
          e.preventDefault();
        }
      });
    });
  });
})();

/* ---------------- story animations: final frame until seen, then play once ---------------- */
// Each .anim lists its steps in data-steps (seconds into its CSS loop, where each step is complete);
// the last step is the finished frame. A figure shows that frame until it first comes into view,
// then plays from the start once and stops on it. The controls pause / continue, step back and
// forth, and replay. On wide screens, figures inside one [data-anim-sync] block share one clock,
// so their beats line up; they start together once all of them are in view.
(function () {
  var figs = Array.prototype.slice.call(document.querySelectorAll('.anim'));
  if (!figs.length || !figs[0].getAnimations) return;   // no Web Animations API: the finished frames stay
  var root = document.documentElement;
  var motion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var narrow = window.matchMedia ? window.matchMedia('(max-width: 860px)') : { matches: false };
  var ICON = {
    prev: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3h2v10H3zM13 3v10L6 8z"/></svg>',
    next: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M11 3h2v10h-2zM3 3v10l7-5z"/></svg>',
    pause: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 3h3v10H4zM9 3h3v10H9z"/></svg>',
    play: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11L13 8z"/></svg>',
    replay: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.5a5.5 5.5 0 1 1-5.2 3.7l1.9.6A3.5 3.5 0 1 0 8 4.5V7L4.5 3.5 8 0z"/></svg>'
  };
  var LABEL = { playing: 'Pause', paused: 'Play', idle: 'Replay', ended: 'Replay' };
  var clocks = [];

  figs.forEach(function (f) {
    var g = narrow.matches ? null : f.closest('[data-anim-sync]');   // stacked on phones: one clock each
    var c = g && clocks.filter(function (k) { return k.group === g; })[0];
    if (!c) {
      var steps = (f.dataset.steps || '').split(/\s+/).filter(Boolean).map(Number);
      // idle: finished frame, not yet seen · playing · paused by the visitor · ended: back on the finished frame
      c = { group: g || f, figs: [], ctls: [], steps: steps, end: steps[steps.length - 1] || 0, mode: 'idle',
            shown: false };
      clocks.push(c);
    }
    c.figs.push(f);
  });

  // the figure's CSS animations only (not transitions, e.g. of the step dots)
  function anims(c) {
    return c.figs.reduce(function (all, f) {
      return all.concat(f.getAnimations({ subtree: true }).filter(function (a) { return a.animationName; }));
    }, []);
  }
  // seconds since the start, read from the first animation (they all share one duration per clock)
  function now(c) {
    var a = anims(c)[0];
    return a ? (a.currentTime || 0) / 1000 : 0;
  }
  // share of a figure on screen: 0 when off screen or in a background tab
  function visible(f) {
    if (document.hidden) return 0;
    var r = f.getBoundingClientRect();
    var shown = Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0);
    return r.height > 0 && shown > 0 ? shown / Math.min(r.height, window.innerHeight) : 0;
  }
  function paint(c) {
    var t = now(c), k = -1;
    c.steps.forEach(function (s, i) { if (s <= t + 0.05) k = i; });
    c.ctls.forEach(function (ctl) {
      if (ctl.mode !== c.mode) {   // redraw the icon only when it changes, so a press on it is never lost
        ctl.mode = c.mode;
        ctl.play.innerHTML = c.mode === 'playing' ? ICON.pause : c.mode === 'paused' ? ICON.play : ICON.replay;
        ctl.play.setAttribute('aria-label', LABEL[c.mode]);
      }
      ctl.dots.forEach(function (d, i) { d.classList.toggle('on', i <= k); });
    });
  }
  function run(c) {
    var go = c.mode === 'playing' && c.shown;
    c.figs.forEach(function (f) { f.classList.toggle('is-on', go); });
    anims(c).forEach(function (a) { if (go) a.play(); else a.pause(); });
    paint(c);
  }
  function seek(c, t, mode) {
    anims(c).forEach(function (a) { a.pause(); a.currentTime = t * 1000; });
    c.mode = mode;
    run(c);
  }
  function step(c, dir) {
    var t = now(c), s = c.steps;
    if (!s.length) return;
    if (dir > 0) {
      var to = s.filter(function (x) { return x > t + 0.05; })[0];
      if (to === undefined) to = s[0];   // past the end: back to the first step
      seek(c, to, to >= c.end ? 'ended' : 'paused');
    } else {
      var back = s.filter(function (x) { return x < t - 0.05; }).pop();
      seek(c, back === undefined ? 0 : back, 'paused');   // before the first step: the very start
    }
  }
  function toggle(c) {
    if (c.mode === 'playing') c.mode = 'paused';
    else if (c.mode === 'paused') c.mode = 'playing';
    else return seek(c, 0, 'playing');   // replay from the start
    run(c);
  }
  // every animation of a clock at the same time (also after a layout switch creates new ones)
  function align(c) {
    var t = Math.min(now(c), c.end);
    anims(c).forEach(function (a) { a.currentTime = t * 1000; });
    run(c);
  }
  // an idle figure starts once it is 35% in view (a synced group: all of it); a started one
  // pauses only when it has left the screen completely, so the controls work at its edges too
  function look(c) {
    var seen = c.figs.map(visible);
    var shown = seen.some(function (v) { return v > 0; });
    var ready = seen.every(function (v) { return v >= 0.35; });
    if (c.mode === 'idle') {
      if (ready) { c.shown = true; seek(c, 0, 'playing'); }
      else c.shown = shown;
      return;
    }
    if (shown !== c.shown) { c.shown = shown; run(c); }
  }

  function start() {
    root.classList.add('anim-js');   // switches the CSS animations on
    clocks.forEach(function (c) {
      c.mode = 'idle'; c.shown = false;
      seek(c, c.end, 'idle');
      look(c);   // already in view (the hero): from the start right away
    });
  }
  clocks.forEach(function (c) {
    c.figs.forEach(function (f) {
      var bar = document.createElement('div');
      bar.className = 'anim-ctl';
      bar.innerHTML = '<span class="ac-dots" aria-hidden="true">' + c.steps.map(function () { return '<i></i>'; }).join('') + '</span>'
        + '<button type="button" class="ac-prev" aria-label="Previous step">' + ICON.prev + '</button>'
        + '<button type="button" class="ac-play" aria-label="Replay">' + ICON.replay + '</button>'
        + '<button type="button" class="ac-next" aria-label="Next step">' + ICON.next + '</button>';
      f.appendChild(bar);
      var ctl = { play: bar.querySelector('.ac-play'), dots: Array.prototype.slice.call(bar.querySelectorAll('.ac-dots i')), mode: 'idle' };
      c.ctls.push(ctl);
      bar.querySelector('.ac-prev').addEventListener('click', function () { step(c, -1); });
      bar.querySelector('.ac-next').addEventListener('click', function () { step(c, 1); });
      ctl.play.addEventListener('click', function () { toggle(c); });
    });
  });
  // reduced motion: the finished frames only, no controls (also when the setting changes later)
  function applyMotion() {
    if (motion.matches) root.classList.remove('anim-js');
    else start();
  }
  if (motion.addEventListener) motion.addEventListener('change', applyMotion);
  applyMotion();

  // every 100 ms: follow the viewport, stop on the finished frame, move the step dots along
  setInterval(function () {
    if (motion.matches) return;
    clocks.forEach(function (c) {
      look(c);
      if (c.mode !== 'playing' || !c.shown) return;
      if (now(c) >= c.end) seek(c, c.end, 'ended');
      else paint(c);
    });
  }, 100);
  // the architecture swaps its chain panel at 860px: line the new animations up at once
  if (narrow.addEventListener) narrow.addEventListener('change', function () { clocks.forEach(align); });
  var rt;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () { clocks.forEach(align); }, 150);
  });
})();

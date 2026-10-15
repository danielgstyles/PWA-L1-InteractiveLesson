(function () {
  "use strict";

  var STORE_PREFIX = "fa5p2-";

  // ---------------------------------------------------------------- storage
  function saveStore(key, value) {
    try { localStorage.setItem(STORE_PREFIX + key, JSON.stringify(value)); } catch (e) { /* ignore */ }
  }
  function loadStore(key) {
    try {
      var v = localStorage.getItem(STORE_PREFIX + key);
      return v === null ? null : JSON.parse(v);
    } catch (e) { return null; }
  }
  function clearAllStore() {
    try {
      var toRemove = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf(STORE_PREFIX) === 0) toRemove.push(k);
      }
      toRemove.forEach(function (k) { localStorage.removeItem(k); });
    } catch (e) { /* ignore */ }
  }

  // ------------------------------------------------------- text/number inputs
  function wireTextInputs() {
    document.querySelectorAll("[data-store]").forEach(function (el) {
      if (el.type === "checkbox") return; // handled separately
      var key = el.getAttribute("data-store");
      var saved = loadStore(key);
      if (saved !== null) el.value = saved;
      el.addEventListener("input", function () { saveStore(key, el.value); });
    });
    document.querySelectorAll('input[type="checkbox"][data-store]').forEach(function (el) {
      var key = el.getAttribute("data-store");
      var saved = loadStore(key);
      if (saved !== null) el.checked = !!saved;
      el.addEventListener("change", function () { saveStore(key, el.checked); });
    });
  }

  // ------------------------------------------------------------ reveal buttons
  // A button with data-needs="<field id>" stays disabled until the student
  // has written something in that field, so the model answer is always a
  // comparison with their own attempt, never a substitute for one.
  var MIN_ATTEMPT_CHARS = 8;
  function wireRevealButtons() {
    document.querySelectorAll("[data-reveal]").forEach(function (btn) {
      var targetId = btn.getAttribute("data-reveal");
      var stateKey = "revealed-" + targetId;
      var target = document.getElementById(targetId);
      if (!target) return;
      if (loadStore(stateKey)) { target.hidden = false; btn.textContent = "Model answer shown below"; btn.disabled = true; return; }
      var needs = btn.getAttribute("data-needs");
      var field = needs ? document.getElementById(needs) : null;
      if (field) {
        var idleLabel = btn.textContent;
        var syncGate = function () {
          var ready = field.value.trim().length >= MIN_ATTEMPT_CHARS;
          btn.disabled = !ready;
          btn.textContent = ready ? idleLabel : "Write your answer first, then compare";
        };
        field.addEventListener("input", syncGate);
        syncGate();
      }
      btn.addEventListener("click", function () {
        target.hidden = false;
        btn.textContent = "Model answer shown below";
        btn.disabled = true;
        saveStore(stateKey, true);
      });
    });
  }

  // ------------------------------------------------------------- single-select
  function shuffleChildren(container, selector) {
    var items = Array.prototype.slice.call(container.querySelectorAll(selector));
    for (var i = items.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = items[i]; items[i] = items[j]; items[j] = tmp;
    }
    items.forEach(function (el) { container.appendChild(el); }); // appendChild on an existing node moves it
  }

  function wireSingleSelects() {
    document.querySelectorAll(".single-select").forEach(function (block) {
      // Randomise option order on every load — otherwise the correct answer
      // sitting in the same position every time turns a check into a
      // position-memorisation exercise instead of a real check.
      shuffleChildren(block, "button");
      var id = block.id;
      var correct = block.getAttribute("data-correct");
      var feedback = id ? document.getElementById(id + "-feedback") : null;
      var stateKey = "single-" + (id || Math.random());

      function applyAnswer(value) {
        block.classList.add("answered");
        block.querySelectorAll("button").forEach(function (b) {
          b.disabled = true;
          if (b.getAttribute("data-value") === correct) b.classList.add("correct");
          else if (b.getAttribute("data-value") === value) b.classList.add("incorrect");
        });
        if (feedback) {
          feedback.hidden = false;
          if (value === correct) {
            feedback.textContent = "Correct.";
            feedback.className = "feedback correct";
          } else {
            feedback.textContent = "Not quite — the highlighted option is correct.";
            feedback.className = "feedback incorrect";
          }
        }
      }

      var saved = loadStore(stateKey);
      if (saved) applyAnswer(saved);

      block.querySelectorAll("button").forEach(function (btn) {
        btn.addEventListener("click", function () {
          if (block.classList.contains("answered")) return;
          var value = btn.getAttribute("data-value");
          saveStore(stateKey, value);
          applyAnswer(value);
        });
      });
    });
  }

  // ---------------------------------------------------------------- speech
  // Both speech paths (the page-aloud buttons and the section narration) build
  // utterances here, so they always pick the same voice. Without an explicit
  // lang the browser falls back to its own default — which is how the narration
  // ended up in a different voice from the read-aloud buttons.
  var SPEECH_LANG = "en-AU";
  var SPEECH_RATE = 0.95;   // one rate for both paths, so they sound alike
  var pinnedVoice = null;

  // Resolving the voice ourselves — rather than leaving it to the browser's
  // per-utterance default — is what actually guarantees the narration and the
  // page-aloud buttons are the same speaker. getVoices() is often empty on
  // first call (voices load asynchronously), so this resolves lazily and
  // caches, and falls back to the browser default if nothing matches.
  function preferredVoice() {
    if (pinnedVoice) return pinnedVoice;
    if (!("speechSynthesis" in window)) return null;
    var voices = window.speechSynthesis.getVoices() || [];
    if (!voices.length) return null;   // try again on the next utterance
    function pick(test) {
      for (var i = 0; i < voices.length; i++) if (test(voices[i])) return voices[i];
      return null;
    }
    pinnedVoice =
      pick(function (v) { return v.lang === SPEECH_LANG && v.default; }) ||
      pick(function (v) { return v.lang === SPEECH_LANG; }) ||
      pick(function (v) { return (v.lang || "").indexOf("en-AU") === 0; }) ||
      pick(function (v) { return (v.lang || "").indexOf("en") === 0 && v.default; }) ||
      pick(function (v) { return (v.lang || "").indexOf("en") === 0; });
    return pinnedVoice;
  }
  if ("speechSynthesis" in window && typeof window.speechSynthesis.addEventListener === "function") {
    window.speechSynthesis.addEventListener("voiceschanged", function () { pinnedVoice = null; preferredVoice(); });
  }

  function makeUtterance(text, rate) {
    var u = new SpeechSynthesisUtterance(text);
    u.lang = SPEECH_LANG;
    u.rate = (typeof rate === "number") ? rate : SPEECH_RATE;
    var v = preferredVoice();
    if (v) u.voice = v;
    return u;
  }

  // ------------------------------------------------------------ text-to-speech
  // Reads teaching content aloud via the browser's built-in speech synthesis
  // — no external service, works offline, and never touches .model-answer/
  // .feedback content, so it can't be used to skip a reveal gate (in
  // particular the protected Q12(b) commit-then-reveal).
  var TTS_READABLE_SELECTOR = [
    "h2", "h3", "p", "blockquote", ".mini-card", ".sc-box",
    ".takeaway", "table.glossary"
  ].join(",");
  var ttsCurrentBtn = null;

  // Checks the actual hidden mechanisms this page uses (a gated reveal, an
  // unopened hotspot note, a collapsed <details> fallback) rather than a
  // layout-based visibility check — buildTextToSpeech() runs once at page
  // load, while every section except the active one is still display:none,
  // so an offsetWidth/offsetHeight check would (and initially did) read
  // everything on the page as "invisible" and silently collect nothing.
  function isGatedOrCollapsed(el, withRevealables) {
    if (withRevealables && (el.classList.contains("hotspot-note") || el.classList.contains("video-fallback"))) {
      return !!el.closest(".model-answer, .feedback");
    }
    return !!el.closest(".model-answer, .feedback, .script, [hidden], details:not([open])");
  }

  // Actual readable text for an element — a manual tree-walk that inserts a
  // break after every block-level child and after <br>, rather than relying
  // on rendered layout (innerText) or plain concatenation (textContent,
  // which would run a card's heading straight into its body text with no
  // separator at all: "A room" + "Setpoint: 21 °C" → "A roomSetpoint: 21
  // °C"). Deliberately layout-independent — the work-summary builder needs
  // this to work on every section, not just the one currently visible, and
  // an innerText-based version would silently read empty for anything
  // display:none at the time (which is every section except the active one).
  var TTS_BLOCK_TAGS = { H1: 1, H2: 1, H3: 1, H4: 1, P: 1, DIV: 1, LI: 1, BLOCKQUOTE: 1, TR: 1 };
  function readableTextOf(el) {
    var out = [];
    (function walk(node) {
      if (node.nodeType === 3) { out.push(node.textContent); return; }
      if (node.nodeType !== 1) return;
      if (node.tagName === "BR") { out.push("\n"); return; }
      Array.prototype.forEach.call(node.childNodes, walk);
      if (TTS_BLOCK_TAGS[node.tagName]) out.push("\n");
    })(el);
    // strips a block's own leading "🔊"/"⏹" read-aloud button, present once
    // this module has inserted one into it, so re-reading a block's text
    // live never speaks/writes the button's own glyph as part of the content
    // (🔊|⏹) as alternation, not a [🔊⏹] character class — 🔊 is a surrogate
    // pair (outside the BMP), and a character class without the /u flag
    // matches individual UTF-16 code units, silently splitting it into two
    // orphaned halves and leaving a stray "�" behind instead of stripping it.
    // Join the block's lines with sentence punctuation, but don't add a
    // second full stop to a line that already ends in one — a blanket
    // /\n+/ → ". " replacement produced "…how each part behaves.." and
    // "…runs only once?." at every block boundary, and a "\n \n" run (a
    // newline, whitespace text node, newline) produced a stray ". . ".
    var parts = out.join("").split("\n").map(function (s) {
      return s.replace(/[ \t]+/g, " ").trim();
    }).filter(Boolean);
    var text = "";
    parts.forEach(function (p) {
      if (!text) { text = p; return; }
      text += (/[.!?:;,]$/.test(text) ? " " : ". ") + p;
    });
    return text.replace(/^(🔊|⏹)\s*\.?\s*/, "").trim();
  }

  // Layout-independent existence check — used only to decide, at setup
  // time (while most sections are still display:none), which elements have
  // real content worth giving a button to. innerText would read empty for
  // every hidden section, which is exactly the bug this avoids.
  function hasReadableText(el) {
    return !!el.textContent.replace(/\s+/g, " ").trim();
  }

  // Every distinct readable chunk in a section, in document order, with
  // nested duplicates removed (e.g. a card's own heading isn't returned
  // separately from the card's full text) and gated content excluded.
  function collectReadableBlocks(section, withRevealables) {
    var seen = [];
    section.querySelectorAll(TTS_READABLE_SELECTOR).forEach(function (el) {
      if (isGatedOrCollapsed(el, withRevealables)) return;
      if (seen.some(function (s) { return s.contains(el) || el.contains(s); })) return;
      if (hasReadableText(el)) seen.push(el);
    });
    return seen;
  }

  // Every narration run takes a token. Cancelling speech fires end/error events on
  // the utterance that was cut off; without the token those events would queue the
  // NEXT clause and the voice would carry on after Stop, Back/Next or a section change.
  // Bumping the token makes every event from an older run do nothing.
  var narrToken = 0;
  var narrStops = [];      // each Teach beat registers a function that resets its own buttons

  function stopSpeech() {
    narrToken++;
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    narrStops.forEach(function (fn) { fn(); });
    if (ttsCurrentBtn) {
      ttsCurrentBtn.textContent = ttsCurrentBtn.getAttribute("data-idle-label");
      ttsCurrentBtn.classList.remove("speaking");
    }
    ttsCurrentBtn = null;
  }

  // textFn is called AFTER stopSpeech() resets any other currently-speaking
  // button back to its idle label — text is a lazy function, not a
  // pre-computed string, specifically so that reset happens first. Reading
  // it before stopSpeech() ran (the original bug here) could pick up
  // another button's live "⏹" glyph if that button's container text is
  // itself part of what's being read (e.g. reading a whole section while
  // one of its own card buttons is still mid-speech).
  function speakWith(btn, idleLabel, textFn) {
    if (ttsCurrentBtn === btn) { stopSpeech(); return; }
    stopSpeech();
    var text = typeof textFn === "function" ? textFn() : textFn;
    if (!text) return;
    var utter = makeUtterance(text);
    utter.onend = function () { if (ttsCurrentBtn === btn) stopSpeech(); };
    utter.onerror = function () { if (ttsCurrentBtn === btn) stopSpeech(); };
    ttsCurrentBtn = btn;
    btn.setAttribute("data-idle-label", idleLabel);
    btn.textContent = "⏹";
    btn.classList.add("speaking");
    window.speechSynthesis.speak(utter);
  }

  function buildTextToSpeech() {
    if (!("speechSynthesis" in window)) return; // feature not available — no buttons added
    document.querySelectorAll(".site-section").forEach(function (section) {
      var sectionBtn = document.createElement("button");
      sectionBtn.type = "button";
      sectionBtn.className = "tts-btn";
      sectionBtn.setAttribute("data-idle-label", "🔊 Read this whole page aloud");
      sectionBtn.textContent = "🔊 Read this whole page aloud";
      section.insertBefore(sectionBtn, section.firstChild);
      sectionBtn.addEventListener("click", function () {
        speakWith(sectionBtn, "🔊 Read this whole page aloud", function () {
          // Recomputed live (not cached from setup) so content revealed
          // after page load — e.g. a Section 3 hotspot note the student has
          // since clicked open — is picked up correctly, and so any other
          // button's label has already been reset back to idle by the
          // stopSpeech() that ran just before this function is called.
          var blocks = collectReadableBlocks(section).filter(function (el) { return el.tagName !== "H2"; });
          return blocks.map(readableTextOf).join(". ");
        });
      });

      // One small per-block button each, so a student can replay just one
      // card or paragraph instead of sitting through the whole section again.
      // Decided once at setup time, from what's collectible right now — a
      // hotspot note that's still closed at this point won't get its own
      // dedicated button, but the whole-page button above still reads it
      // once it's opened, via the live recompute.
      collectReadableBlocks(section).filter(function (el) { return el.tagName !== "H2"; }).forEach(function (block) {
        var blockBtn = document.createElement("button");
        blockBtn.type = "button";
        blockBtn.className = "tts-block-btn";
        blockBtn.setAttribute("data-idle-label", "🔊");
        blockBtn.textContent = "🔊";
        blockBtn.setAttribute("aria-label", "Read this part aloud");
        blockBtn.title = "Read this part aloud";
        block.insertBefore(blockBtn, block.firstChild);
        blockBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          speakWith(blockBtn, "🔊", function () { return readableTextOf(block); });
        });
      });
    });
  }

  // --------------------------------------------------------------- navigation
  // Derived from the DOM rather than hardcoded. The Lesson 9 original listed its
  // eleven section ids literally, which silently produced six dead nav entries
  // when this page (five sections) reused the code.
  var SECTION_IDS = Array.prototype.slice
    .call(document.querySelectorAll(".site-section"))
    .map(function (s) { return s.id; });

  function goToSection(id) {
    stopSpeech();
    SECTION_IDS.forEach(function (sid) {
      var el = document.getElementById(sid);
      if (el) el.classList.toggle("active", sid === id);
    });
    updateNav(id);
    saveStore("current-section", id);
    if (id === "sec-5" && window.__refreshSummary) window.__refreshSummary();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateNav(activeId) {
    var visited = loadStore("visited-sections") || [];
    if (visited.indexOf(activeId) === -1) {
      visited.push(activeId);
      saveStore("visited-sections", visited);
    }
    document.querySelectorAll("#nav-list button").forEach(function (btn) {
      var sid = btn.getAttribute("data-nav");
      btn.classList.toggle("active", sid === activeId);
      btn.classList.toggle("visited", visited.indexOf(sid) !== -1);
    });
    var idx = SECTION_IDS.indexOf(activeId);
    var pct = SECTION_IDS.length <= 1 ? 100 : (idx / (SECTION_IDS.length - 1)) * 100;
    var fill = document.getElementById("progress-fill");
    if (fill) fill.style.width = pct + "%";
  }

  function buildNav() {
    var navList = document.getElementById("nav-list");
    SECTION_IDS.forEach(function (sid, i) {
      var section = document.getElementById(sid);
      var li = document.createElement("li");
      var btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("data-nav", sid);
      btn.textContent = (i + 1) + ". " + (section ? section.getAttribute("data-title") : sid);
      btn.addEventListener("click", function () { goToSection(sid); });
      li.appendChild(btn);
      navList.appendChild(li);
    });
  }

  function wireNextButtons() {
    document.querySelectorAll("[data-next]").forEach(function (btn) {
      btn.addEventListener("click", function () { goToSection(btn.getAttribute("data-next")); });
    });
  }

  function wireReset() {
    var btn = document.getElementById("reset-btn");
    btn.addEventListener("click", function () {
      if (window.confirm("Reset all your answers and progress on this page? This can't be undone.")) {
        clearAllStore();
        window.location.reload();
      }
    });
  }


  // ---------------------------------------- Section 1: animated route diagram
  // (The old step-through "route walker" was removed: it only re-read the narration.)
  // The animated diagram plays once when it scrolls into view, and again on demand.
  function buildRouteAnim() {
    var fig = document.getElementById("route-anim");
    if (!fig) return;
    var btn = document.getElementById("route-replay");
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { if (btn) btn.hidden = true; return; }   // leave the finished picture showing
    function play() { fig.classList.remove("play"); void fig.getBoundingClientRect(); fig.classList.add("play"); }
    if (btn) btn.addEventListener("click", play);
    if ("IntersectionObserver" in window) {
      var started = false;
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting && !started) { started = true; play(); } });
      }, { threshold: 0.6 }).observe(fig);
    } else {
      play();
    }
  }

  // ------------------------------------------------------ accessibility helpers
  // Screen readers announce changes to feedback, the unlock message and the diagram
  // caption without the student having to hunt for them.
  function wireLiveRegions() {
    document.querySelectorAll(".feedback, .lock-msg, .chain-caption").forEach(function (el) {
      el.setAttribute("aria-live", "polite");
    });
  }

  // ------------------------------------------- Sections 3/5: place-value tables
  var PV_COLS = [128, 64, 32, 16, 8, 4, 2, 1];
  function wirePlaceValueTables() {
    document.querySelectorAll(".pv-exercise").forEach(function (block) {
      var target = parseInt(block.getAttribute("data-target"), 10);
      var btn = block.querySelector(".pv-check");
      var feedback = block.querySelector(".feedback");
      var inputs = Array.prototype.slice.call(block.querySelectorAll("input"));
      if (!btn || !feedback || inputs.length !== 8) return;

      btn.addEventListener("click", function () {
        var bits = inputs.map(function (inp) { return (inp.value || "").trim(); });
        feedback.hidden = false;

        var bad = bits.filter(function (b) { return b !== "0" && b !== "1"; });
        if (bad.length) {
          feedback.textContent = "Every column needs a 1 or a 0 — " + bad.length + " still to fill in.";
          feedback.className = "feedback incorrect";
          return;
        }
        var sum = 0;
        bits.forEach(function (b, idx) { if (b === "1") sum += PV_COLS[idx]; });

        inputs.forEach(function (inp) { inp.classList.remove("cell-ok", "cell-bad"); });

        if (sum === target) {
          inputs.forEach(function (inp) { inp.classList.add("cell-ok"); });
          feedback.textContent = "Correct — those columns add to " + target + ".";
          feedback.className = "feedback correct";
        } else {
          // Mark only the columns that are actually wrong, so the student can see where.
          var want = [], remain = target;
          PV_COLS.forEach(function (c) {
            if (remain >= c) { want.push("1"); remain -= c; } else { want.push("0"); }
          });
          bits.forEach(function (b, idx) {
            inputs[idx].classList.add(b === want[idx] ? "cell-ok" : "cell-bad");
          });
          feedback.textContent = "Your columns add to " + sum + ", not " + target +
            ". The highlighted cells are the ones to change — work left to right, taking the biggest value that still fits.";
          feedback.className = "feedback incorrect";
        }
      });
    });
  }

  // ---------------------------------------- Section 1: echo the opening guess
  function wireHookEcho() {
    var field = document.getElementById("q-hook");
    var echo = document.getElementById("hook-echo");
    if (!field || !echo) return;
    function render() {
      var guess = field.value.trim();
      echo.textContent = guess
        ? "\u201C" + guess + "\u201D"
        : "You didn't write a guess at the start. That's fine, but next time commit to one first: it makes the answer stick.";
      echo.classList.toggle("empty", !guess);
    }
    field.addEventListener("input", render);
    render();
  }

  // ------------------------------ Section 3: step-by-step hints (faded example)
  function wireHintSteps() {
    document.querySelectorAll(".hint-steps").forEach(function (wrap) {
      var items = Array.prototype.slice.call(wrap.querySelectorAll("li"));
      var btn = wrap.querySelector(".hint-next");
      var key = "hints-" + wrap.id;
      var shown = loadStore(key) || 0;
      function render() {
        items.forEach(function (li, i) { li.hidden = i >= shown; });
        btn.disabled = shown >= items.length;
        btn.textContent = shown === 0 ? "Show the first step"
          : (shown >= items.length ? "That's every column" : "Show the next step");
      }
      btn.addEventListener("click", function () {
        if (shown < items.length) { shown++; saveStore(key, shown); render(); }
      });
      render();
    });
  }

  // --------------------------------------- Section 3: binary -> decimal check
  function wireBinToDec() {
    document.querySelectorAll(".bd-exercise").forEach(function (block) {
      var answer = parseInt(block.getAttribute("data-answer"), 10);
      var input = block.querySelector("input");
      var btn = block.querySelector(".bd-check");
      var feedback = block.querySelector(".feedback");
      var bits = Array.prototype.slice.call(block.querySelectorAll("tbody td")).map(function (td) { return td.textContent.trim(); });
      btn.addEventListener("click", function () {
        var raw = (input.value || "").trim();
        feedback.hidden = false;
        if (!/^\d+$/.test(raw)) {
          feedback.textContent = "Type a whole number.";
          feedback.className = "feedback incorrect";
          return;
        }
        if (parseInt(raw, 10) === answer) {
          var parts = PV_COLS.filter(function (c, i) { return bits[i] === "1"; });
          feedback.textContent = "Correct \u2014 " + parts.join(" + ") + " = " + answer + ".";
          feedback.className = "feedback correct";
        } else {
          feedback.textContent = "Not quite. Add up the place values of only the columns with a 1 in them.";
          feedback.className = "feedback incorrect";
        }
      });
    });
  }

  // --------------------------------------------- Section 3: valid/invalid IPs
  var IP_ITEMS = [
    { id: "a", text: "10.0.0.1",        valid: true,  why: "Four octets, all between 0 and 255." },
    { id: "b", text: "192.168.0.256",   valid: false, why: "256 is out of range — an octet stops at 255." },
    { id: "c", text: "172.16.254.1",    valid: true,  why: "Four octets, all in range." },
    { id: "d", text: "256.1.1.1",       valid: false, why: "The first octet is out of range." },
    { id: "e", text: "192.168.1",       valid: false, why: "Only three octets — IPv4 needs exactly four." },
    { id: "f", text: "0.0.0.0",         valid: true,  why: "Unusual, but every octet is in range, so the format is valid." }
  ];
  function buildIpSorter() {
    var wrap = document.getElementById("ip-sorter");
    if (!wrap) return;
    var feedback = document.getElementById("ip-sorter-feedback");

    IP_ITEMS.forEach(function (item) {
      var row = document.createElement("div");
      row.className = "sorter-row";
      var label = document.createElement("code");
      label.className = "sorter-label";
      label.textContent = item.text;
      row.appendChild(label);

      ["valid", "invalid"].forEach(function (choice) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "sorter-btn";
        b.textContent = (choice === "valid") ? "Valid" : "Not valid";
        b.setAttribute("data-choice", choice);
        b.addEventListener("click", function () { answer(item, row, choice); });
        row.appendChild(b);
      });

      var note = document.createElement("p");
      note.className = "sorter-why";
      note.hidden = true;
      row.appendChild(note);
      wrap.appendChild(row);

      var saved = loadStore("ip-" + item.id);
      if (saved) answer(item, row, saved, true);
    });

    function answer(item, row, choice, restoring) {
      var correct = (choice === "valid") === item.valid;
      row.classList.add("answered");
      row.querySelectorAll(".sorter-btn").forEach(function (b) {
        b.disabled = true;
        if (b.getAttribute("data-choice") === choice) {
          b.classList.add(correct ? "correct" : "incorrect");
        }
      });
      var note = row.querySelector(".sorter-why");
      note.hidden = false;
      note.textContent = (correct ? "Yes — " : "Not quite. ") + item.why;
      note.className = "sorter-why " + (correct ? "ok" : "bad");
      if (!restoring) saveStore("ip-" + item.id, choice);
      tally();
    }

    function tally() {
      var done = 0, right = 0;
      IP_ITEMS.forEach(function (item) {
        var v = loadStore("ip-" + item.id);
        if (v) { done++; if ((v === "valid") === item.valid) right++; }
      });
      if (done === 0) return;
      feedback.hidden = false;
      feedback.textContent = right + " of " + done + " sorted correctly" +
        (done < IP_ITEMS.length ? " (" + (IP_ITEMS.length - done) + " to go)." : ".");
      feedback.className = "feedback " + (right === IP_ITEMS.length ? "correct" : "");
    }
  }

  // ------------------------------------------------ Section 4: DNS step order
  var DNS_STEPS = [
    { id: "s1",  text: "User input — you type the domain name into the browser" },
    { id: "s2",  text: "DNS lookup — the browser queries a DNS resolver" },
    { id: "s3",  text: "DNS resolver — the resolver checks its cache first" },
    { id: "s4",  text: "Recursive query — the resolver goes looking, starting at the root servers" },
    { id: "s5",  text: "Top-level domain server — root directs it to the .com server" },
    { id: "s6",  text: "Authoritative name server — the server holding the real record is asked" },
    { id: "s7",  text: "Response — that server returns the IP address" },
    { id: "s8",  text: "Cache update — the resolver stores the answer for next time" },
    { id: "s9",  text: "Browser request — the browser requests the page from that IP address" },
    { id: "s10", text: "Website access — the server responds and the page loads" }
  ];
  function buildDnsOrder() {
    var list = document.getElementById("dns-order");
    if (!list) return;
    var feedback = document.getElementById("dns-order-feedback");
    var checkBtn = document.getElementById("dns-check");
    var shuffleBtn = document.getElementById("dns-shuffle");
    var dragging = null;

    function currentOrder() {
      return Array.prototype.slice.call(list.children).map(function (li) { return li.getAttribute("data-id"); });
    }

    function render(order) {
      list.innerHTML = "";
      order.forEach(function (id) {
        var step = DNS_STEPS.filter(function (s) { return s.id === id; })[0];
        if (!step) return;
        var li = document.createElement("li");
        li.className = "order-item";
        li.setAttribute("data-id", step.id);

        var grip = document.createElement("span");
        grip.className = "order-grip";
        grip.setAttribute("aria-hidden", "true");
        grip.textContent = "⠿";
        li.appendChild(grip);

        var txt = document.createElement("span");
        txt.className = "order-text";
        txt.textContent = step.text;
        li.appendChild(txt);

        // Arrow buttons: dragging is fiddly on a trackpad and impossible on some
        // touch setups, so every drag action has a keyboard/click equivalent.
        var up = document.createElement("button");
        up.type = "button"; up.className = "order-move"; up.textContent = "↑";
        up.setAttribute("aria-label", "Move up: " + step.text);
        up.addEventListener("click", function () { move(li, -1); });

        var down = document.createElement("button");
        down.type = "button"; down.className = "order-move"; down.textContent = "↓";
        down.setAttribute("aria-label", "Move down: " + step.text);
        down.addEventListener("click", function () { move(li, 1); });

        li.appendChild(up); li.appendChild(down);

        // Drag and drop uses pointer events, not the browser's built-in drag API: that
        // API does not work on touch screens and is unreliable on some trackpads.
        // A mouse or pen can grab anywhere on the row; a finger must use the grip
        // (the dotted handle), so the rest of the row still lets the page scroll.
        // Movement is followed on the document, because moving the row in the list
        // makes the browser drop pointer capture from it.
        li.addEventListener("pointerdown", function (e) {
          if (e.button && e.button !== 0) return;
          if (e.target.closest("button")) return;
          if (e.pointerType === "touch" && !e.target.closest(".order-grip")) return;
          dragging = li; li.classList.add("dragging");
          document.addEventListener("pointermove", onDragMove);
          document.addEventListener("pointerup", onDragEnd);
          document.addEventListener("pointercancel", onDragEnd);
          e.preventDefault();
        });

        list.appendChild(li);
      });
      renumber();
    }

    function onDragMove(e) {
      if (!dragging) return;
      var items = Array.prototype.slice.call(list.children);
      var from = items.indexOf(dragging);
      for (var k = 0; k < items.length; k++) {
        if (k === from) continue;
        var r = items[k].getBoundingClientRect();
        if (e.clientY < r.top || e.clientY > r.bottom) continue;
        var mid = r.top + r.height / 2;
        if (k > from && e.clientY > mid) list.insertBefore(dragging, items[k].nextSibling);
        else if (k < from && e.clientY < mid) list.insertBefore(dragging, items[k]);
        renumber();
        break;
      }
      // scroll the page when dragging close to the top or bottom edge
      if (e.clientY < 70) window.scrollBy(0, -14);
      else if (e.clientY > window.innerHeight - 70) window.scrollBy(0, 14);
    }
    function onDragEnd() {
      document.removeEventListener("pointermove", onDragMove);
      document.removeEventListener("pointerup", onDragEnd);
      document.removeEventListener("pointercancel", onDragEnd);
      if (!dragging) return;
      dragging.classList.remove("dragging"); dragging = null;
      renumber(); persist();
    }

    function move(li, delta) {
      var items = Array.prototype.slice.call(list.children);
      var idx = items.indexOf(li);
      var target = idx + delta;
      if (target < 0 || target >= items.length) return;
      if (delta < 0) list.insertBefore(li, items[target]);
      else list.insertBefore(items[target], li);
      renumber(); persist();
    }

    function renumber() {
      Array.prototype.slice.call(list.children).forEach(function (li, i) {
        li.style.setProperty("--n", '"' + (i + 1) + '"');
        li.setAttribute("data-pos", i + 1);
      });
    }

    function persist() { saveStore("dns-order", currentOrder()); }

    function shuffled() {
      var ids = DNS_STEPS.map(function (s) { return s.id; });
      for (var i = ids.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = ids[i]; ids[i] = ids[j]; ids[j] = t;
      }
      // Guard against shuffling into the correct order, which would make the
      // exercise a no-op for whoever got lucky.
      if (ids.join() === DNS_STEPS.map(function (s) { return s.id; }).join()) return shuffled();
      return ids;
    }

    // The ten steps in order, shown in Consolidate. It stays hidden until the
    // exercise is finished, or the student asks to be shown, so it can't be read
    // off while ordering. Steps 4 to 8 are shaded: they are what a cache hit skips.
    var refBox = document.getElementById("dns-ref"), refList = document.getElementById("dns-ref-list");
    var showBtn = document.getElementById("dns-show");
    var failedChecks = 0;
    if (refList && !refList.children.length) {
      DNS_STEPS.forEach(function (s, i) {
        var li = document.createElement("li");
        var parts = s.text.split(" — ");
        var b = document.createElement("b"); b.textContent = parts[0];
        li.appendChild(b);
        li.appendChild(document.createTextNode(parts[1] ? " — " + parts[1] : ""));
        if (i >= 3 && i <= 7) li.className = "skipped";
        refList.appendChild(li);
      });
    }
    function revealRef() { if (refBox) refBox.hidden = false; }
    if (loadStore("dns-order-correct")) revealRef();
    if (showBtn) {
      showBtn.addEventListener("click", function () {
        render(DNS_STEPS.map(function (s) { return s.id; }));
        list.querySelectorAll(".order-item").forEach(function (li) { li.classList.add("pos-ok"); });
        feedback.hidden = false;
        feedback.textContent = "That is the correct order. Read it through, then press “Shuffle again” and try it from memory.";
        feedback.className = "feedback";
        revealRef();
        persist();
      });
    }

    // Remember that the student has attempted the ordering (the gate on the summary needs it).
    function markChecked() { list.setAttribute("data-checked", "1"); saveStore("dns-order-checked", true); }
    if (loadStore("dns-order-checked")) list.setAttribute("data-checked", "1");

    checkBtn.addEventListener("click", function () {
      markChecked();
      var order = currentOrder();
      var correctOrder = DNS_STEPS.map(function (s) { return s.id; });
      var firstWrong = -1, rightCount = 0;
      order.forEach(function (id, i) {
        var ok = (id === correctOrder[i]);
        if (ok) rightCount++;
        else if (firstWrong === -1) firstWrong = i;
        list.children[i].classList.remove("pos-ok", "pos-bad");
        list.children[i].classList.add(ok ? "pos-ok" : "pos-bad");
      });
      feedback.hidden = false;
      if (rightCount === correctOrder.length) {
        feedback.textContent = "All ten in the right order.";
        feedback.className = "feedback correct";
        saveStore("dns-order-correct", true);
        revealRef();
      } else {
        failedChecks++;
        if (showBtn && failedChecks >= 2) showBtn.hidden = false;   // a way out for a student working alone
        feedback.textContent = rightCount + " of 10 in the right position. The first one out of place is at position " +
          (firstWrong + 1) + " — think about what has to have happened before that step could run.";
        feedback.className = "feedback incorrect";
      }
      persist();
    });

    shuffleBtn.addEventListener("click", function () {
      render(shuffled());
      feedback.hidden = true;
      saveStore("dns-order-correct", false);
      persist();
    });

    var saved = loadStore("dns-order");
    var valid = saved && saved.length === DNS_STEPS.length &&
      DNS_STEPS.every(function (s) { return saved.indexOf(s.id) !== -1; });
    render(valid ? saved : shuffled());
  }



  // ======================================================================
  // TEACH BEAT — narration engine
  // ----------------------------------------------------------------------
  // Generic and data-driven: everything it renders comes from
  // window.FA5P2_NARRATION (narration.js). Adding a section means adding
  // narration + the matching markup, not touching this code.
  // ======================================================================

  // The speech engine needs "D N S" to say it correctly, but the reader
  // should see "DNS". One source of words, two renderings.
  function forReading(text) {
    // Numbers are spelled out for the speech engine ("one one zero zero…", "192 dot 168…");
    // on screen they should read as numbers.
    text = text
      .replace(/\b(?:(?:one|zero)\s+){3,}(?:one|zero)\b/gi, function (m) {
        return m.trim().split(/\s+/).map(function (w) { return w.toLowerCase() === "one" ? "1" : "0"; }).join("");
      })
      .replace(/\b(\d+) dot (\d+) dot (\d+) dot (\d+)\b/g, "$1.$2.$3.$4")
      .replace(/\bexample dot com\b/gi, "example.com")
      .replace(/\bdot (com|org|net)\b/gi, ".$1")
      .replace(/\bYear eleven\b/g, "Year 11")
      .replace(/\bfour point three billion\b/gi, "4.3 billion");
    return text
      .replace(/\bD N S\b/g, "DNS")
      .replace(/\bI P v four\b/gi, "IPv4")
      .replace(/\bI P version four\b/gi, "IP version four")
      .replace(/\bI P version six\b/gi, "IP version six")
      .replace(/\bI P\b/g, "IP")
      .replace(/\bT L D\b/g, "TLD")
      .replace(/\bT C P\b/g, "TCP")
      .replace(/\bD H C P\b/g, "DHCP")
      .replace(/\bH T T P\b/g, "HTTP")
      .replace(/\bT L S\b/g, "TLS");
  }

  // Browsers largely ignore punctuation *inside* one utterance, so a whole
  // segment spoken as a single utterance runs together with no sentence
  // breaks. Split into clauses and queue them with real silence between.
  // (No regex lookbehind here: Safari before 16.4 cannot parse one, and a single
  // syntax error would stop the whole script and leave the page blank.)
  function clausesOf(text) {
    var out = [], buf = "";
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      buf += ch;
      // a clause ends at . ! ? or a dash that is followed by white space, so
      // "example.com" and "4.3 billion" are not split in the middle
      if (".!?—".indexOf(ch) > -1 && /\s/.test(text.charAt(i + 1) || "")) { out.push(buf); buf = ""; }
    }
    if (buf) out.push(buf);
    return out
      .map(function (c) { return c.replace(/^\s+|\s+$/g, ""); })
      .filter(function (c) { return /[A-Za-z0-9]/.test(c); });
  }

  function buildTeachBeats() {
    var data = window.FA5P2_NARRATION || {};

    Object.keys(data).forEach(function (secId) {
      var section = document.getElementById(secId);
      if (!section) return;
      var segs = data[secId];
      var teach = section.querySelector(".teach-beat");
      if (!teach || !segs || !segs.length) return;

      var chain     = teach.querySelector(".chain");
      var caption   = teach.querySelector(".chain-caption");
      var rail      = teach.querySelector(".rail-fill");
      var countEl   = teach.querySelector(".seg-count");
      var playBtn   = teach.querySelector(".narr-play");
      var stopBtn   = teach.querySelector(".narr-stop");
      var readBtn   = teach.querySelector(".narr-read");
      var hint      = teach.querySelector(".narr-hint");
      var scriptBox = teach.querySelector(".script");
      var checkZone = section.querySelector(".check-zone");
      var lockMsg   = section.querySelector(".lock-msg");

      // STEP NOTES. The notes for the CURRENT step only, shown under the diagram whether the
      // student listens or reads, and never as one big block: two sentences to a short
      // paragraph. Each sentence is its own span so the one being spoken can be highlighted.
      var clauseSets = segs.map(function (sg) { return clausesOf(sg.text); });
      scriptBox.hidden = false;
      if (readBtn) readBtn.hidden = true;     // the notes are always visible now, so there is nothing to switch on

      function renderNotes(i) {
        scriptBox.innerHTML = "";
        var head = document.createElement("div");
        head.className = "note-head";
        head.textContent = "Step " + (i + 1) + " of " + segs.length;
        scriptBox.appendChild(head);
        // The speech pauses at a dash, but on screen a sentence stays whole: a clause that
        // ends in a dash is joined to the one after it. A unit remembers which spoken
        // clauses it holds, so the highlight still follows the voice.
        var units = [], cur = null;
        clauseSets[i].forEach(function (c, j) {
          if (!cur) cur = { text: "", idx: [] };
          cur.text += (cur.text ? " " : "") + c;
          cur.idx.push(j);
          if (!/—$/.test(c)) { units.push(cur); cur = null; }
        });
        if (cur) units.push(cur);
        var p = null, inP = 0;
        units.forEach(function (u) {
          if (!p || inP >= 2) { p = document.createElement("p"); scriptBox.appendChild(p); inP = 0; }
          var span = document.createElement("span");
          span.className = "clause";
          span.setAttribute("data-c", u.idx.join(","));
          span.textContent = forReading(u.text) + " ";
          p.appendChild(span); inP++;
        });
      }
      function renderEmptyNotes() {
        scriptBox.innerHTML = "";
        var p = document.createElement("p");
        p.className = "note-empty";
        p.textContent = "Press Play to listen, or Start to step through it yourself. The notes for each step will appear here.";
        scriptBox.appendChild(p);
      }
      function markClause(c) {
        scriptBox.querySelectorAll(".clause").forEach(function (el) {
          el.classList.toggle("now", ("," + el.getAttribute("data-c") + ",").indexOf("," + c + ",") > -1);
        });
      }
      if (hint) hint.textContent = "The notes for each step appear below. Play to listen, or use Start and Next to read at your own pace.";
      renderEmptyNotes();

      var storeKey = "teach-seen-" + secId;
      var seen = loadStore(storeKey) || 0;
      var speaking = false;
      var idx = -1;                       // current segment; -1 = not started

      var prevBtn = teach.querySelector(".narr-prev");
      var nextBtn = teach.querySelector(".narr-next");

      function focusOrder() {
        return Array.prototype.slice.call(chain.querySelectorAll(".node"))
          .map(function (n) { return n.getAttribute("data-focus"); });
      }

      /* Single place that moves the lesson. Everything else calls this. */
      function goTo(i, speakIt) {
        if (i < 0 || i >= segs.length) return;
        idx = i;
        var order = focusOrder();
        var target = segs[i].focus;
        var tPos = order.indexOf(target);
        chain.querySelectorAll(".node").forEach(function (n) {
          var pos = order.indexOf(n.getAttribute("data-focus"));
          n.classList.toggle("lit", n.getAttribute("data-focus") === target);
          n.classList.toggle("done", pos > -1 && tPos > -1 && pos < tPos);
        });
        if (caption) caption.textContent = segs[i].cap;
        if (rail) rail.style.width = (((i + 1) / segs.length) * 100) + "%";
        if (countEl) countEl.textContent = (i + 1) + " / " + segs.length;
        renderNotes(i);
        if (i + 1 > seen) { seen = i + 1; saveStore(storeKey, seen); unlockIfDone(); }
        syncSteps();
        if (speakIt) speakSegment(i, function () {}, null, markClause);
      }

      function syncSteps() {
        prevBtn.disabled = (idx <= 0);
        nextBtn.disabled = (idx >= segs.length - 1);
        nextBtn.textContent = (idx < 0) ? "Start \u25B6" : "Next \u25B6";
      }

      // A locked Check is switched off for the keyboard and screen readers as well as the mouse:
      // "inert" stops it being focused or operated, where pointer-events alone did not.
      if (checkZone && checkZone.classList.contains("locked")) checkZone.setAttribute("inert", "");

      function unlockIfDone() {
        if (seen < segs.length || !checkZone) return;
        checkZone.classList.remove("locked");
        checkZone.removeAttribute("inert");
        if (lockMsg) {
          lockMsg.textContent = "\u2713 Unlocked \u2014 now see if it stuck.";
          lockMsg.classList.add("unlocked");
        }
      }

      function speakSegment(i, done, fail, onClause) {
        if (!("speechSynthesis" in window)) { done(); return; }
        var my = ++narrToken;                 // this run's token; a newer run or a stop invalidates it
        window.speechSynthesis.cancel();
        var clauses = clausesOf(segs[i].text), c = 0, errors = 0;
        (function next() {
          if (my !== narrToken) return;       // stopped or replaced: do nothing
          if (c >= clauses.length) { done(); return; }
          if (onClause) onClause(c);          // highlight the sentence being spoken
          // Same voice and same rate as the page-aloud buttons.
          var u = makeUtterance(clauses[c]);
          u.onend = function () {
            if (my !== narrToken) return;
            c++;
            setTimeout(next, /[.!?]$/.test(clauses[c - 1] || "") ? 420 : 180);
          };
          u.onerror = function (e) {
            if (my !== narrToken) return;
            // cancel() reports "interrupted" / "canceled": that is a stop, not a failure
            if (e && (e.error === "interrupted" || e.error === "canceled")) return;
            errors++;
            // Two failures in a row means no working voice (or speech is blocked). Stop
            // instead of racing through every segment in silence and unlocking the check.
            if (errors >= 2) { if (fail) fail(); return; }
            c++; next();
          };
          window.speechSynthesis.speak(u);
        })();
      }

      function endPlayback() {
        speaking = false;
        playBtn.disabled = false;
        stopBtn.disabled = true;
        playBtn.textContent = (seen >= segs.length) ? "\u25B6 Play again" : "\u25B6 Play the explanation";
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        markClause(-1);
      }
      // stopSpeech() (Stop, changing section, or a page-aloud button) resets this beat too
      narrStops.push(function () { if (speaking) endPlayback(); });

      function audioFailed() {
        narrToken++;
        endPlayback();
        showScript(true);
        if (idx < 0) goTo(0, false);
        // set after showScript(), which writes its own hint
        if (hint) hint.textContent = "Audio isn\u2019t working on this device. The notes below cover everything \u2014 use Next to move through; reading counts the same as listening.";
      }

      /* Stepping moves the lesson. It speaks only if narration is already
         running — so a student who is reading can step without audio firing,
         and a student who is listening keeps hearing it. */
      function step(delta) {
        var target = (idx < 0 && delta > 0) ? 0 : idx + delta;
        if (target < 0 || target >= segs.length) return;
        goTo(target, false);
        if (speaking) {
          // keep narrating from wherever the student jumped to
          window.speechSynthesis.cancel();
          playFrom(target);
        }
      }
      prevBtn.addEventListener("click", function () { step(-1); });
      nextBtn.addEventListener("click", function () { step(1); });

      /* Autoplay from a given segment through to the end. */
      function playFrom(i) {
        speaking = true;
        playBtn.disabled = true;
        stopBtn.disabled = false;
        var cur = i;
        (function run() {
          if (!speaking || cur >= segs.length) { endPlayback(); return; }
          if (cur !== idx) goTo(cur, false);
          speakSegment(cur, function () {
            cur++;
            if (speaking) setTimeout(run, 320); else endPlayback();
          }, audioFailed, markClause);
        })();
      }

      playBtn.addEventListener("click", function () {
        if (!("speechSynthesis" in window)) {
          if (hint) hint.textContent = "This browser can\u2019t play audio \u2014 read the notes below and use Next to move through.";
          showScript(true);
          if (idx < 0) goTo(0, false);
          return;
        }
        if (hint) hint.textContent = "Playing \u2014 use Back and Next to move around.";
        playFrom(idx < 0 ? 0 : idx);
      });

      stopBtn.addEventListener("click", function () { narrToken++; speaking = false; endPlayback(); });

      // (The old "Read it instead" toggle is gone: the notes are always shown.)
      function showScript() { scriptBox.hidden = false; }

      // Restore progress: show the notes for the step the student had reached.
      if (countEl) countEl.textContent = "0 / " + segs.length;
      if (seen > 0) {
        goTo(Math.min(seen, segs.length) - 1, false);
        if (seen >= segs.length) playBtn.textContent = "\u25B6 Play again";
      } else {
        syncSteps();
      }
      unlockIfDone();
    });
  }

  // =====================================================================
  // YOUR SUMMARY (Section 5)
  // ---------------------------------------------------------------------
  // A downloadable, printable record of the homework: what each section
  // covered, the student's own answers, and the correct answer underneath
  // any question they got wrong. It cannot be produced until every question
  // has been attempted. Everything is read from the page itself (not from
  // localStorage), so it still works if the browser blocks storage.
  // =====================================================================

  var SUMMARY_SECTIONS = [
    { id: "sec-1", title: "1. The journey",
      notes: [
        "A web page does not travel as one continuous stream. It is split into small pieces called <strong>packets</strong>.",
        "Each packet is numbered and addressed, so each one is routed on its own. Packets from the same page can take different routes.",
        "Because there is no single path, a failed or busy router is simply routed around. The next packet goes another way.",
        "Packets often arrive out of order. That is normal: the receiver uses the <strong>sequence numbers</strong> to put them back in order before the page loads."
      ] },
    { id: "sec-2", title: "2. What is inside a packet",
      notes: [
        "<strong>Header</strong>: the source and destination IP addresses and the sequence number. Routers read the destination to decide where to send it next.",
        "<strong>Payload</strong>: the actual data, a slice of the page, image or video. Everything else is addressing and administration.",
        "<strong>Footer</strong> (also called the trailer): marks the end and carries error-checking information. If the check fails, the packet is thrown away and sent again.",
        "Reliability is not packets never failing. Loss is routine. Reliability comes from the receiver <em>noticing</em> a gap in the sequence numbers and having only the missing packet sent again.",
        "The numbering and the resending are the job of <strong>TCP</strong>, which works alongside IP. IP only does the addressing. TCP/IP is covered in the protocols homework."
      ] },
    { id: "sec-3", title: "3. IPv4 addresses",
      notes: [
        "Every device on a network needs a <strong>unique IP address</strong>, so packets can be delivered to the right one.",
        "An IPv4 address is four numbers separated by dots, for example <code>192.168.0.1</code>. Each number is an <strong>octet</strong>, stored as 8 bits, so an address is 32 bits in total.",
        "Place values in an octet: <code>128 64 32 16 8 4 2 1</code>. To convert decimal to binary, go left to right and put a 1 wherever the value still fits, subtracting as you go. To convert binary to decimal, add up the place values of the columns holding a 1. Example: 192 = 128 + 64 = <code>11000000</code>.",
        "The largest octet is 255, because that is all eight bits set to 1 (128 + 64 + 32 + 16 + 8 + 4 + 2 + 1). There is no room for 256.",
        "An address is valid only when it has <strong>exactly four</strong> numbers and <strong>every</strong> one is between 0 and 255.",
        "32 bits gives about 4.3 billion addresses. Phones, laptops, watches and TVs used them up. <strong>IPv6</strong> uses 128 bits, which is enough that running out is no longer a practical concern."
      ] },
    { id: "sec-4", title: "4. DNS",
      notes: [
        "Packets carry an IP address, but people remember names. The <strong>Domain Name System (DNS)</strong> turns a domain name into an IP address. That is its one job.",
        "No single machine holds every name, so DNS is a <strong>hierarchy</strong>. The <strong>resolver</strong> (usually your internet provider's) does the looking on your behalf.",
        "The resolver checks its <strong>cache</strong> first. If it already has a fresh answer, it returns it straight away and nothing else in the lookup happens.",
        "If not: the <strong>root</strong> server does not know the address but knows who handles the ending (<code>.com</code>); the <strong>TLD</strong> server knows which name server is authoritative for the name; the <strong>authoritative</strong> server holds the real, current record and returns the IP address.",
        "The resolver stores the answer in its cache, so the next person to ask skips the root, TLD and authoritative steps. That is why a site you visited a minute ago loads faster.",
        "Three jobs that are <em>not</em> DNS: <strong>DHCP</strong> gives a device its IP address when it joins a network, <strong>HTTP</strong> fetches the page once the browser has the address, and <strong>TLS</strong> encrypts what travels."
      ] }
  ];

  var SUMMARY_ANCHORS = {
    hook: "q-hook", routerfail: "q-routerfail", part: "q-part", lost: "q-lost",
    pv168: "pv-168", bd100: "bd-100", ip: "ip-sorter", dns: "dns-order", cache: "q-cache", dnsjob: "q-dnsjob"
  };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function fieldText(id) {
    var el = document.getElementById(id);
    return el ? (el.value || "").trim() : "";
  }
  function modelText(id) {
    var el = document.getElementById(id);
    if (!el) return "";
    return Array.prototype.slice.call(el.querySelectorAll("p")).map(function (p) { return p.textContent.trim(); }).join(" ");
  }
  // A single-select question, read from the page: what was chosen, and what was right.
  function selectInfo(id) {
    var block = document.getElementById(id);
    if (!block) return { answered: false, right: false, chosen: "", correct: "" };
    var correctVal = block.getAttribute("data-correct");
    var btns = Array.prototype.slice.call(block.querySelectorAll("button"));
    var correctBtn = btns.filter(function (b) { return b.getAttribute("data-value") === correctVal; })[0];
    var wrongBtn = btns.filter(function (b) { return b.classList.contains("incorrect"); })[0];
    var answered = block.classList.contains("answered");
    return {
      answered: answered,
      right: answered && !wrongBtn,
      chosen: answered ? (wrongBtn || correctBtn).textContent.trim() : "",
      correct: correctBtn ? correctBtn.textContent.trim() : ""
    };
  }

  // Every question on the page, with the student's answer and the correct one.
  function summaryItems() {
    var items = [];
    function select(key, sec, label, q, id) {
      var s = selectInfo(id);
      items.push({ key: key, sec: sec, label: label, q: q, kind: "auto", attempted: s.answered, right: s.right,
        mine: esc(s.chosen), correct: esc(s.correct) });
    }

    // Section 1
    var guess = fieldText("q-hook");
    items.push({ key: "hook", sec: "sec-1", label: "Opening guess: one stream, or pieces?",
      q: "Before reading: when you load a page, does it arrive as one continuous stream of data, or in pieces?",
      kind: "free", attempted: guess.length >= 2, mine: esc(guess),
      model: "It arrives in pieces, as numbered packets, each routed on its own. If you guessed one stream, that is the usual instinct." });
    select("routerfail", "sec-1", "A router fails mid-transfer", "A router in the middle of the network fails while a page is being sent as packets. What happens?", "q-routerfail");

    // Section 2
    select("part", "sec-2", "Which part carries the destination?", "Which part of a packet carries the destination?", "q-part");
    var lost = fieldText("q-lost");
    items.push({ key: "lost", sec: "sec-2", label: "Packet 3 never arrives",
      q: "Five packets are sent and four arrive. How does the receiver know one is missing, and what does it do?",
      kind: "free", attempted: lost.length >= MIN_ATTEMPT_CHARS, mine: esc(lost), model: esc(modelText("a-lost")) });

    // Section 3: place-value table for 168
    var cells = Array.prototype.slice.call(document.querySelectorAll("#pv-168 input")).map(function (i) { return (i.value || "").trim(); });
    var pvDone = cells.length === 8 && cells.every(function (c) { return c === "0" || c === "1"; });
    items.push({ key: "pv168", sec: "sec-3", label: "Place-value table for 168",
      q: "Fill in the place-value table for 168 (columns 128, 64, 32, 16, 8, 4, 2, 1).",
      kind: "auto", attempted: pvDone, right: pvDone && cells.join("") === "10101000",
      mine: esc(cells.map(function (c) { return c || "_"; }).join(" ")),
      correct: "1 0 1 0 1 0 0 0 &nbsp;(128 + 32 + 8 = 168, so <code>10101000</code>)" });
    var bd = fieldText("q-bd100");
    items.push({ key: "bd100", sec: "sec-3", label: "Binary 01100100 to decimal",
      q: "What decimal number is the octet 01100100?",
      kind: "auto", attempted: /^\d+$/.test(bd), right: bd === "100", mine: esc(bd),
      correct: "100 &nbsp;(64 + 32 + 4)" });

    // Section 3: valid or not
    var rows = Array.prototype.slice.call(document.querySelectorAll("#ip-sorter .sorter-row"));
    var ipAll = rows.length === IP_ITEMS.length && rows.every(function (r) { return r.classList.contains("answered"); });
    var ipRight = ipAll;
    var ipMine = [], ipFix = [];
    IP_ITEMS.forEach(function (item, i) {
      var row = rows[i];
      var chosenBtn = row ? Array.prototype.slice.call(row.querySelectorAll(".sorter-btn")).filter(function (b) {
        return b.classList.contains("correct") || b.classList.contains("incorrect");
      })[0] : null;
      var choice = chosenBtn ? chosenBtn.getAttribute("data-choice") : "";
      var ok = choice ? ((choice === "valid") === item.valid) : false;
      if (!ok) ipRight = false;
      ipMine.push("<code>" + esc(item.text) + "</code>: " + (choice ? (choice === "valid" ? "valid" : "not valid") : "not answered") + (choice ? (ok ? " ✓" : " ✗") : ""));
      if (!ok) ipFix.push("<code>" + esc(item.text) + "</code> is " + (item.valid ? "valid" : "not valid") + ". " + esc(item.why));
    });
    items.push({ key: "ip", sec: "sec-3", label: "Valid or not? (six addresses)",
      q: "Which of these addresses are valid IPv4 addresses?", kind: "auto", attempted: ipAll, right: ipAll && ipRight,
      mineList: ipMine, correctList: ipFix });

    // Section 4
    var dnsChecked = !!(document.getElementById("dns-order") && document.getElementById("dns-order").getAttribute("data-checked") === "1");
    var dnsLis = Array.prototype.slice.call(document.querySelectorAll("#dns-order li"));
    var dnsIds = dnsLis.map(function (li) { return li.getAttribute("data-id"); });
    var dnsRight = dnsIds.join() === DNS_STEPS.map(function (s) { return s.id; }).join();
    items.push({ key: "dns", sec: "sec-4", label: "Put the DNS lookup in order",
      q: "Put the ten steps of a DNS lookup back in order.", kind: "auto", attempted: dnsChecked, right: dnsChecked && dnsRight,
      mineOrdered: dnsLis.map(function (li) { var t = li.querySelector(".order-text"); return esc(t ? t.textContent : ""); }),
      correctOrdered: DNS_STEPS.map(function (s) { return esc(s.text); }) });
    var cache = fieldText("q-cache");
    var cacheLabel = document.querySelector('label[for="q-cache"]');
    items.push({ key: "cache", sec: "sec-4", label: "The next person to look up a site",
      q: cacheLabel ? cacheLabel.textContent.trim() : "Which steps don't need to happen for the next person, and why?",
      kind: "free", attempted: cache.length >= MIN_ATTEMPT_CHARS, mine: esc(cache), model: esc(modelText("a-cache")) });
    select("dnsjob", "sec-4", "Which job belongs to DNS?", "Which job belongs to DNS?", "q-dnsjob");
    return items;
  }

  // ------------------------------------------------------------ the document
  var SUMMARY_CSS =
    "body{font:15px/1.55 system-ui,'Segoe UI',Arial,sans-serif;color:#1f1812;max-width:780px;margin:0 auto;padding:28px 22px 60px;background:#fff}" +
    "h1{font-size:1.8em;margin:.1em 0 .2em}h2{font-size:1.3em;margin:1.6em 0 .4em;padding-bottom:.2em;border-bottom:2px solid #1f1812}" +
    "h3{font-size:.8em;letter-spacing:.1em;text-transform:uppercase;color:#6b5a48;margin:1.1em 0 .3em}" +
    ".k{font:700 .78em ui-monospace,Consolas,monospace;letter-spacing:.14em;text-transform:uppercase;color:#9a6200;margin:0}" +
    ".meta{color:#6b5a48;margin:0 0 1em}ul{margin:.2em 0 .6em 1.2em;padding:0}li{margin:.3em 0}" +
    "code{font-family:ui-monospace,Consolas,monospace;background:#f3ede3;padding:0 .3em;border-radius:3px}" +
    ".q{border:1px solid #d8ccba;border-radius:8px;padding:10px 14px;margin:.7em 0;break-inside:avoid}" +
    ".qt{font-weight:700;margin:0 0 .35em}.lbl{display:inline-block;font:700 .72em ui-monospace,Consolas,monospace;letter-spacing:.1em;text-transform:uppercase;color:#6b5a48;margin-right:.5em}" +
    ".ok{color:#0e7a52;font-weight:700;margin:.3em 0 0}.bad{color:#b3243d;font-weight:700;margin:.3em 0 0}.info{color:#6b5a48;font-weight:700;margin:.3em 0 0}" +
    ".fix{background:#e9f7f0;border-left:4px solid #0e7a52;border-radius:0 6px 6px 0;padding:6px 12px;margin:.5em 0 0}" +
    ".fix ol,.fix ul,.q ol{margin:.3em 0 .2em 1.3em}.mine{margin:.15em 0}.ans{white-space:pre-wrap}" +
    "@media print{body{padding:0}.q{page-break-inside:avoid}h2{page-break-after:avoid}}@page{margin:16mm}";

  function summaryItemHtml(it) {
    var h = '<div class="q"><p class="qt">' + esc(it.q) + "</p>";
    if (it.mineList) h += '<p class="mine"><span class="lbl">Your answers</span></p><ul>' + it.mineList.map(function (l) { return "<li>" + l + "</li>"; }).join("") + "</ul>";
    else if (it.mineOrdered) h += '<p class="mine"><span class="lbl">Your order</span></p><ol>' + it.mineOrdered.map(function (l) { return "<li>" + l + "</li>"; }).join("") + "</ol>";
    else h += '<p class="mine"><span class="lbl">Your answer</span><span class="ans">' + (it.mine || "(blank)") + "</span></p>";

    if (it.kind === "auto") {
      if (it.right) {
        h += '<p class="ok">✓ Correct</p>';
      } else {
        h += '<p class="bad">✗ Not quite</p>';
        if (it.correctList) h += '<div class="fix"><span class="lbl">Correct answers</span><ul>' + it.correctList.map(function (l) { return "<li>" + l + "</li>"; }).join("") + "</ul></div>";
        else if (it.correctOrdered) h += '<div class="fix"><span class="lbl">Correct order</span><ol>' + it.correctOrdered.map(function (l) { return "<li>" + l + "</li>"; }).join("") + "</ol></div>";
        else h += '<div class="fix"><span class="lbl">Correct answer</span>' + it.correct + "</div>";
      }
    } else {
      h += '<p class="info">Compare with the model answer</p><div class="fix"><span class="lbl">Model answer</span>' + it.model + "</div>";
    }
    return h + "</div>";
  }

  function buildSummaryHtml() {
    var items = summaryItems();
    var auto = items.filter(function (i) { return i.kind === "auto"; });
    var right = auto.filter(function (i) { return i.right; }).length;
    var date = new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
    var h = '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
      "<title>H1 summary: how data gets there</title><style>" + SUMMARY_CSS + "</style></head><body>" +
      '<p class="k">Programming for the Web &middot; Homework H1</p><h1>How data gets there: my summary</h1>' +
      '<p class="meta">Made ' + esc(date) + " &middot; " + right + " of " + auto.length + " auto-marked questions correct. The free-response questions are for you to compare with the model answers.</p>";
    SUMMARY_SECTIONS.forEach(function (sec) {
      h += "<h2>" + esc(sec.title) + "</h2><h3>What this section covered</h3><ul>" +
        sec.notes.map(function (n) { return "<li>" + n + "</li>"; }).join("") + "</ul>";
      if (sec.id === "sec-4") {
        h += "<h3>The ten steps of a DNS lookup</h3><ol>" + DNS_STEPS.map(function (s) { return "<li>" + esc(s.text) + "</li>"; }).join("") +
          "</ol><p>Steps 4 to 8 are skipped when the resolver already has the answer in its cache.</p>";
      }
      h += "<h3>My answers</h3>" + items.filter(function (i) { return i.sec === sec.id; }).map(summaryItemHtml).join("");
    });
    h += "<h2>Next</h2><ul><li>Do the H1 check on Canvas, closed book, before your fourth lesson.</li>" +
      "<li>Anything above marked ✗, or anything you could not explain, write down as your “one thing I am still unsure about” on the Canvas quiz.</li>" +
      "<li>In class you will run <code>ping</code> and <code>tracert</code> and watch a real route to a server.</li></ul></body></html>";
    return h;
  }

  function downloadSummary() {
    var html = buildSummaryHtml();
    var blob = new Blob([html], { type: "text/html" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "H1-how-data-gets-there-summary.html";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 800);
  }
  function printSummary() {
    var frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    document.body.appendChild(frame);
    var doc = frame.contentWindow.document;
    doc.open(); doc.write(buildSummaryHtml()); doc.close();
    setTimeout(function () {
      try { frame.contentWindow.focus(); frame.contentWindow.print(); } catch (e) { /* the download still works */ }
      setTimeout(function () { frame.remove(); }, 4000);
    }, 300);
  }

  // ---------------------------------------------- the gate and progress list
  function buildSummary() {
    var box = document.getElementById("summary-box");
    if (!box) return;
    var list = document.getElementById("summary-progress");
    var countEl = document.getElementById("summary-count");
    var status = document.getElementById("summary-status");
    var dl = document.getElementById("summary-download");
    var pr = document.getElementById("summary-print");
    var timer = null;

    function update() {
      var items = summaryItems();
      var done = items.filter(function (i) { return i.attempted; }).length;
      countEl.textContent = done + " of " + items.length;
      list.innerHTML = "";
      items.forEach(function (it) {
        var li = document.createElement("li");
        li.className = it.attempted ? "done" : "todo";
        var mark = document.createElement("span");
        mark.className = "pl-mark"; mark.setAttribute("aria-hidden", "true");
        mark.textContent = it.attempted ? "✓" : "○";
        var text = document.createElement("span");
        text.className = "pl-text";
        text.textContent = it.label + " (" + it.sec.replace("sec-", "Section ") + ")";
        li.appendChild(mark); li.appendChild(text);
        if (!it.attempted) {
          var go = document.createElement("button");
          go.type = "button"; go.className = "pl-go"; go.textContent = "Go to it";
          go.setAttribute("aria-label", "Go to: " + it.label);
          go.addEventListener("click", function () {
            goToSection(it.sec);
            setTimeout(function () {
              var el = document.getElementById(SUMMARY_ANCHORS[it.key]);
              if (el) el.scrollIntoView({ block: "center" });
            }, 350);
          });
          li.appendChild(go);
        }
        list.appendChild(li);
      });
      var ready = done === items.length;
      dl.disabled = !ready; pr.disabled = !ready;
      status.textContent = ready
        ? "Everything is attempted. Your summary is ready to download or print."
        : (items.length - done) + " question" + (items.length - done === 1 ? "" : "s") + " still to attempt before the summary unlocks. A wrong answer still counts as an attempt.";
      status.className = "summary-status " + (ready ? "ready" : "waiting");
    }
    function soon() { clearTimeout(timer); timer = setTimeout(update, 80); }

    dl.addEventListener("click", function () { if (!dl.disabled) downloadSummary(); });
    pr.addEventListener("click", function () { if (!pr.disabled) printSummary(); });
    ["click", "input", "change", "pointerup"].forEach(function (evt) { document.addEventListener(evt, soon, true); });
    window.__refreshSummary = update;
    update();
  }

  // --------------------------------------------------------------------- init
  document.addEventListener("DOMContentLoaded", function () {
    buildTeachBeats();
    buildRouteAnim();
    wireLiveRegions();
    buildIpSorter();
    buildDnsOrder();
    buildNav();
    buildTextToSpeech();

    wireTextInputs();
    wireRevealButtons();
    wireSingleSelects();
    wirePlaceValueTables();
    wireHookEcho();
    wireHintSteps();
    wireBinToDec();
    wireNextButtons();
    wireReset();

    var last = loadStore("current-section") || "sec-1";
    if (SECTION_IDS.indexOf(last) === -1) last = "sec-1";
    goToSection(last);
    buildSummary();
  });
})();

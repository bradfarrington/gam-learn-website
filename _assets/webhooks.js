/*
 * CRM webhook integration for the GAMLEARN site forms.
 *
 * Shared across every page (the contact form lives on contact-us only; the
 * newsletter form is in the footer of every page). Submissions are sent to the
 * CRM webhooks below. Framer's own form backend is intentionally bypassed so
 * that NO emails are sent and nothing is stored in Framer — the only thing that
 * happens on submit is: validate -> POST to webhook(s) -> show success state.
 */
(function () {
  "use strict";

  // --- Webhook endpoints -----------------------------------------------------
  var CONTACT_WEBHOOKS = [
    "https://boelrbcmcotntfbukzfc.supabase.co/functions/v1/workflow-webhook?token=72131e5945ad4830b489432e32ba722d",
    "https://services.leadconnectorhq.com/hooks/CNEULa2H6USAw83rAx5V/webhook-trigger/zAGRA1JorMKkpM0D0uMC",
  ];
  var NEWSLETTER_WEBHOOKS = [
    "https://boelrbcmcotntfbukzfc.supabase.co/functions/v1/workflow-webhook?token=1d99e3e3f55642e6a0ad799c2b073227",
  ];

  // Site design token for the brand green (matches the form buttons).
  var BRAND_GREEN =
    "var(--token-1c79ec7e-49ca-45a4-8f59-5d04cfb04595, rgb(0, 102, 77))";

  // Brand purple — the hover colour the site's other primary buttons use.
  var BRAND_PURPLE =
    "var(--token-78d77a8e-a6d1-46a2-b298-d1a12220fc6e, rgb(75, 0, 130))";

  // Fix: Framer wired the form submit buttons' hover background to the grey
  // placeholder-text token instead of the brand purple, so they go grey on
  // hover while every other primary button goes purple. Framer applies that
  // colour as an inline style on hover, so we override it with !important.
  (function injectButtonHoverFix() {
    var style = document.createElement("style");
    style.setAttribute("data-webhook-style", "true");
    style.textContent =
      "form button.glearn-5cwkA:hover{" +
      "background-color:" + BRAND_PURPLE + " !important;}";
    (document.head || document.documentElement).appendChild(style);
  })();

  // --- Helpers ---------------------------------------------------------------
  function nowIso() {
    return new Date().toISOString();
  }

  function postAll(urls, payload) {
    var body = JSON.stringify(payload);
    return Promise.all(
      urls.map(function (url) {
        return fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: body,
        }).then(function (res) {
          if (!res.ok) throw new Error(url + " -> HTTP " + res.status);
          return res;
        });
      })
    );
  }

  // Replace the form's interactive content with a success message styled to
  // match the site, so it reads as a proper "success state" rather than a popup.
  function showSuccess(form, message) {
    var note = document.createElement("div");
    note.setAttribute("data-webhook-success", "true");
    note.textContent = message;
    note.style.cssText = [
      "display:flex",
      "align-items:center",
      "justify-content:center",
      "text-align:center",
      "width:100%",
      "box-sizing:border-box",
      "padding:16px 24px",
      "min-height:52px",
      "border-radius:100px",
      "font-weight:600",
      "line-height:1.4",
      "color:#ffffff",
      "background-color:" + BRAND_GREEN,
    ].join(";");

    // Hide the existing fields/button, then show the success note in their place.
    Array.prototype.forEach.call(form.children, function (child) {
      child.style.display = "none";
    });
    form.appendChild(note);
  }

  function setButtonBusy(btn, busy) {
    if (!btn) return;
    btn.disabled = busy;
    btn.style.opacity = busy ? "0.6" : "";
    btn.style.pointerEvents = busy ? "none" : "";
  }

  // --- Wiring ----------------------------------------------------------------
  function attach(form, urls, buildPayload, successMessage) {
    if (form.__webhookWired) return;
    form.__webhookWired = true;

    form.addEventListener(
      "submit",
      function (e) {
        // Take over from Framer entirely: no Framer backend call, no emails.
        e.preventDefault();
        e.stopImmediatePropagation();

        // Native HTML5 validation (required fields, email format) — replaces
        // Framer's validation since we've bypassed its handler.
        if (typeof form.checkValidity === "function" && !form.checkValidity()) {
          if (typeof form.reportValidity === "function") form.reportValidity();
          return;
        }

        var btn = form.querySelector("button");
        setButtonBusy(btn, true);

        postAll(urls, buildPayload(form))
          .then(function () {
            showSuccess(form, successMessage);
          })
          .catch(function (err) {
            console.error("Webhook submit failed:", err);
            setButtonBusy(btn, false);
            alert("Sorry, something went wrong. Please try again.");
          });
      },
      true // capture phase, so we run before Framer's own submit handler
    );
  }

  function contactPayload(form) {
    var d = new FormData(form);
    return {
      name: d.get("Name") || "",
      phone: d.get("Phone") || "",
      email: d.get("Email") || "",
      subject: d.get("Subject") || "",
      message: d.get("Message") || "",
      source: "contact-us",
      page: window.location.href,
      submitted_at: nowIso(),
    };
  }

  function newsletterPayload(form) {
    var d = new FormData(form);
    return {
      email: d.get("Email") || "",
      source: "newsletter",
      page: window.location.href,
      submitted_at: nowIso(),
    };
  }

  function init() {
    // Contact form (contact-us page only).
    var contact = document.querySelector("form.glearn-jsotkf");
    if (contact) {
      attach(
        contact,
        CONTACT_WEBHOOKS,
        contactPayload,
        "Thanks — your message has been sent."
      );
    }

    // Newsletter form (footer, every page; rendered as responsive variants).
    var newsletters = document.querySelectorAll("form.glearn-tpdu8q");
    Array.prototype.forEach.call(newsletters, function (form) {
      attach(
        form,
        NEWSLETTER_WEBHOOKS,
        newsletterPayload,
        "Thanks — you're subscribed."
      );
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

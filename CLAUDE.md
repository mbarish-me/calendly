# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the Project

This is a static site with **no build step**. It must be served over HTTP — Stripe Checkout refuses `file://` origins.

```bash
# Option 1: VS Code Live Server extension (open index.html, click "Go Live")
# Option 2:
npx serve .
```

## Architecture

Three files, no framework, no bundler:

- **`index.html`** — Structure: fullscreen Leaflet map, a hidden payment modal (shown via JS), and a footer. Loads Leaflet CSS/JS, Calendly widget CSS/JS, and Stripe.js from CDNs.
- **`app.js`** — All application logic. Three-step booking flow:
  1. Map marker click → `initiateBooking()` shows the Stripe payment modal
  2. "Pay with Stripe" → `completePayment()` redirects to Stripe Checkout, saving `selectedPartnerId` to `localStorage`
  3. Stripe redirects back with `?payment=success` → `window.onload` reads `localStorage` and auto-opens Calendly via `Calendly.initPopupWidget()`
- **`styles.css`** — All styling; no preprocessor.

## Key Configuration (in `app.js`)

| Constant | Purpose |
|---|---|
| `stripe` (line 2) | Initialized with the Stripe publishable key |
| `STRIPE_PRICE_ID` (line 5) | Stripe Price ID for the $50 discovery call product |
| `partners` array (line 20) | Partner data: name, country, map coordinates, Calendly URL |

To add a new partner, append an entry to the `partners` array with `id`, `name`, `country`, `coords` ([lat, lng]), and `calendlyUrl`.

## External Dependencies (CDN-only)

- **Leaflet 1.9.4** — interactive map
- **Stripe.js v3** — `stripe.redirectToCheckout()` for payments
- **Calendly widget** — `Calendly.initPopupWidget()` for scheduling

# Nexus Browser

Nexus is a custom dark browser interface built on the Scramjet Demo application.

It keeps the Scramjet proxy engine and Wisp WebSocket transport while replacing the default demo page with the Nexus interface.

## Features

- Dark Nexus layout with tabs and browser navigation controls
- Google is the default search engine
- Search terms are routed to Google
- Scramjet proxy navigation for websites
- Wisp WebSocket transport
- No built-in ad blocker
- Designed to work in modern desktop and Chromebook browsers

GeForce NOW, YouTube, and other complex websites are compatibility targets, not guarantees. Their behavior can depend on their own changes, browser features, media support, network quality, and hosting provider. Datacenter-hosted IP addresses may also receive CAPTCHA challenges or service restrictions.

## Local development

Requirements: Node.js 20 or newer and pnpm 10.

1. Install dependencies:

   pnpm install

2. Start Nexus:

   pnpm start

3. Open the local address printed by the server (normally http://localhost:8080).

The service worker requires HTTPS in production. Localhost is allowed for development.

## Render deployment

This repository includes a Render Blueprint in render.yaml and a Dockerfile.

1. Sign in to Render.
2. Create a new Blueprint or Web Service from this GitHub repository.
3. For Docker deployment, use the repository Dockerfile.
4. Deploy the service and open its onrender.com URL.

Render web services support WebSocket connections required by the Wisp endpoint. Free instances may spin down after inactivity and take time to start again. That startup delay and shared datacenter IP reputation can affect proxy use and streaming reliability.

## Proxy transport

The browser uses Scramjet with libcurl-transport and a Wisp WebSocket endpoint at /wisp/. The application does not install an ad-blocking extension or add an ad-filtering list.

## Project attribution and license

This project is based on the Scramjet Demo by Mercury Workshop and retains its AGPL-3.0 license and credits. See LICENSE and public/credits.html.

Nexus-specific interface and deployment changes are maintained in this fork:
https://github.com/bungus0the0fungus-collab/nexus-browser

Original Scramjet project:
https://github.com/MercuryWorkshop/scramjet

This is an experimental browser proxy project. Use it responsibly and follow the terms and rules of the websites and services you access.

# Library Book Reservation System

A library UI to search books, check availability, and reserve copies. Built with HTML, Tailwind CSS, vanilla JS, and Node.js talking to a Turso (cloud SQLite) database. **Zero npm packages** — just Node's built-in `http` and `fetch`. All you need is Node.js installed.

## How to run

1. Create a `.env` file (if not present) with your Turso database credentials:
   ```
   TURSO_URL=libsql://your-database.turso.io
   TURSO_AUTH_TOKEN=your-token
   PORT=3000
   ```

2. Start the server:
   ```
   node server.js
   ```

3. Open http://localhost:3000 in your browser.

That's it — no `npm install`, no `node_modules`, no `package.json`.

## Features

- Demo login page (any name, password `1234`) — required to reserve
- Search books by title or author
- Filter by genre
- Reserve a copy (name comes from your login, mobile is asked once and remembered)
- Cancel reservations
- "My Reservations" shows only the logged-in user's reservations
- Availability stats that update live
- Books and reservations persist in the Turso database

## Note

`.env` is gitignored — get Turso credentials from https://turso.tech and never push your token.
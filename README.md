# Library Book Reservation System

A library UI to search books, check availability, and reserve copies. Built with HTML, Tailwind CSS, vanilla JS, Express, and a Turso (cloud SQLite) database.

## How to run

1. Install dependencies:
   ```
   npm install
   ```

2. Create a `.env` file (already present locally) with your Turso database credentials:
   ```
   TURSO_URL=libsql://your-database.turso.io
   TURSO_AUTH_TOKEN=your-token
   PORT=3000
   ```

3. Start the server:
   ```
   npm start
   ```

4. Open http://localhost:3000 in your browser.

## Features

- Search books by title or author
- Filter by genre
- Reserve a copy (asks for name + mobile once, pre-fills next time)
- Cancel reservations
- Availability stats that update live
- Books and reservations persist in the Turso database

## Note

`.env` and `node_modules/` are gitignored — get Turso credentials from https://turso.tech and never push your token.
# Library Book Reservation System

A library UI to search books, check availability, and reserve copies. Built with HTML, Tailwind CSS, and vanilla JavaScript.

**No server, no database setup, no packages, no internet needed** — all data is saved in the browser's `localStorage`, exactly like a local database. It works by simply opening the page.

## How to run

Just open `index.html` in any browser (double-click the file). That's it.

Or if you prefer, open `login.html` first and log in.

## Demo login

Any name, password: `1234`

## Features

- Demo login page (any name, password `1234`) — required to reserve
- Search books by title or author
- Filter by genre
- Reserve a copy (name comes from your login, mobile is asked once and remembered)
- Cancel reservations
- "My Reservations" shows only the logged-in user's reservations
- Availability stats that update live
- Books and reservations persist between visits (browser localStorage)

## Files

- `index.html` — homepage
- `login.html` — demo login page
- `functions.js` — all the logic and local "database" (localStorage)

## Note

Data lives in the browser, so it is tied to the device/browser you used. If the browser history/storage is cleared, the library resets to the starting catalogue automatically.
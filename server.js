// Library Book Reservation System — Backend
// Express + @libsql/client to talk to Turso (cloud SQLite)
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { createClient } = require("@libsql/client");

const app = express();
app.use(cors());
app.use(express.json());

// connect to Turso using the URL from .env (token only if your db uses one)
const db = createClient({
    url: process.env.TURSO_URL,
    ...(process.env.TURSO_AUTH_TOKEN ? { authToken: process.env.TURSO_AUTH_TOKEN } : {}),
});

// sample books used only the first time the table is empty
const sampleBooks = [
    ["The Great Gatsby", "F. Scott Fitzgerald", "Fiction", 4, 3],
    ["1984", "George Orwell", "Fiction", 3, 0],
    ["To Kill a Mockingbird", "Harper Lee", "Fiction", 5, 2],
    ["A Brief History of Time", "Stephen Hawking", "Science", 2, 2],
    ["The Hobbit", "J.R.R. Tolkien", "Fantasy", 3, 1],
    ["Pride and Prejudice", "Jane Austen", "Fiction", 4, 4],
    ["Sapiens", "Yuval Noah Harari", "Non-Fiction", 2, 0],
    ["The Alchemist", "Paulo Coelho", "Fiction", 3, 2],
    ["Atomic Habits", "James Clear", "Non-Fiction", 4, 3],
    ["Harry Potter and the Sorcerer's Stone", "J.K. Rowling", "Fantasy", 5, 1],
];

async function setupDatabase() {
    // create tables if they don't exist
    await db.execute(`
        CREATE TABLE IF NOT EXISTS books (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            author TEXT NOT NULL,
            genre TEXT NOT NULL,
            total_copies INTEGER NOT NULL,
            available_copies INTEGER NOT NULL
        )
    `);
    await db.execute(`
        CREATE TABLE IF NOT EXISTS reservations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            book_id INTEGER NOT NULL,
            user_name TEXT NOT NULL,
            mobile TEXT NOT NULL,
            reserved_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (book_id) REFERENCES books(id)
        )
    `);

    // seed books only if the table is empty
    const row = await db.execute("SELECT COUNT(*) AS count FROM books");
    const count = row.rows[0].count;

    if (count === 0) {
        for (const b of sampleBooks) {
            await db.execute({
                sql: `INSERT INTO books (title, author, genre, total_copies, available_copies)
                      VALUES (?, ?, ?, ?, ?)`,
                args: b,
            });
        }
        console.log("Seeded " + sampleBooks.length + " books");
    }
}

// ---- API Routes ----

// GET all books
app.get("/api/books", async (req, res) => {
    try {
        const { rows } = await db.execute("SELECT * FROM books ORDER BY title");
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET all reservations (joined with book title)
app.get("/api/reservations", async (req, res) => {
    try {
        const { rows } = await db.execute(`
            SELECT reservations.id, reservations.book_id, reservations.user_name,
                   reservations.mobile, reservations.reserved_at,
                   books.title, books.author, books.genre
            FROM reservations
            JOIN books ON books.id = reservations.book_id
            ORDER BY reservations.reserved_at DESC
        `);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST reserve a book
app.post("/api/reserve", async (req, res) => {
    const { bookId, name, mobile } = req.body;

    if (!bookId || !name || !mobile) {
        return res.status(400).json({ error: "bookId, name and mobile are required" });
    }

    try {
        // check availability
        const { rows } = await db.execute({
            sql: "SELECT * FROM books WHERE id = ?",
            args: [bookId],
        });

        if (rows.length === 0) {
            return res.status(404).json({ error: "Book not found" });
        }

        const book = rows[0];
        if (book.available_copies <= 0) {
            return res.status(400).json({ error: "No copies available" });
        }

        // decrement available copies and insert reservation (atomic-ish)
        await db.execute({
            sql: "UPDATE books SET available_copies = available_copies - 1 WHERE id = ? AND available_copies > 0",
            args: [bookId],
        });

        const result = await db.execute({
            sql: "INSERT INTO reservations (book_id, user_name, mobile) VALUES (?, ?, ?)",
            args: [bookId, name, mobile],
        });

        res.json({ success: true, reservationId: Number(result.lastInsertRowid) });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE cancel a reservation
app.delete("/api/reservations/:id", async (req, res) => {
    try {
        const { rows } = await db.execute({
            sql: "SELECT * FROM reservations WHERE id = ?",
            args: [req.params.id],
        });

        if (rows.length === 0) {
            return res.status(404).json({ error: "Reservation not found" });
        }

        // put the copy back
        await db.execute({
            sql: "UPDATE books SET available_copies = available_copies + 1 WHERE id = ?",
            args: [rows[0].book_id],
        });

        await db.execute({
            sql: "DELETE FROM reservations WHERE id = ?",
            args: [req.params.id],
        });

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// serve the frontend files (only index.html and functions.js — nothing else)
app.get("/", (req, res) => res.sendFile(__dirname + "/index.html"));
app.get("/functions.js", (req, res) => res.sendFile(__dirname + "/functions.js"));

setupDatabase()
    .then(() => {
        app.listen(process.env.PORT || 3000, () => {
            console.log("Server running at http://localhost:" + (process.env.PORT || 3000));
        });
    })
    .catch((error) => {
        console.error("Database setup failed:", error.message);
        process.exit(1);
    });
// Library Book Reservation System — Backend
// Zero dependencies: Node's built-in http + fetch only.
// Talks to Turso (cloud SQLite) through its HTTP API. Run with: node server.js

const http = require("http");
const fs = require("fs");

// ---- load .env by hand (no dotenv needed) ----
function loadEnv() {
    const env = {};
    try {
        const lines = fs.readFileSync(__dirname + "/.env", "utf8").split("\n");
        for (const line of lines) {
            const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
            if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, "");
        }
    } catch { /* .env missing -> fall back to process env */ }
    for (const key of Object.keys(process.env)) if (!(key in env)) env[key] = process.env[key];
    return env;
}

const env = loadEnv();

// ---- Turso connection ----
const TURSO_HTTP_URL = (env.TURSO_URL || "").replace("libsql://", "https://") + "/v2/pipeline";
const AUTH = "Bearer " + env.TURSO_AUTH_TOKEN;

// turso's http api wants args as tagged values, e.g. {type:"integer", value:"1"}
function toValue(arg) {
    if (arg === null || arg === undefined) return { type: "null" };
    if (typeof arg === "number") {
        return Number.isInteger(arg)
            ? { type: "integer", value: String(arg) }
            : { type: "float", value: String(arg) };
    }
    return { type: "text", value: String(arg) };
}

// run one SQL statement against Turso, returns { rows, lastInsertRowid, affectedRowCount }
async function exec(sql, args = []) {
    let body = JSON.stringify({
        requests: [{ type: "execute", stmt: { sql, args: args.map(toValue) } }],
    });

    const resp = await fetch(TURSO_HTTP_URL, {
        method: "POST",
        headers: { "Authorization": AUTH, "Content-Type": "application/json" },
        body,
    });

    if (!resp.ok) throw new Error("Turso HTTP " + resp.status + ": " + await resp.text());

    const data = await resp.json();
    const result = data.results[0];

    if (result.type !== "ok") throw new Error(JSON.stringify(result));
    const res = result.response.result;

    // turso returns values like { type: "integer", value: "3" } -> convert to plain values
    const rows = res.rows.map((r) => {
        const row = {};
        res.cols.forEach((col, i) => {
            row[col.name] = r[i]?.value ?? null;
        });
        return row;
    });

    return {
        rows,
        lastInsertRowid: res.last_insert_rowid == null ? null : Number(res.last_insert_rowid),
        affectedRowCount: res.affected_row_count,
    };
}

// ---- sample books used only the first time the table is empty ----
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
    await exec(`CREATE TABLE IF NOT EXISTS books (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        author TEXT NOT NULL,
        genre TEXT NOT NULL,
        total_copies INTEGER NOT NULL,
        available_copies INTEGER NOT NULL
    )`);

    await exec(`CREATE TABLE IF NOT EXISTS reservations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        book_id INTEGER NOT NULL,
        user_name TEXT NOT NULL,
        mobile TEXT NOT NULL,
        reserved_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (book_id) REFERENCES books(id)
    )`);

    // seed books only if the table is empty
    const { rows } = await exec("SELECT COUNT(*) AS count FROM books");
    if (Number(rows[0].count) === 0) {
        for (const b of sampleBooks) {
            await exec(`INSERT INTO books (title, author, genre, total_copies, available_copies)
                        VALUES (?, ?, ?, ?, ?)`, b);
        }
        console.log("Seeded " + sampleBooks.length + " books");
    }
}

// ---- helpers ----
function json(res, status, obj) {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(obj));
}

async function readBody(req) {
    return new Promise((resolve) => {
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", () => {
            try { resolve(JSON.parse(body || "{}")); }
            catch { resolve({}); }
        });
    });
}

// ---- routes ----
async function handleRequest(req, res) {
    const url = new URL(req.url, "http://localhost");
    const path = url.pathname.split("?")[0];

    // static frontend files
    if (req.method === "GET" && path === "/") return serveFile(res, "index.html", "text/html");
    if (req.method === "GET" && path === "/login.html") return serveFile(res, "login.html", "text/html");
    if (req.method === "GET" && path === "/functions.js") return serveFile(res, "functions.js", "text/javascript");

    // GET /api/books
    if (req.method === "GET" && path === "/api/books") {
        try {
            const { rows } = await exec("SELECT * FROM books ORDER BY title");
            return json(res, 200, rows);
        } catch (e) { return json(res, 500, { error: e.message }); }
    }

    // GET /api/reservations
    if (req.method === "GET" && path === "/api/reservations") {
        try {
            const { rows } = await exec(`SELECT reservations.id, reservations.book_id, reservations.user_name,
                                                 reservations.mobile, reservations.reserved_at,
                                                 books.title, books.author, books.genre
                                          FROM reservations
                                          JOIN books ON books.id = reservations.book_id
                                          ORDER BY reservations.reserved_at DESC`);
            return json(res, 200, rows);
        } catch (e) { return json(res, 500, { error: e.message }); }
    }

    // POST /api/reserve
    if (req.method === "POST" && path === "/api/reserve") {
        const { bookId, name, mobile } = await readBody(req);
        if (!bookId || !name || !mobile) return json(res, 400, { error: "bookId, name and mobile are required" });

        try {
            const { rows } = await exec("SELECT * FROM books WHERE id = ?", [bookId]);
            if (rows.length === 0) return json(res, 404, { error: "Book not found" });
            if (Number(rows[0].available_copies) <= 0) return json(res, 400, { error: "No copies available" });

            // take a copy + record the reservation
            await exec("UPDATE books SET available_copies = available_copies - 1 WHERE id = ?", [bookId]);
            const result = await exec("INSERT INTO reservations (book_id, user_name, mobile) VALUES (?, ?, ?)", [bookId, name, mobile]);

            return json(res, 200, { success: true, reservationId: result.lastInsertRowid });
        } catch (e) { return json(res, 500, { error: e.message }); }
    }

    // POST /api/login  (demo auth: any name, fixed demo password)
    if (req.method === "POST" && path === "/api/login") {
        const { name, password } = await readBody(req);
        const demoPassword = "1234"; // demo only — replace with real auth for production
        if (!name || !name.trim()) return json(res, 400, { error: "Name is required" });
        if (password !== demoPassword) return json(res, 401, { error: "Wrong password" });
        return json(res, 200, { success: true, name: name.trim() });
    }

    // DELETE /api/reservations/:id
    const delMatch = path.match(/^\/api\/reservations\/(\d+)$/);
    if (req.method === "DELETE" && delMatch) {
        const id = delMatch[1];
        try {
            const { rows } = await exec("SELECT * FROM reservations WHERE id = ?", [id]);
            if (rows.length === 0) return json(res, 404, { error: "Reservation not found" });

            // put the copy back, then delete the reservation
            await exec("UPDATE books SET available_copies = available_copies + 1 WHERE id = ?", [rows[0].book_id]);
            await exec("DELETE FROM reservations WHERE id = ?", [id]);

            return json(res, 200, { success: true });
        } catch (e) { return json(res, 500, { error: e.message }); }
    }

    json(res, 404, { error: "Not found" });
}

function serveFile(res, file, type) {
    fs.readFile(__dirname + "/" + file, (err, data) => {
        if (err) return json(res, 404, { error: "Not found" });
        res.writeHead(200, { "Content-Type": type });
        res.end(data);
    });
}

// ---- start ----
setupDatabase()
    .then(() => {
        const PORT = Number(env.PORT || 3000);
        http.createServer(handleRequest).listen(PORT, () => {
            console.log("Server running at http://localhost:" + PORT);
        });
    })
    .catch((error) => {
        console.error("Database setup failed:", error.message);
        process.exit(1);
    });
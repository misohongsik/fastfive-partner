const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Initialize Database Table
const initDb = async () => {
    try {
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS consulting_requests (
                id SERIAL PRIMARY KEY,
                company_name VARCHAR(255) NOT NULL,
                customer_name VARCHAR(255) NOT NULL,
                phone_number VARCHAR(50) NOT NULL,
                preferred_area VARCHAR(255),
                headcount INTEGER,
                move_in_date DATE,
                status VARCHAR(50) DEFAULT '신규',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;
        await db.query(createTableQuery);
        console.log('✅ Database table checked/created successfully');
    } catch (error) {
        console.error('❌ Error initializing database table:', error);
    }
};

initDb();

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../client/dist')));

// API 1: Submit Inquiry
app.post('/api/inquiry', async (req, res) => {
    try {
        const { company_name, customer_name, phone_number, preferred_area, headcount, move_in_date } = req.body;

        // Basic validation
        if (!company_name || !customer_name || !phone_number) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        const sql = `
            INSERT INTO consulting_requests 
            (company_name, customer_name, phone_number, preferred_area, headcount, move_in_date, status)
            VALUES ($1, $2, $3, $4, $5, $6, '신규')
            RETURNING id
        `;

        const result = await db.query(sql, [company_name, customer_name, phone_number, preferred_area, headcount, move_in_date]);

        res.status(201).json({ success: true, message: 'Inquiry submitted successfully', id: result.rows[0].id });
    } catch (error) {
        console.error('Error submitting inquiry:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// API 2: Get Admin List
app.get('/api/admin/list', async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM consulting_requests ORDER BY created_at DESC');
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching list:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// API 3: Update Status
app.patch('/api/admin/status', async (req, res) => {
    try {
        const { id, status } = req.body;

        if (!id || !status) {
            return res.status(400).json({ success: false, message: 'Missing id or status' });
        }

        const result = await db.query('UPDATE consulting_requests SET status = $1 WHERE id = $2', [status, id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Request not found' });
        }

        res.json({ success: true, message: 'Status updated successfully' });
    } catch (error) {
        console.error('Error updating status:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});

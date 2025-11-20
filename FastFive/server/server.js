const express = require('express');
const cors = require('cors');
const db = require('./db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

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
            VALUES (?, ?, ?, ?, ?, ?, '신규')
        `;

        const [result] = await db.execute(sql, [company_name, customer_name, phone_number, preferred_area, headcount, move_in_date]);

        res.status(201).json({ success: true, message: 'Inquiry submitted successfully', id: result.insertId });
    } catch (error) {
        console.error('Error submitting inquiry:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// API 2: Get Admin List
app.get('/api/admin/list', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM consulting_requests ORDER BY created_at DESC');
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

        const [result] = await db.execute('UPDATE consulting_requests SET status = ? WHERE id = ?', [status, id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Request not found' });
        }

        res.json({ success: true, message: 'Status updated successfully' });
    } catch (error) {
        console.error('Error updating status:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});

const express = require('express');
const { Pool } = require('pg');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const port = 3000;

// PostgreSQL connection
const pool = new Pool({
    user: 'your_username',
    host: 'localhost',
    database: 'your_database',
    password: 'your_password',
    port: 5432,
});

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/save-results', async (req, res) => {
    const { set1, set2 } = req.body;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const insertQuery = `
            INSERT INTO survey_results (set1_answers, set2_answers, created_at)
            VALUES ($1, $2, NOW())
        `;

        await client.query(insertQuery, [JSON.stringify(set1), JSON.stringify(set2)]);

        await client.query('COMMIT');
        res.send('Results saved successfully');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Error saving results:', e);
        res.status(500).send('Error saving results');
    } finally {
        client.release();
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
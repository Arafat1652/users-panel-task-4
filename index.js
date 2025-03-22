const express = require('express');
require('dotenv').config();
const {Pool} = require('pg');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');

const app = express();
const port = process.env.PORT || 5000;


const corsOptions = {
    origin: [
      'http://localhost:5173','https://task-4-user-panel.netlify.app'],
    credentials: true,
    optionSuccessStatus: 200,
  }

// middleware
app.use(express.json())
app.use(cors(corsOptions));

// const pool = new Pool({
//     user: "postgres",
//     host: "localhost",
//     database: 'task4itransitiongroup',
//     password: "arpost165242",
//     port: 5432
// })

// task4itransitiongroup
// itransition-task-4
// console.log('pool1',pool);

const DATABASE_URL= `postgresql://task4itransitiongroup:pq0JriDWu5as9ZNIgdluORcFJpHyU1ni@dpg-cvf8s652ng1s73d3c490-a.oregon-postgres.render.com/task4itransitiongroup`

//  postgresql://task4itransitiongroup:pq0JriDWu5as9ZNIgdluORcFJpHyU1ni@dpg-cvf8s652ng1s73d3c490-a.oregon-postgres.render.com/task4itransitiongroup

const pool = new Pool({
    connectionString: DATABASE_URL, // Use the External Database URL here
    ssl: {
      rejectUnauthorized: false, // Required for Render's PostgreSQL
    },
  });

  console.log('pool2',pool);
  



// CREATE TABLE users (
//     id SERIAL PRIMARY KEY,
//     name VARCHAR(255) NOT NULL,
//     email VARCHAR(255) UNIQUE NOT NULL,
//     password VARCHAR(255) NOT NULL,
//     last_login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//     status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'blocked'))
//   )

// Routes

// User registration
app.post('/register', async (req, res) => {
    const { name, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        const result = await pool.query(
            'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING *',
            [name, email, hashedPassword]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') { // Unique constraint violation
            res.status(400).json({ message: 'Email already exists' });
        } else {
            res.status(500).json({ message: 'Server error' });
        }
    }
});


// User login
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // Fetch the user by email
        const user = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

        // Check if the user exists
        if (!user.rows[0]) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Compare the provided password with the hashed password in the database
        const isPasswordValid = await bcrypt.compare(password, user.rows[0].password);
        if (!isPasswordValid) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Check if the user is blocked
        if (user.rows[0].status === 'blocked') {
            return res.status(400).json({ message: 'User is blocked' });
        }

        // Update the last_login_time to the current timestamp
        await pool.query(
            'UPDATE users SET last_login_time = CURRENT_TIMESTAMP WHERE id = $1',
            [user.rows[0].id]
        );

        // Return the user data (excluding the password)
        const { password: _, ...userData } = user.rows[0]; // Exclude the password from the response
        res.json({ message: 'Login successful', user: userData });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});


app.get('/users', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, name, email, last_login_time, status FROM users ORDER BY last_login_time DESC');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/users/action', async (req, res) => {
    const { action, userIds, email } = req.body;
    console.log('je action tar eamil',email);
    
    

    try {
        let query;
        let values;

        const user = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

    // Check if the user is blocked
    if (user.rows[0].status === 'blocked') {
        return res.status(400).json({ message: 'User is blocked' });
    }

        if (action === 'delete') {
            query = 'DELETE FROM users WHERE id = ANY($1)';
            values = [userIds];
        } else if (action === 'block' || action === 'unblock') {
            // Map the action to the correct status
            const status = action === 'block' ? 'blocked' : 'active';
            query = 'UPDATE users SET status = $1 WHERE id = ANY($2)';
            values = [status, userIds];
        } else {
            return res.status(400).json({ message: 'Invalid action' });
        }

        await pool.query(query, values);
        res.json({ message: 'Action completed' });
    } catch (error) {
        console.error('Error performing action:', error);
        res.status(500).json({ message: 'Server error' });
    }
});


pool.connect((err, client, done) => {
    if (err) {
      console.error('Error connecting to the database:', err.message);
    } else {
      console.log('Successfully connected to the database');
      client.query('SELECT NOW()', (err, res) => {
        done();
        if (err) {
          console.error('Error executing query:', err.message);
        } else {
          console.log('Database time:', res.rows[0].now);
        }
      });
    }
  });


app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
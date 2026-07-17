// Import required modules
const express = require('express'); 
const mysql = require('mysql2'); 
const session = require('express-session');
const flash = require('connect-flash');
const app = express(); 
const multer = require ('multer');

const storage = multer.diskStorage({
destination: (req, file, cb) => {
cb(null, 'public/images'); 
},
filename: (req, file, cb) => {
cb(null, file.originalname); 
}
});
const upload = multer({ storage: storage });
 
const connection = mysql.createConnection({ 
    host: 'c237-meilan-mysql.mysql.database.azure.com', 
    user: 'c237_010', 
    password: 'c237010@2026!', 
    database: 'c237_010_team5_ca2_db',
    ssl: {
         rejectUnauthorized: false
    }   
}); 
connection.connect((err) => { 
    if (err) { 
        console.error('Error connecting to MySQL:', err); 
        return; 
    } 
    console.log('Connected to MySQL database'); 
}); 

app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    // Session expires after 1 day of inactivity
    cookie: {maxAge: 1000 * 60 * 60 * 24 }
}));

app.set('view engine', 'ejs'); 
app.use(express.static('public')); 
app.use(express.urlencoded ({
  extended: false
}));

app.use(flash());

// =============================================================================================================================
// Middleware 
// =============================================================================================================================

// Set Up login, registration, access control 
    // For access control (Check Admin, Check Group Owner + Admin, Check Group Owner + Member + admin)
        // Middleware to check if user is logged in
const checkAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next();
    } else {
        req.flash('error', 'Please log in to use this resource');
        res.redirect('/login');
    }
};

        // Admin Check (For the Admin's Dashboard entry)
const checkAdmin = (req, res, next) => {
    if (req.session.user.role === 'admin') {
    return next();
    } else {
    req.flash('error', 'Access denied');
    res.redirect('/');
    }
};

        // Check Group Owner + Admin (For the location group mod dashboard)
const checkGOwnerandAdmin = (req, res, next) => {
    const id = req.params.id
    if (req.session.user.role === 'admin') {
        return next();
    }
    if (req.session.user.role === "group_owner" && String(req.session.user.location_id) === String(id)) {
        return next();
    }
    req.flash('error', 'Access denied');
    res.redirect('/');
};

        // Check Group Owner + Member + admin (For sending messages in the location groups)
const checkGOwnerAdminandMember = (req, res, next) => {
    const id = req.params.id
    if (req.session.user.role === 'admin') {
        return next();
    }
    if (req.session.user.role === "group_owner" && String(req.session.user.location_id) === String(id)) {
        return next();
    }
    if (req.session.user.role === "group_member" && String(req.session.user.location_id) === String(id)) {
        return next();
    }
    req.flash('error', 'Access denied');
    res.redirect('/');
};

        // validate that the items entered are viable
const validateRegistration = (req, res, next) => {
    const { username, password, re_password } = req.body;
    if (!username || !password || !re_password) {
        req.flash('error', 'All fields are required.');
        req.flash('formData', req.body);
        return res.redirect('/register');
    }
    else if (password.length < 6) {
        req.flash('error', 'Passwords should be at least 6 or more characters long');
        req.flash('formData', req.body);
        return res.redirect('/register');
    }
    else if (password != re_password){
        req.flash('error', 'The two passwords are not the same.');
        req.flash('formData', req.body);
        return res.redirect('/register');
    }
    else {
        next();
    }
};

// =============================================================================================================================
// Home Page + Login + Registration Routes
// =============================================================================================================================

// Home page route
app.get('/', (req, res) => {
    res.render('home_page', { user: req.session.user, messages: req.flash('success')});
});

    // Route for login
app.get('/login', (req, res) => {
    res.render('login', { messages: req.flash('success'), errors: req.flash('error') });
});

    // Route for registration
app.get('/register', (req, res) => {
    res.render('register', { messages: req.flash('error'), formData: req.flash('formData')[0] });
});

    // Process login
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    // Validate email and password
    if (!username || !password) {
        req.flash('error', 'All fields are required.');
        return res.redirect('/login');
    }

    const sql = 'SELECT * FROM users WHERE username = ? AND password = SHA2(?, 256)';
    connection.query(sql, [username, password], (err, results) => {
        if (err) {
            throw err;
        }
        // Save the credentials into a session cookie
        if (results.length > 0) {
            // Successful login
            req.session.user = results[0]; 
            req.flash('success', 'Login successful!');
            res.redirect('/');
        
        } else {
            // Invalid credentials
            req.flash('error', 'Invalid email or password.');
            res.redirect('/login');
        }
    });
});

    // Process registration
app.post('/register',validateRegistration, (req, res) => {
    const {username, password} = req.body;
    const role = "normal_user"
    const sql = 'INSERT INTO users (username, password, role) VALUES (?, SHA2(?, 256), ?)';
    connection.query(sql, [username, password, role], (err, result) => {
        if (err) {
            throw err;
        }
        console.log(result);
        req.flash('success', 'Registration successful! Please log in.');
        res.redirect('/login');
    });
});

app.get('/profile', (req, res) => {
    res.render('profile', { user: req.session.user, messages: req.flash('success')});
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
});

// =============================================================================================================================
// Location Group Routes
// =============================================================================================================================



/* 
// Route: Edit of <>
// Show the search page with all stalls by default
app. get('/on-hold', (req, res) => {
  connection.query('SELECT * FROM stores', (err, results) => {
    if (err) throw err;
    res.render('results', { stalls: results, filters: {} });
  });
});

// Handle search + filters
app.post('/stalls', (req, res) => {
  const { search, location, cuisine, rating, price } = req.query;

  // Start with a base query, add conditions only for filters that were used
  let sql = 'SELECT * FROM stores WHERE 1=1';
  const values = [];

  if (search) {
    sql += ' AND (name LIKE ? OR description LIKE ?)';
    values.push('%' + search + '%', '%' + search + '%');
  }

  if (location) {
    sql += ' AND location = ?';
    values.push(location);
  }

  if (cuisine) {
    sql += ' AND cuisine = ?';
    values.push(cuisine);
  }

  if (rating) {
    sql += ' AND rating >= ?';
    values.push(rating);
  }

  if (price) {
    sql += ' AND price_range = ?';
    values.push(price);
  }

  // '?' placeholders instead of pasting values straight into the string
  // is what keeps this safe from SQL injection
  connection.query(sql, values, (err, results) => {
    if (err) throw err;
    res.render('results', { stalls: results, filters: req.query });
  });
});

// Route: Delete of <>


// Route: Sorting of <> 

*/



const PORT = process.env.PORT || 3000; 
app.listen(PORT, () => console.log(`Server running on port http://localhost:${PORT}`)); 

// Additional features: 
//    - ???

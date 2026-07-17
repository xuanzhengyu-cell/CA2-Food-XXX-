// Note: Our Theme will be on Food Store

// Assets
// - 4 sql tables: one for username + password +  user id + roles + location id (if any) 
//                 one for location id, location name
//                 one for messages id, location id, owner_id, sender_id, text, date, likes
//                 one for comments id, user id,  comments text
// - 4 (? may add more) positions. 
// - Projected pages: Login page, Home page (*display all groups existing + admin messages), Group page (to display data), Adding page, Editing page, 
//                    Admin's Page (for site mods), Group Owner Page (for group page mods), (? more to be added), User Page (for personal mods)

//   - Typically: 
    //    - Site Admins can CRUD everything and grant other users up to Admin permissions. 
    //      - They can post messages onto the main home page that only group owners and admins can see. 
    //      - They can also hold permission to create a new group. 
    //      - They can kick and add users into groups freely.  
    //      - They are the site admins. 
    //
    //    - Group Owners can CRUD everything in their group, but will have the same privilege in other groups as per normal users. 
    //      - They can give others permission up to group owner ONLY for their OWN group.
    //      - They can ONLY kick and add people into their OWN group. 
    //      - They are the location shop owners (Lot One, Jurong Point etc). 
    //
    //    -  Group Members can CRUD their OWN messages in the group they belong to, and the rest is the same as a group user. 
    //      - They are the shop/stall owners (McDonald's, KFC, etc)
    //
    //    -  Normal users can: 
    //      - They can CRUD their own comments 
    //      - They are the normal users of the website. 
    // 
    //    - Non-authorised users can only read; they cannot do anything else. 

//    - Regardless, remember to ensure that the SQL table (for data) can accept it.  
// Note that the encryption of the password is SHA2 (?, 256)


// Import required modules
const express = require('express'); 
const mysql = require('mysql2'); 
const session = require('express-session');
const flash = require('connect-flash');
const app = express(); 
const multer = require ('multer');

// Set up multer for file uploads
const storage = multer.diskStorage({
destination: (req, file, cb) => {
cb(null, 'public/images'); 
},
filename: (req, file, cb) => {
cb(null, file.originalname); 
}
});
const upload = multer({ storage: storage });
 
// Create MySQL connection 
const connection = mysql.createConnection({ 
    host: 'localhost', 
    user: 'root', 
    password: 'RP738964$', 
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

/* 
side note:
- Table 1: users
  - user_id
  - username
  - password
  - role (admin / group_owner / group_member / normal_user)
  - location_id (Can be left empty)

- Table 2: location
  - location_id
  - location_name

- Table 3: messages
  - messages_id
  - location_id (The page that has the message)
  - sender_id (user_id of the user who sent the message)
  - message_text
  - date
  - likes

- Table 4: comments 
  - comments_id
  - sender_id
  - owner_id (The user whose page has this comment)
  - comments_text
  - date 
*/

// Session Creation
app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    // Session expires after 1 day of inactivity
    cookie: {maxAge: 1000 * 60 * 60 * 24 }
}));

// Set up view engine 
app.set('view engine', 'ejs'); 
//  enable static files 
app.use(express.static('public')); 
app.use(express.urlencoded ({
  extended: false
}));
 
app.use(flash());

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
    res.redirect('/dashboard');
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
    res.redirect('/dashboard');
};

        // Check Group Owner + Member + admin (For sending messages in the location groups)
const checkGOwnerandAdmin = (req, res, next) => {
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
    res.redirect('/dashboard');
};

    // Route for login
app.get('/login', (req, res) => {
    res.render('login', { messages: req.flash('success'), errors: req.flash('error') });
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


    // Route for registration
app.get('/register', (req, res) => {
    res.render('register', { messages: req.flash('error'), formData: req.flash('formData')[0] });
});

        // validate that the items entered are viable
const validateRegistration = (req, res, next) => {
    const { username, password, re_password } = req.body;
    if (!username || !password || !re_password) {
        return res.send('All fields are required.');
    }
    if (password.length < 6) {
        req.flash('error', 'Password should be at least 6 or more characters long');
        req.flash('formData', req.body);
        return res.redirect('/register');
    }
    if (password != re_password)
        return res.send('Password are not the same.');
next();
};

    // Process registration
app. post('/register',validateRegistration, (req, res) => {
    const {username, password} = req.body;
    const role = "normal_user"
    const sql = 'INSERT INTO users (username, password, role) VALUES (?, SHA2(?, 256), ?)';
    db.query(sql, [username, password, role], (err, result) => {
        if (err) {
            throw err;
        }
        console.log(result);
        req.flash('success', 'Registration successful! Please log in.');
        res.redirect('/login');
    });
});

// Route: Edit of <>
// Show the search page with all stalls by default
app. get('/', (req, res) => {
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





const PORT = process.env.PORT || 3000; 
app.listen(PORT, () => console.log(`Server running on port http://localhost:${PORT}`)); 

// Additional features: 
//    - ???

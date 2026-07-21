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

const locationIDs_Find = (req, res, next) => {
    res.locals.location_ids = []; 
    res.locals.user = req.session.user || null;

if (req.session.user) {
        const user_id = req.session.user.user_id;
        const sql = `SELECT location.location_id, location.location_name 
                     FROM location 
                     INNER JOIN users_has_location 
                     ON location.location_id = users_has_location.location_id 
                     WHERE user_id = ?`;            
        connection.query(sql, [user_id], (err, results) => {
            if (err) {
                throw err;
            } else {
                res.locals.location_ids = []; 
                res.locals.user = req.session.user || null;
                res.locals.location_ids = results;
                return next();
            }
            })
    } else {
        next();
    }
};

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
app.get('/', locationIDs_Find, (req, res) => {
    const { search } = req.query;

    let sql = 'SELECT * FROM location WHERE 1=1';
    const values = [];

    if (search) {
        sql += ' AND location_name LIKE ?';
        values.push('%' + search + '%');
    }

    connection.query(sql, values, (err, results) => {
        if (err) throw err;
        res.render('Home_Page', { locations: results, search: search || '' });
    });
});

    // Route for login
app.get('/login', locationIDs_Find, (req, res) => {
    res.render('HP_login', { messages: req.flash('success'), errors: req.flash('error')});
});

    // Route for registration
app.get('/register', locationIDs_Find, (req, res) => {
    res.render('HP_register', { messages: req.flash('error'), formData: req.flash('formData')[0] });
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

app.get('/profile', locationIDs_Find, (req, res) => {
    req.
    res.render('HP_profile', {});
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
});

// =============================================================================================================================
// Access to Dashboards Routes
// =============================================================================================================================

app.get('/admin_dashboard', checkAuthenticated, locationIDs_Find, checkAdmin, (req, res) => {
    res.render('HP_admin_dashboard', {});
});

app.get('/location/:id/message', checkAuthenticated, locationIDs_Find, checkGOwnerAdminandMember, (req, res) => {
    const location_id = parseInt(req.params.id);
    res.render('GP_message_create', 
        {});
});

// =============================================================================================================================
// Input of data
// =============================================================================================================================

// Display all existing location groups- added by cy
app.get('/groups', (req, res) => {

    const sql = "SELECT * FROM location";

    connection.query(sql, (err, results) => {
        if (err) {
            throw err;
        }

        res.render("AD_groups_lists", {
            locations: results
        });
    });
})

app.post('/user/:id/comment_create', checkAuthenticated, checkGOwnerAdminandMember, (req, res) => {
    const id = parseInt(req.params.id);
    const {comment} = req.body;

    if (!comment) {
        req.flash('error', 'Comments cannot be empty');
        return res.redirect(`/user/${id}`);
    }

    const owner_id = id
    const sender_id = req.session.user.user_id
    let date = new Date().toISOString().split('T')[0];
    const sql = 'INSERT INTO comments (sender_id, owner_id, comments_text, date) VALUES (?, ?, ?, ?)';
    connection.query(sql, [sender_id, owner_id, comment, date], (err, result) => {
        if (err) {
            throw err;
        }
        console.log(result);
        res.redirect(`/user/${id}`);
    });
});

app.get('/user/:id/comment_create', checkAuthenticated, (req, res) => {
    const id = req.params.id;

    const sql = 'SELECT * FROM users WHERE user_id = ?';

    connection.query(sql, [id], (err, results) => {
        if (err) throw err;

        res.render('comment_create', {
            user: results[0]
        });
    });
});
// =============================================================================================================================
// Location Group Routes
// =============================================================================================================================

// Get location page (dynamic)
app.get('/location/:id', locationIDs_Find, (req, res) => {
    const id = parseInt(req.params.id);

    const sql = 'SELECT * FROM location WHERE location_id = ?';
    connection.query(sql, [id], (err, results_l) => {
        if (err) {
            throw err;
        } else {
        let location_name = results_l[0].location_name; 
        const sql = 'SELECT * FROM messages WHERE location_id = ?';
        connection.query(sql, [id], (err, results_m) => {
            if (err) {
                throw err;
            } else {
                let messages = results_m
                const location_id = id
                res.render('GP_location', 
                    { location_id, location_name, messages});
            }
        });
        }
    });
});

// Get list of group members (display + click user to go to their page ONLY)
app.get('/location_members/:id', locationIDs_Find, (req, res) => {
    const id = parseInt(req.params.id);

    const sql = 'SELECT * FROM location WHERE location_id = ?';
    connection.query(sql, [id], (err, results_l) => {
        if (err) {
            throw err;
        } else {
        let location_name = results_l[0].location_name; 
        const sql = 'SELECT users.users_id, users.username FROM users_has_location INNER JOIN users ON users_has_location.user_id = users.users_id WHERE location_id = ?';
        connection.query(sql, [id], (err, results_m) => {
            if (err) {
                throw err;
            } else {
                let messages = results_m
                const location_id = id
                res.render('GP_Group_Members', 
                    {location_id, location_name, messages});
            }
        });
        }
    });
});

// get user page (dynamic)
app.get('/user/:id', locationIDs_Find, (req, res) => {
    const id = parseInt(req.params.id);
    const user_id = id
    const sql = 'SELECT * FROM users WHERE user_id = ?';
    connection.query(sql, [user_id], (err, results_l) => {
        if (err) {
            throw err;
        } else {
        let username = results_l[0].username; 
        const sql = 'SELECT * FROM comments WHERE owner_id = ?';
        connection.query(sql, [user_id], (err, results_m) => {
            if (err) {
                throw err;
            } else {
                let comments = results_m
                res.render('GP_user', 
                    {user_id, username, comments});
            }
        });
        }
    });
});

// get location members list
app.get('/location/members/:id', locationIDs_Find, (req, res) => {
    const id = parseInt(req.params.id);
    const location_id = id
    const sql = 'SELECT users.user_id, users.username FROM users INNER JOIN users_has_location ON users.user_id = users_has_location.user_id WHERE location_id = ?';
    connection.query(sql, [user_id], (err, results_l) => {
        if (err) {
            throw err;
        } else {
        let user_list = results_l[0]; 
        res.render('GP_user', {user_id, user_list, comments});

        }
    });
});

// =============================================================================================================================
// Route: Edit of <>
// =============================================================================================================================

// Edit of profile
app.get('/profile/edit', checkAuthenticated, locationIDs_Find, (req, res) => {
    const id = req.session.user.user_id

    const sql = "SELECT * FROM users WHERE user_id = ?";
 
    connection.query(sql, [id], (err, results) => {
        if (err) throw err;
        if (results.length === 0) {
            return res.redirect('/profile');
             }

        res.render('HP_P_edit_user', {});
    });
});
    

// post of edit_user (may remove the ability to edit ur role based on future discussion.)
app.post('/profile/edit', checkAuthenticated, (req, res) => {
    const id = req.params.id;

    if (req.session.user.user_id != id && req.session.user.role !== "admin") {
        req.flash('error', 'Access denied');
        return res.redirect('/profile');
    }

    const { username, password, role } = req.body;
    const sql = `
        UPDATE users
        SET username = ?, password = SHA2(?,256), role = ?
        WHERE user_id = ?
    `;
    connection.query(sql, [username, password, role, id], (err) => {

        if (err) {
            throw err
        };

        req.session.user.username = username;
        req.session.user.role = role;// may remove this based on future discussion.
        req.flash('success', 'Profile updated successfully.');
        res.redirect('/profile');

    });
});


// edit for location (get)
app.get('/location/edit/:id', checkAuthenticated, locationIDs_Find, checkGOwnerandAdmin, (req, res) => {

    const id = req.params.id;
    const sql = "SELECT * FROM location WHERE location_id = ?";

    connection.query(sql, [id], (err, results) => {

        if (err) throw err;

        if (results.length === 0) {
            req.flash('error', 'Location not found.');
            return res.redirect('/');
        }

        res.render('GP_Owner_dashboard', {
            location: results[0],
        });
    });
});


// edit for location (post)
app.post('/location/edit/:id', checkAuthenticated, (req, res) => {

    const id = req.params.id;
    const { location_name } = req.body;
    const sql = `
        UPDATE location
        SET location_name = ?
        WHERE location_id = ?
    `;

    connection.query(sql, [location_name, id], (err) => {
        if (err) throw err;

        req.flash('success', 'Location updated successfully.');
        res.redirect('/');

    });
});



//edit message (get)
app.get('/message/edit/:id', checkAuthenticated, (req, res) => {

    const id = req.params.id;
    const sql = "SELECT * FROM messages WHERE messages_id = ?";

    connection.query(sql, [id], (err, results) => {

        if (err) throw err;

        if (results.length === 0) {
            req.flash('error', 'Message not found.');
            return res.redirect('/');
        }

        res.render('edit_message', {
            message: results[0],
            logged_in
        });
    });
});


//edit for message (Post)
app.post('/message/edit/:id', checkAuthenticated, (req, res) => {

    const id = req.params.id;
    const { text } = req.body;
    const sql = `
        UPDATE messages
        SET
            text = ?,
            date = CURDATE(),
            likes = 0
        WHERE messages_id = ?
    `;

    connection.query(sql, [text, id], (err) => {

        if (err) throw err;

        req.flash('success', 'Message updated successfully.');
        res.redirect('/');

    });
});


//edit for comments get route
app.get('/comment/edit/:id', checkAuthenticated, checkGOwnerAdminandMember, (req, res) => {

    const id = req.params.id;
    const sql = "SELECT * FROM comments WHERE comments_id = ?";

    connection.query(sql, [id], (err, results) => {
        if (err) throw err;
        if (results.length === 0) {
            req.flash('error', 'Comment not found.');
            return res.redirect('/');
        }

        res.render('edit_comment', {
            comment: results[0],
            logged_in
        });
    });
});


//edit for comment post route
app.post('/comment/edit/:id', checkAuthenticated, checkGOwnerAdminandMember, (req, res) => {

    const id = req.params.id;
    const { comments_text } = req.body;
    const sql = `
        UPDATE comments
        SET comments_text = ?
        WHERE comments_id = ?
    `;

    connection.query(sql, [comments_text, id], (err) => {
        if (err) throw err;
        req.flash('success', 'Comment updated successfully.');
        res.redirect('/');

    });
});

// Edit Members page- cy
app.get('/edit_members', checkAuthenticated, checkAdmin, (req, res) => {
    res.render('edit_members');
});


// =============================================================================================================================
// Route: search for XXX, by YYY
// =============================================================================================================================


const PORT = process.env.PORT || 3000; 
app.listen(PORT, () => console.log(`Server running on port http://localhost:${PORT}`)); 

// Additional features: 
//    - ???

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
                        LEFT JOIN users_has_location 
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
// Home Page Routes
// =============================================================================================================================

app.get('/', locationIDs_Find, (req, res) => {
    const { search } = req.query;

    let sql1 = 'SELECT * FROM location WHERE 1=1';
    const values = [];

    if (search) {
        sql1 += ' AND location_name LIKE ?';
        values.push('%' + search + '%');
    }

    connection.query(sql1, values, (err, results) => {
        if (err) {
            throw err
        } else {
            const locations = results
            const sql = `
                SELECT text FROM announcments`
            connection.query(sql, (err, results) => {
                if (err) {
                    console.error('Failed:', err.message);
                } else {
                    const announcments = results[0]
                    res.render('Home_Page', { locations, search: search || '' , announcments}) 
                }
            })
        };
    });
});



// =============================================================================================================================
// Login + Registration Routes
// =============================================================================================================================

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

    const sql = `
        SELECT users.user_id, users.role, users_has_location.group_role
        FROM users 
        LEFT JOIN users_has_location ON users_has_location.user_id = users.user_id 
        WHERE users.username = ? AND users.password = SHA2(?, 256)`;
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
    const details = "No details entered yet...."
    const images = "null"
    const sql = 'INSERT INTO users (username, password, role, details, image) VALUES (?, SHA2(?, 256), ?, ?, ?)';
    connection.query(sql, [username, password, role, details, images], (err, result) => {
        if (err) {
            throw err;
        }
        console.log(result);
        req.flash('success', 'Registration successful! Please log in.');
        res.redirect('/login');
    });
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
});



// =============================================================================================================================
// Profile Routes
// =============================================================================================================================

app.get('/profile', checkAuthenticated, locationIDs_Find, (req, res) => {
    const id = req.session.user.user_id;

    const userSql = "SELECT * FROM users WHERE user_id = ?";
    const commentSql = "SELECT * FROM comments";

    connection.query(userSql, [id], (err, userResult) => {
        if (err) throw err;

        connection.query(commentSql, (err, commentResult) => {
            if (err) throw err;

            res.render('HP_profile', {
                users: userResult[0],
                comments: commentResult
            });
        });
    });
});

// Edit of profile
app.get('/profile/edit', checkAuthenticated, locationIDs_Find, (req, res) => {
    const id = req.session.user.user_id

    const sql = "SELECT * FROM users WHERE user_id = ?";
 
    connection.query(sql, [id], (err, results) => {
        if (err) throw err;
        if (results.length === 0) {
            return res.redirect('/profile');
             }

        res.render('HP_P_edit_user', {
         user: results[0]
        });
    });
});

// post of edit_user (may remove the ability to edit ur role based on future discussion.)
app.post('/profile/edit', checkAuthenticated, locationIDs_Find, upload.single('image'), (req, res) => {
    const id = req.session.user.user_id;
    const { username } = req.body;

    let image;
    if (req.file) {
        image = req.file.filename; // Save only the filename
    } else {
        image = "null";
    }
    const sql = `
        UPDATE users
        SET username = ?, image = ?
        WHERE user_id = ?
    `;
    connection.query(sql, [username, image, id], (err) => {

        if (err) {
            console.log(err) 
        };
        req.session.user.username = username;
        req.flash('success', 'Profile updated successfully.'); 
        res.redirect('/profile');
    });
});

app.post('/profile/password', checkAuthenticated, locationIDs_Find, (req, res) => {
    const id = req.session.user.user_id;
    const { password } = req.body;

    const sql = `
        UPDATE users
        SET password = SHA2 (?, 256)
        WHERE user_id = ?
    `;
    connection.query(sql, [password, id], (err) => {

        if (err) {
            console.log(err) 
        };
        req.flash('success', 'Profile updated successfully.'); 
        res.redirect('/profile');
    });
});



// =============================================================================================================================
// Admin Dashboard Routes
// =============================================================================================================================
// Admin Check (For the Admin's Dashboard entry)
const checkAdmin = (req, res, next) => {
    if (req.session.user.role === 'admin') {
    return next();
    } else {
    req.flash('error', 'Access denied');
    res.redirect('/');
    }
};

app.get('/admin_dashboard', checkAuthenticated, checkAdmin, locationIDs_Find, (req, res) => {
    const sql = `
        SELECT text FROM announcments`
    connection.query(sql, (err, results) => {
        if (err) {
            console.error('Failed:', err.message);
        } else {
            res.render('HP_admin_dashboard', {announcement: results [0]});
        }
    })    
});

app.post('/announcement', (req, res) => {
    const {announcement} = req.body
    const id = 1
    const sql1 = `
        UPDATE announcments
        SET text = ?
        WHERE announcments_id = ?`
    connection.query(sql1, [announcement, id], (err) => {
        if (err) {
            console.error('Failed:', err.message);
        } else {
            res.redirect ('/')
        }
    })
})

app.post('/clear_announcement', (req, res) => {
    const announcement = ""
    const id = 1
    const sql1 = `
        UPDATE announcments
        SET text = ?
        WHERE announcments_id = ?`
    connection.query(sql1, [announcement, id], (err) => {
        if (err) {
            console.error('Failed:', err.message);
        } else {
            res.redirect ('/admin_dashboard')
        }
    })
})

// Display all existing location groups
app.get('/groups', checkAuthenticated, locationIDs_Find,  (req, res) => {
    const sql = "SELECT * FROM location";
    connection.query(sql, (err, results) => {
        if (err) {
            console.error('Failed:', err.message);
        }
        const locations = results
        const sql = `SELECT user_id, username, role FROM users`
        connection.query(sql, [], (err, results) => {
            if (err) {
                console.log(err)
            } else {
                const users = results 
                res.render("AD_groups_lists", {locations, users});
            }
        })
    });
    
})

app.post('/create_location', upload.single('image'), (req, res) => {
    const {location_name, user_id} = req.body
    
    let image;
    if (req.file) {
        image = req.file.filename; // Save only the filename
    } else {
        image = null;
    }
    
    const sql = `
        INSERT INTO location (location_name, Images)
        VALUES (?, ?)`
    connection.query(sql, [location_name, image], (err) => {
        if (err) {
            console.log('Failed:', err.message);
        } else {
            const sql = `
                SELECT location_id 
                FROM location
                WHERE location_name = ?`
            connection.query (sql, [location_name], (err, results) => {
                if (err) {
                    console.log(err)
                } else {
                    const location_id = results[0].location_id
                    const role = "group_owner"
                    const sql = `
                        INSERT INTO users_has_location (location_id, user_id, group_role)
                        VALUES (?, ?, ?)`
                    connection.query (sql, [location_id, user_id, role], (err) => {
                        if (err) {
                            console.log(err)
                        } else {
                            res.redirect("/groups")
                        }
                    }) 
                }
            })
        }
    })
})

app.post('/delete_location/:id', (req, res) => {
    const id = req.params.id;
    const sql1 = `
        UPDATE users 
        INNER JOIN users_has_location ON users_has_location.user_id = users.user_id 
        SET users.role = "normal_user"
        where users_has_location.location_id = ?`
    connection.query (sql1, [id],(err) => {
        if (err) {
            console.error('Failed:', err.message);
        }
    })

    const sql2 = `DELETE location, messages, users_has_location 
        FROM location 
        LEFT JOIN messages ON location.location_id = messages.location_id 
        LEFT JOIN users_has_location ON location.location_id = users_has_location.location_id
        WHERE location.location_id = ?
    `;
    connection.query (sql2, [id],(err) => {
        if (err) {
            console.error('Failed:', err.message);
        } else {
            req.flash('success', 'Group deleted successfully.');
            res.redirect('/groups');
        }
    });
});

// Display all existing users
app.get('/users', checkAuthenticated, locationIDs_Find, (req, res) => {
    const sql = "SELECT * FROM users";
    connection.query(sql, (err, results) => {
        if (err) {
            console.error('Failed:', err.message);
        }
        res.render("AD_users_lists", {users: results});
    });
})

app.post('/admin/changeName/:id', (req, res) => {
    const id = parseInt(req.params.id)
    const {username} = req.body

    const sql = `
        UPDATE users 
        SET username = ?
        WHERE user_id = ?`
    connection.query(sql, [username, id], (err) => {
        if (err) {
            console.error('Failed:', err.message)
        } else {
            res.redirect("/users")
        }
    })
})

app.post('/admin/changePassword/:id', (req, res) => {
    const id = parseInt(req.params.id)
    const {password} = req.body

    const sql = `
        UPDATE users 
        SET password = SHA2 (?, 256)
        WHERE user_id = ?`
    connection.query(sql, [password, id], (err) => {
        if (err) {
            console.error('Failed:', err.message)
        } else {
            res.redirect("/users")
        }
    })
})

app.post('/admin/changeRole/:id', (req, res) => {
    const id = parseInt(req.params.id)
    const {role} = req.body

    const sql = `
        UPDATE users 
        SET role = ?
        WHERE user_id = ?`
    connection.query(sql, [role, id], (err) => {
        if (err) {
            console.error('Failed:', err.message)
        } else {
            res.redirect("/users")
        }
    })
})

app.post('/admin/deleteUser/:id', (req, res) => {
    const id = parseInt(req.params.id)

    const sql = `
        DELETE users, users_has_location, comments, messages
        FROM users 
        LEFT JOIN users_has_location ON users.user_id = users_has_location.user_id 
        LEFT JOIN comments ON comments.owner_id = users.user_id
        LEFT JOIN messages ON messages.sender_id = users.user_id
        WHERE users.user_id = ?`
    connection.query(sql, [id], (err) => {
        if (err) {
            console.error('Failed:', err.message)
        } else {
            res.redirect("/users")
        }
    })
})



// =============================================================================================================================
// Location Route
// =============================================================================================================================

const admin_group_owner_or_member = (req, res, next) => {
    const user_id = req.session.user?.user_id
    const location_id = parseInt(req.params.id);

    const sql1 = `
        SELECT users.role
        FROM users 
        WHERE users.user_id = ?`
    connection.query(sql1, [user_id], (err, result) => {
        if (err) {
            console.log (err)
        } else {
            req.userRoles = result[0]
            const sql1 = `
                SELECT users_has_location.group_role
                FROM users_has_location 
                WHERE users_has_location.user_id = ? and users_has_location.location_id = ?`
            connection.query(sql1, [user_id, location_id], (err, result) => {
                if (err) {
                    console.log (err)
                } else {
                    req.userGroupRoles = result[0]
                    return next()
                }
            })
        }
    })
};

// Get location page (dynamic)
app.get('/location/:id', locationIDs_Find, admin_group_owner_or_member, (req, res) => {
    const id = parseInt(req.params.id);

    const sql = 'SELECT * FROM location WHERE location_id = ?';
    connection.query(sql, [id], (err, results_l) => {
        if (err) {
            console.log(err);
        } else {
        let location_name = results_l[0].location_name; 
        const sql = 'SELECT * FROM messages WHERE location_id = ?';
        connection.query(sql, [id], (err, results_m) => {
            if (err) {
                console.log(err);
            } else {
                let messages = results_m
                const location_id = id
                res.render('GP_location', 
                    { location_id, location_name, messages, userRoles: req.userRoles, userGroupRoles: req.userGroupRoles});
            }
        });
        }
    });
});



// =============================================================================================================================
// Location (Message) Routes
// =============================================================================================================================

// Check Group Owner + Member + admin (For sending messages in the location groups)
const checkGOwnerAdminandMember = (req, res, next) => {
    const location_id = req.params.location_id || req.params.id;
    const user_id = req.session.user?.user_id;

    if (req.session.user?.role === 'admin') {
        return next();
    }

    const sql = `SELECT group_role FROM users_has_location WHERE user_id = ? AND location_id = ?`;
    connection.query(sql, [user_id, location_id], (err, results) => {
        if (err || results.length === 0) {
            req.flash('error', 'Access denied');
            return res.redirect(`/location/${location_id}`);
        }

        const role = results[0].group_role;
        if (role === 'group_owner' || role === 'group_member') {
            return next();
        }

        req.flash('error', 'Access denied');
        res.redirect(`/location/${location_id}`);
    });
};

app.get('/location/:location_id/message', checkAuthenticated, locationIDs_Find, checkGOwnerAdminandMember, (req, res) => {
    const location_id = parseInt(req.params.location_id);
    res.render('GP_message_create', {location_id: location_id});
});

app.post('/location/:location_id/message_create', checkAuthenticated, checkGOwnerAdminandMember, (req,res) => {
    const location_id = parseInt(req.params.location_id);
    const sender_id = req.session.user.user_id
    const {title, content} = req.body 
    const sql = `
        INSERT INTO messages (location_id, sender_id, title, text)
        VALUES (?, ?, ?, ?)`
    connection.query(sql, [location_id, sender_id, title, content], (err) => {
        if (err) {
            console.log (err);
        } else {
            res.redirect (`/location/${location_id}`)
        }
    })
})

app.get('/location/:location_id/message/edit/:message_id', checkAuthenticated, locationIDs_Find, checkGOwnerAdminandMember, (req, res) => {
    const message_id = parseInt(req.params.message_id); 
    const location_id = parseInt(req.params.location_id); 
    const sql = `
        SELECT * 
        FROM messages 
        WHERE location_id = ? AND messages_id = ?`;
    connection.query (sql, [location_id, message_id], (err, results) =>{
        if (err) {
            console.log(err);
        } else {
            const message = results [0]
            res.render ('GP_edit_message', {message})
        }
    })
})

app.post('/location/:location_id/message/edit/:message_id', checkAuthenticated, checkGOwnerAdminandMember, (req, res) => {
    const message_id = parseInt(req.params.message_id); 
    const location_id = parseInt(req.params.location_id); 
    const {title, content} = req.body
    const sql = `
        UPDATE messages 
        SET title = ?, text = ?
        WHERE location_id = ? AND messages_id = ?`
    connection.query(sql, [title, content, location_id, message_id], (err) =>{
        if (err) {
            console.log (err) 
        } else {
            res.redirect (`/location/${location_id}`)
        }
    })
})

app.post('/location/:location_id/message/delete/:message_id', checkAuthenticated, locationIDs_Find, checkGOwnerAdminandMember, (req, res) => {
    const message_id = parseInt(req.params.message_id); 
    const location_id = parseInt(req.params.location_id); 
    const sql = `
        DELETE FROM messages
        WHERE location_id = ? AND messages_id = ?`
    connection.query(sql, [location_id, message_id], (err) =>{
        if (err) {
            console.log(err)
        } else {
            res.redirect (`/location/${location_id}`)
        }
    })
})



// =============================================================================================================================
// Location (Members) Routes
// =============================================================================================================================

// Get list of group members (display + click user to go to their page ONLY)
app.get('/location_members/:id', checkAuthenticated, locationIDs_Find, (req, res) => {
    const location_id = parseInt(req.params.id);

    const sql = 'SELECT location_name FROM location WHERE location_id = ?';
    connection.query(sql, [location_id], (err, results_l) => {
        if (err) {
            console.log (err);
        } else {
        let location_name = results_l[0].location_name; 
        const sql = `
            SELECT users.user_id, users.username, users_has_location.group_role
            FROM users_has_location 
            LEFT JOIN users ON users_has_location.user_id = users.user_id 
            WHERE location_id = ?`;
        connection.query(sql, [location_id], (err, results_m) => {
            if (err) {
                console.log (err)
            } else {
                let users = results_m
                res.render('GP_Group_Members', 
                    {location_id, location_name, users});
            }
        });
        }
    });
});

app.post ('/request/location/:id', checkAuthenticated, (req, res) => {
    const location_id = parseInt(req.params.id);
    const user_id = req.session.user.user_id
    const group_role = "normal_user"
    const sql = `
        INSERT INTO users_has_location (user_id, location_id, group_role)
        VALUES (?, ?, ?)`
    connection.query (sql, [user_id, location_id, group_role], (err) =>{
        if (err) {
            console.log (err)
            res.redirect (`/location_members/${location_id}`)
        } else {
            res.redirect (`/location_members/${location_id}`)
        }
    })
})



// =============================================================================================================================
// Location (Dashboard) Routes
// =============================================================================================================================
// Check Group Owner + Admin (For the location group mod dashboard)
const checkGOwnerandAdmin = (req, res, next) => {
    const location_id = req.params.id
    if (req.session.user.role === 'admin') {
        return next();
    }
    const sql = `SELECT group_role FROM users_has_location WHERE user_id = ?`
    connection.query (sql, [req.session.user.user_id], (err, results) => {
        if (err) {
            console.log (err)
        } else {
            const group_role = results [0]
            if (group_role === "group_owner" && String(req.session.user.location_id) === String(location_id)) {
                return next();
            }
            req.flash('error', 'Access denied');
            res.redirect('/');
        }
    })
};

// Group owner Dashboard for location (get)
app.get('/location/edit/:location_id', checkAuthenticated, locationIDs_Find, checkGOwnerandAdmin, (req, res) => {
    const location_id = req.params.location_id;
    const sql = "SELECT * FROM location WHERE location_id = ?";
    connection.query(sql, [location_id], (err, results) => {

        if (err) {
            throw err

        } else if (results.length === 0) {
            req.flash('error', 'Location not found.');
            return res.redirect('/');

        } else {
            const location = results[0]
            const sql = `
                SELECT users.user_id, users.username, users_has_location.group_role
                FROM users 
                LEFT JOIN users_has_location ON users_has_location.user_id = users.user_id
                WHERE users_has_location.location_id = ?`
            connection.query(sql, [location_id], (err, results) => {
                if (err) {
                    console.error('Failed:', err.message);
                } else {
                    const users = results
                    res.render('GP_Owner_dashboard', {location, users});
                }
            })
        }
    });
});

// edit for location (post)
app.post('/location/edit/:location_id', checkAuthenticated, checkGOwnerandAdmin, upload.single('image'), (req, res) => {
    const location_id = req.params.location_id;
    const { location_name } = req.body;
    let image;
    if (req.file) {
        image = req.file.filename; // Save only the filename
    } else {
        image = null;
    }
    const sql = `
        UPDATE location
        SET location_name = ?, Images = ?
        WHERE location_id = ?
    `;

    connection.query(sql, [location_name, image, location_id], (err) => {
        if (err) throw err;
        req.flash('success', 'Location updated successfully.');
        res.redirect(`/location/edit/${location_id}`);
    });
});

app.post('/location/edit/:location_id/changeRole/:user_id', checkAuthenticated, checkGOwnerandAdmin, (req, res) => {
    const user_id = parseInt(req.params.user_id); 
    const location_id = parseInt(req.params.location_id); 
    const {role} = req.body
    const sql = `
        UPDATE users_has_location 
        SET group_role = ?
        WHERE user_id = ? AND location_id = ?` 
    connection.query (sql, [role, user_id, location_id], (err) => {
        if (err) {
            console.log (err)
        } else {
            res.redirect (`/location/edit/${location_id}`)
        }
    }) 
})

app.post('/location/edit/:location_id/deleteUser/:user_id', checkAuthenticated, checkGOwnerandAdmin, (req, res) => {
    const user_id = parseInt(req.params.user_id); 
    const location_id = parseInt(req.params.location_id); 
    const sql = `
        DELETE FROM users_has_location 
        WHERE user_id = ? AND location_id = ?` 
    connection.query (sql, [user_id, location_id], (err) => {
        if (err) {
            console.log (err)
        } else {
            res.redirect (`/location/edit/${location_id}`)
        }
    }) 
})



// =============================================================================================================================
// User (Comments) Routes
// =============================================================================================================================

const admin_profile_owner_or_sender = (req, res, next) => {
    const user_id = req.session.user?.user_id
    const owner_id = parseInt(req.params.id);

    const sql1 = `
        SELECT users.role
        FROM users 
        WHERE users.user_id = ?`
    connection.query(sql1, [user_id], (err, result) => {
        if (err) {
            console.log (err)
        } else {
            req.userRoles = result[0]
            return next()
        }
    })
};

// get user page (dynamic)
app.get('/user/:id', locationIDs_Find, admin_profile_owner_or_sender, (req, res) => {
    const id = parseInt(req.params.id);
    const user_id = id
    const sql1 = 'SELECT users.username, users.image, users.details FROM users WHERE user_id = ?';
    connection.query(sql1, [user_id], (err, results_l) => {
        if (err) {
            console.log(err);
        } else {
        let users = results_l[0]; 
        const sql2 = 'SELECT * FROM comments WHERE owner_id = ?';
        connection.query(sql2, [user_id], (err, results_m) => {
            if (err) {
                console.log(err);
            } else {
                let comments = results_m
                const sql3 = `
                    SELECT users_has_location.location_id, users_has_location.group_role, location.location_name
                    FROM users_has_location
                    INNER JOIN location ON users_has_location.location_id = location.location_id
                    WHERE users_has_location.user_id = ?`
                connection.query(sql3, [user_id], (err, results) => {
                    if (err) {
                        console.log(err)
                    } else {
                        const locations = results 
                        res.render('GP_user', {user_id, users, comments, locations, userRoles: req.userRoles});
                    }
                })
            }
        });
        }
    });
});

app.get('/user/:owner_id/comment_create', checkAuthenticated, locationIDs_Find, (req, res) => {
    const id = req.params.owner_id;

    const sql = 'SELECT * FROM users WHERE user_id = ?';

    connection.query(sql, [id], (err, results) => {
        if (err) throw err;

        res.render('US_comment_create', {
            users: results[0]
        });
    });
});

app.post('/user/:id/comment_create', checkAuthenticated, (req, res) => {
    const id = parseInt(req.params.id);
    const {comment} = req.body;

    if (!comment) {
        req.flash('error', 'Comments cannot be empty');
        return res.redirect(`/user/${id}/comment_create`);
    }

    const owner_id = id
    const sender_id = req.session.user.user_id
    const date = new Date().toISOString().split('T')[0];
    const sql = 'INSERT INTO comments (sender_id, owner_id, comments_text, date) VALUES (?, ?, ?, ?)';
    connection.query(sql, [sender_id, owner_id, comment, date], (err, result) => {
        if (err) {
            throw err;
        }
        console.log(result);
        res.redirect(`/user/${id}`);
    });
});

//edit for comments get route
app.get('/user/:owner_id/comment/edit/:comments_id', checkAuthenticated, locationIDs_Find, (req, res) => {
    const owner_id = parseInt(req.params.owner_id);
    const comments_id = parseInt(req.params.comments_id);
    const sql = "SELECT * FROM comments WHERE comments_id = ? AND owner_id = ?";

    connection.query(sql, [comments_id, owner_id], (err, results) => {
        if (err) throw err;
        if (results.length === 0) {
            req.flash('error', 'Comment not found.');
            return res.redirect('/');
        }

        res.render('US_edit_comment', {
            comments: results[0],
        });
    });
});

//edit for comment post route
app.post('/user/:owner_id/comment/edit/:comments_id', checkAuthenticated, locationIDs_Find, (req, res) => {
    const owner_id = parseInt(req.params.owner_id);
    const comments_id = parseInt(req.params.comments_id);
    const { comments_text } = req.body;
    const sql = `
        UPDATE comments
        SET comments_text = ?
        WHERE comments_id = ? AND owner_id = ?
    `;
    connection.query(sql, [comments_text, comments_id, owner_id], (err) => {
        if (err) throw err;
        req.flash('success', 'Comment updated successfully.');
        res.redirect(`/user/${owner_id}`);
    });
});

app.post('/user/:owner_id/comment/delete/:comments_id', checkAuthenticated, (req, res) => {
    const owner_id = parseInt(req.params.owner_id);
    const comments_id = parseInt(req.params.comments_id);
    const sql1 = `
        DELETE FROM comments
        WHERE comments_id = ? AND owner_id = ?
    `;
    connection.query(sql1, [comments_id, owner_id], (err) => {
        if (err) {
            console.log(err);
        } else {
            res.redirect(`/user/${owner_id}`);
        }
    });
});


const PORT = process.env.PORT || 3000; 
app.listen(PORT, () => console.log(`Server running on port http://localhost:${PORT}`)); 

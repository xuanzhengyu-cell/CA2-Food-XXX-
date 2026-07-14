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
    database: 'to_be_confirmed' 
}); 
connection.connect((err) => { 
    if (err) { 
        console.error('Error connecting to MySQL:', err); 
        return; 
    } 
    console.log('Connected to MySQL database'); 
}); 

// Session Creation
app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    // Session expires after 1 week of inactivity
    cookie: {maxAge: 1000 * 60 * 60 * 24 * 7}
}));

// 


// Set up view engine 
app.set('view engine', 'ejs'); 
//  enable static files 
app.use(express.static('public')); 
app.use(express.urlencoded ({
  extended: false
}));

// Note: Our Theme will be on Food Store

// Assets
// - 4 sql tables: one for username + password +  user id + position + location id (if any) 
//                 one for location id, location name
//                 one for messages id, location id, store id, text, date, favourites
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


// Route: Edit of <>


// Route: Delete of <>


// Route: Sorting of <> 





const PORT = process.env.PORT || 3000; 
app.listen(PORT, () => console.log(`Server running on port http://localhost:${PORT}`)); 

// Additional features: 
//    - ???

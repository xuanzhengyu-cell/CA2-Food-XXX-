// Import required modules
const express = require('express'); 
const mysql = require('mysql2'); 
const app = express(); 
const multer = require ('multer');

  // Set up multer for file uploads
const storage = multer.diskStorage({
destination: (req, file, cb) => {
cb(null, 'public/images'); // Directory to save uploaded files
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
 
// Set up view engine 
app.set('view engine', 'ejs'); 
//  enable static files 
app.use(express.static('public')); 

app.use(express.urlencoded ({
  extended: false
}));

// Note: Our Theme will be on Food Store

// Assets
// - 3 sql tables: one for username + password + position + user id
//                 one for store id, store location, store name, store picture, owner(user id) and comments section id
//                 one for comments id, comments text, owner(user id), favourites (likes?)
// - 4 (? may add more) positions. 
// - Projected pages: Login page, Home page (*display all groups existing + admin messages), Group page (to display data), Adding page, Editing page, 
//                    Admin's Page (for site mods), Group Owner Page (for group page mods), (? more to be added)


// Route: Login page and Home page (along with user verification)
//   - Typically: 
    //    - Site Admins can CRUD everything, plus give other users permission up to Admin. 
    //      - They also can hold the permission to create a new group. 
    //      - They can kick and add users into groups freely.  
    //      - They are the site admins. 
    //
    //    - Group Owners can CRUD everything in their group, but will have the same privilege in other groups as per normal users. 
    //      - They can give others permission up to group owner ONLY for their OWN group.
    //      - They can ONLY kick and add people into their OWN group. 
    //      - They are the location shop owners (Lot One, Jurong Point etc). 
    //
    //    -  Group Members can CRUD their OWN messages in the group they belong to, and the rest is the same as a group user. 
    //      - They can invite users to the group, but whether they will enter or not is up to the Group Owner. 
    //      - They are the shop/stall owners (McDonald's, KFC, etc)
    //      - Group members can register for comment removal, but it is up to the group owner to decide whether they want to remove or not. 
    //
    //    -  Normal users can: 
    //      - They can CRUD their own comments 
    //      - They are the normal users of the website. 


// Route: Creation of <>
//    - How to create? What to add in? 
//    - Regardless, remember to ensure that the sql table (for data) can accept it. 


// Route: Edit of <>


// Route: Delete of <>


// Route: Sorting of <> 





const PORT = process.env.PORT || 3000; 
app.listen(PORT, () => console.log(`Server running on port http://localhost:${PORT}`)); 

// Additional features: 
//    - ???

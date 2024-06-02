const express = require("express");
const multer = require("multer");
const mysql = require("mysql2");
const fs = require("fs");
const cors = require("cors");
const bodyParser = require("body-parser");

const bcrypt = require("bcryptjs");
const app = express();

app.use(cors());
app.use(express.json());

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "B0l0Rma@",
  database: "diploma",
});

db.connect((err) => {
  if (err) {
    console.error("Error connecting to MySQL: " + err.stack);
    return;
  }
  console.log("Connected to MySQL, thread ID: " + db.threadId);
});
app.post('/convert', (req, res) => {
    const { user_id, uploaded_id, date, translator, transcription, img_url } = req.body;
    const sql = `INSERT INTO converted (user_id, uploaded_id, date, translator, transcription, img_url) VALUES (?, ?, ?, ?, ?, ?)`;
    const values = [user_id, 1, date, translator, transcription, img_url];
    console.log(values);
    db.query(sql, values, (err, result) => {
        if (err) {
            res.status(500).send('Error inserting data');
        } else {
            res.status(200).send('Data inserted successfully');
        }
    });
});
app.delete('/delete/:id', (req, res) => {
  const { id } = req.params;
  console.log("delete id: "+ id)
  const sql = 'DELETE FROM converted WHERE convert_id = ?';

  db.query(sql, [id], (err, result) => {
      if (err) {
          res.status(500).send('Error deleting data');
      } else if (result.affectedRows === 0) {
          res.status(404).send('No record found with that ID');
      } else {
          res.status(200).send('Record deleted successfully');
      }
  });
});


app.get("/audio/:id", (req, res) => {
  const { id } = req.params;
  console.log("read");
  const query = "SELECT file_name, file_data FROM audio_files WHERE id = ?";
  db.query(query, [id], (err, results) => {
    if (err) {
      console.error("Failed to retrieve file from database: ", err);
      return res.status(500).send("Database error");
    }
    if (results.length === 0) {
      return res.status(404).send("File not found");
    }

    const file = results[0];
    console.log(file.file_data);
    res.set({
      "Content-Type": "audio/m4a",
      "Content-Disposition": `attachment; filename="${file.file_name}"`,
    });
    res.send(file.file_data);
  });
});

app.get("/history", (req, res) => {
  var userId = req.query.userId;
  userId = userId.replace(/'/g, "");
  console.log(userId);
  const query = "SELECT * FROM Converted where user_id = ?";

  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error("Failed to retrieve news from database:", err);
      return res.status(500).send("Failed to retrieve news");
    }
    res.json(results);
  });
});

app.get("/login", (req, res) => {
  var { username, password } = req.query;
  console.log("Username:", username);

  console.log("pass:", password);

  const sql = "SELECT * FROM `Users` where email like ? ;";
  db.query(sql, [username], async (err, results) => {
    if (err) {
      print(err);
      throw err;
    }
    if (results.length === 0) {
      console.log("result :", results);
      return res.status(400).send("login unsuccessful");
    }
    console.log(results[0]);
    const user = results[0];
    try {
      if (await bcrypt.compare(password, user.password)) {
        console.log(user);
        console.log("login successful");
        res.status(200).json({ userId: user.user_id, name: user.name });
      } else {
        res.status(400).send("login unsuccessful");
      }
    } catch (error) {
      res.status(500).send("Internal server error");
    }
  });
});

app.post("/signup", async (req, res) => {
  var { password, email, name } = req.query; 
  console.log("name: " + name);
  console.log("email: " + email);
  console.log("password: " + password);
  const hashedPassword = await bcrypt.hash(password, 10);

  const sql = "SELECT * FROM Users WHERE email LIKE ?";
  db.query(sql, [email], (err, result) => {
    if (err) {
      throw err;
    }
    if (result.length === 0) {
      const sql_insert = `INSERT INTO Users(email, password, name) VALUES (?,  ? , ?)`;
      db.query(sql_insert, [email, hashedPassword, name], (err, result) => {
        if (err) {
          throw err;
        }
        return res.status(201).send("Signup successful");
      });
    } else {
      return res.status(400).send("email already exists");
    }
  });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

const express = require('express');
const path = require('path');
const app = express();
app.use(express.static('foodeiblog-master'));
app.use(express.static('foodeiblog-master/uploads'));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'foodeiblog-master')));
app.set('view engine','ejs');
app.set("views", path.join(__dirname, "views"));
var my = require('mysql2');
var con = my.createConnection({
  host: '127.0.0.1',
  user: 'root',
  password: '',
  database: 'food'
});
con.connect(function (err) {
  if (err) throw err;
  console.log("Connected To MySQL");
});
const multer = require('multer');
const st = multer.diskStorage({
  destination: function (req, file, cb) {

    cb(null, 'foodeiblog-master/uploads/');
  },
  filename: function (req, file, cb) {
    
    cb(null, file.originalname);
  }
});

const upload = multer({ storage: st });
const session = require('express-session');

app.use(session({
  secret: 'ad@#!23@#', 
  resave: true,
  saveUninitialized: true
}));

app.use(function(req, res, next) {
  res.locals.adminemail = req.session.adminemail;
  res.locals.adminname= req.session.adminname;
  res.locals.useremail = req.session.useremail;
  res.locals.username= req.session.username;
  next();
});


app.get("/", (req, res) => {

  const sql = "SELECT * FROM additems ORDER BY created_at DESC";

  con.query(sql, (err, results) => {
    if (err) throw err;

    res.render("index", {
      products: results,
      username: req.session.username
    });
  });
});

app.get('/about', (req, res) => {
  res.sendFile(path.join(__dirname, 'foodeiblog-master', 'about.html'));
});
app.get('/contact', (req, res) => {
  res.sendFile(path.join(__dirname, 'foodeiblog-master', 'contact.html'));
});
app.get('/signin', (req, res) => {
  res.sendFile(path.join(__dirname, 'foodeiblog-master', 'signin.html'));
});
app.get('/categories-grid', (req, res) => {
  res.sendFile(path.join(__dirname, 'foodeiblog-master', 'categories-grid.html'));
});
app.get('/categories-list', (req, res) => {
  res.sendFile(path.join(__dirname, 'foodeiblog-master', 'categories-list.html'));
});
app.get('/single-post', (req, res) => {
  res.sendFile(path.join(__dirname, 'foodeiblog-master', 'single-post.html'));
});
app.get('/typography', (req, res) => {
  res.sendFile(path.join(__dirname, 'foodeiblog-master', 'typography.html'));
});
app.get('/adminlogin', (req, res) => {
  res.sendFile(path.join(__dirname, 'foodeiblog-master', 'adminlogin.html'));
});
app.get("/dashboard", (req, res) => {

  const lowStockSql = `
    SELECT * FROM additems 
    WHERE stock_limit <= 5
  `;

  con.query(lowStockSql, (err, lowStockItems) => {
    if (err) throw err;

    res.render("dashboard", { lowStockItems });
  });
});
app.get("/Additems", (req, res) => {
  if (req.session.adminemail == null) {
    return res.redirect("/adminlogin");
  }
  res.render("additems"); // your EJS page
});



app.post('/contact_process', (req, res) => {    
    const { name, email, website, message } = req.body;
    const sql = 'INSERT INTO contacts (name, email, website, message) VALUES (?, ?, ?, ?)';
    con.query(sql, [name, email, website, message], (err, result) => {
        if (err) {
            console.error('Error inserting data into MySQL:', err);
            res.status(500).send('Internal Server Error');
        }
        else {
            console.log('Data inserted successfully:', result);
            res.redirect('/');

        }
    });
});

const bcrypt = require('bcrypt');

app.post('/signin', async (req, res) => {
    const { username, email, password, confirm_password, full_name } = req.body;

    // 🔐 Check password match
    if (password !== confirm_password) {
        return res.send("Passwords do not match");
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        const sql = `
            INSERT INTO users (username, email, password, full_name)
            VALUES (?, ?, ?, ?)
        `;

        con.query(sql, [username, email, hashedPassword, full_name], (err) => {
            if (err) {
                console.error(err);
                return res.status(500).send("User already exists or DB error");
            }

            res.redirect('/signin');

        });

    } catch (error) {
        console.error(error);
        res.status(500).send("Server Error");
    }
});


app.post('/login', (req, res) => {

    const { username, password } = req.body;

    const sql = "SELECT * FROM users WHERE username = ?";

    con.query(sql, [username], async (err, results) => {

        if (err) return res.status(500).send("Server Error");

        if (results.length === 0) {
            return res.send("User not found");
        }

        const user = results[0];

        const match = await bcrypt.compare(password, user.password);

        if (!match) {
            return res.send("Incorrect Password");
        }

        req.session.userId = user.id;
        req.session.username = user.username;

        res.redirect('/');
    });
});
app.post("/admin_login", function(req, res) {

  const email = req.body.email;
  const password = req.body.password;

  const sql = "SELECT * FROM admins WHERE email = ?";

  con.query(sql, [email], function(err, result) {

    if (result.length === 0) {
      return res.send("❌ Invalid Admin Credentials");
    }

    const user = result[0];

    if (password === user.password) {
      req.session.adminemail = user.email;
      return res.redirect("/dashboard");
    } else {
      return res.send("❌ Invalid Admin Credentials");
    }
  });
});

app.post("/products", upload.single("image"), (req, res) => {

  const { itemName, category, price, stock_limit, description } = req.body;

  // 🔥 DEBUG
  console.log("BODY:", req.body);

  if (!category) {
    return res.send("❌ Category is required");
  }

  const image = req.file ? req.file.filename : null;

  const sql = `
    INSERT INTO additems (item_name, category, price, stock_limit, description, image, created_at)
    VALUES (?, ?, ?, ?, ?, ?, NOW())
  `;

  con.query(sql, [itemName, category, price, stock_limit, description, image], (err) => {
    if (err) throw err;
    res.redirect("/Additems");
  });
});
app.post("/add-to-cart", (req, res) => {
  const productId = parseInt(req.body.id);

  if (!req.session.cart) {
    req.session.cart = [];
  }

  const existing = req.session.cart.find(item => item.id === productId);

  if (existing) {
    existing.qty += 1;
  } else {
    req.session.cart.push({ id: productId, qty: 1 });
  }

  res.redirect("/cart");
});
app.get("/cart", (req, res) => {
  const cart = req.session.cart || [];

  if (cart.length === 0) {
    return res.send("Cart is empty");
  }

  const ids = cart.map(item => item.id);

  const sql = "SELECT * FROM additems WHERE id IN (?)";

  con.query(sql, [ids], (err, results) => {
    if (err) throw err;

    const products = results.map(product => {
      const cartItem = cart.find(c => c.id == product.id);
      return {
        ...product,
        qty: cartItem.qty
      };
    });

    res.render("cart", { products });
  });
});
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});
app.get("/order", (req, res) => {

  const cart = req.session.cart || [];

  if (cart.length === 0) {
    return res.redirect("/");
  }

  const ids = cart.map(item => item.id);

  const sql = "SELECT * FROM additems WHERE id IN (?)";

  con.query(sql, [ids], (err, results) => {
    if (err) throw err;

    let total = 0;

    // merge qty with DB data
    const products = results.map(product => {
      const cartItem = cart.find(c => c.id == product.id);
      const qty = cartItem ? cartItem.qty : 1;

      const itemTotal = product.price * qty;
      total += itemTotal;

      return {
        ...product,
        qty,
        itemTotal
      };
    });

    const gst = total * 0.05;
    const final = total + gst;

    res.render("order", {
      products,
      total,
      gst,
      final
    });
  });
});
app.get("/admin/orders", (req, res) => {
  const sql = `
    SELECT o.*, u.username 
    FROM orders o
    LEFT JOIN users u ON o.user_id = u.id
    ORDER BY o.created_at DESC
  `;

  con.query(sql, (err, results) => {
    if (err) throw err;

    res.render("admin-orders", { orders: results }); // ✅ FIXED
  });
});
app.post("/place-order", (req, res) => {
  const cart = req.session.cart || [];
  const userId = req.session.userId || null;
  const paymentMethod = req.body.paymentMethod || "COD";

  if (cart.length === 0) {
    return res.send("Cart empty");
  }

  const ids = cart.map(item => item.id);

  const sql = "SELECT * FROM additems WHERE id IN (?)";

  con.query(sql, [ids], (err, results) => {
    if (err) throw err;

    let total = 0;

    const items = results.map(product => {
      const cartItem = cart.find(c => c.id == product.id);
      const qty = cartItem.qty;
      const itemTotal = product.price * qty;

      total += itemTotal;

      return {
        product_id: product.id,
        quantity: qty,
        price: product.price
      };
    });

    const gst = total * 0.05;
    const final = total + gst;

    // INSERT ORDER
    const orderSql = `
      INSERT INTO orders (user_id, total_amount, payment_method)
      VALUES (?, ?, ?)
    `;

    con.query(orderSql, [userId, final, paymentMethod], (err, result) => {
      if (err) throw err;

      const orderId = result.insertId;

      // INSERT ORDER ITEMS
      items.forEach(item => {
        const itemSql = `
          INSERT INTO order_items (order_id, product_id, quantity, price)
          VALUES (?, ?, ?, ?)
        `;
        con.query(itemSql, [orderId, item.product_id, item.quantity, item.price]);
      });

      // CLEAR CART
      req.session.cart = [];

      res.send("✅ Order placed successfully");
    });
  });
});
app.post("/admin/update-status", (req, res) => {
  const { orderId, status } = req.body;

  const sql = "UPDATE orders SET status=? WHERE id=?";

  con.query(sql, [status, orderId], (err) => {
    if (err) throw err;
    res.redirect("/admin/orders");
  });
});
app.get("/admin/menu-items", (req, res) => {

  if (!req.session.adminemail) {
    return res.redirect("/adminlogin");
  }

  const sql = "SELECT * FROM additems ORDER BY created_at DESC";

  con.query(sql, (err, results) => {
    if (err) throw err;

    res.render("menu-items", { items: results });
  });
});
app.post("/admin/delete-item", (req, res) => {
  const { id } = req.body;

  const sql = "DELETE FROM additems WHERE id=?";

  con.query(sql, [id], (err) => {
    if (err) throw err;
    res.redirect("/admin/menu-items");
  });
});
app.get("/admin/inventory", (req, res) => {

  if (!req.session.adminemail) {
    return res.redirect("/adminlogin");
  }

  const sql = "SELECT * FROM additems ORDER BY stock_limit ASC";

  con.query(sql, (err, results) => {
    if (err) throw err;

    res.render("inventory", { items: results });
  });
});
app.post("/admin/update-stock", (req, res) => {
  const { id, stock } = req.body;

  const sql = "UPDATE additems SET stock_limit=? WHERE id=?";

  con.query(sql, [stock, id], (err) => {
    if (err) throw err;

    res.redirect("/admin/inventory");
  });
});
app.get("/admin/staff", (req, res) => {

  if (!req.session.adminemail) {
    return res.redirect("/adminlogin");
  }

  const sql = "SELECT * FROM staff ORDER BY created_at DESC";

  con.query(sql, (err, results) => {
    if (err) throw err;

    res.render("staff", { staff: results });
  });
});
app.post("/admin/add-staff", (req, res) => {
  const { name, role } = req.body;

  const sql = "INSERT INTO staff (name, role) VALUES (?, ?)";

  con.query(sql, [name, role], (err) => {
    if (err) throw err;
    res.redirect("/admin/staff");
  });
});
app.post("/admin/update-staff", (req, res) => {
  const { id, status } = req.body;

  const sql = "UPDATE staff SET status=? WHERE id=?";

  con.query(sql, [status, id], (err) => {
    if (err) throw err;
    res.redirect("/admin/staff");
  });
});
app.post("/admin/delete-staff", (req, res) => {
  const { id } = req.body;

  const sql = "DELETE FROM staff WHERE id=?";

  con.query(sql, [id], (err) => {
    if (err) throw err;
    res.redirect("/admin/staff");
  });
});



app.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});

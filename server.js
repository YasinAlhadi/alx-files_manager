const express = require('express');
const router = require('./routes/index');

const app = express();
const port = process.env.PORT || 5000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: '2mb' }));
app.use(router);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

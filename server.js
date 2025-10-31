const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static('./'));

const contactRouter = require('./routes/contact');
app.use('/api/contact', contactRouter);

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});

import express from "express";

const app = express();

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.get("/hi", (req, res) => {
  res.send("Hello World!");
});
app.get("/test", (req, res) => {
  res.send("Hello World!");
});

export default app;

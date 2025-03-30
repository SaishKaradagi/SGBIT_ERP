import app from "./src/app.js";
import dotenv from "dotenv";

dotenv.config({
  path: "./.env",
});
const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
  console.log(`Server is running on port http://localhost:${PORT}`);
});

// config/index.ts
import path from "path";

const config = {
  logDir: process.env.LOG_DIR ?? path.join(process.cwd(), "logs"),
  isDev: process.env.NODE_ENV === "development",
  isProd: process.env.NODE_ENV === "production",
};

export default config;

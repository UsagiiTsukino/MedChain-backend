import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import session from "express-session";
import FileStore from "session-file-store";
import { AppModule } from "./app.module";
import { IoAdapter } from "@nestjs/platform-socket.io";

const FileStoreSession = FileStore(session);

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable WebSocket with Socket.IO
  app.useWebSocketAdapter(new IoAdapter(app));

  // Enable CORS for frontend (REST API + WebSocket)
  app.enableCors({
    origin: [
      process.env.FRONTEND_URL || "http://localhost:5173",
      "http://localhost:3000",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });

  app.use(
    session({
      store: new FileStoreSession({
        path: "./sessions",
        ttl: 7 * 24 * 3600, // 7 days in seconds
        retries: 0,
      }),
      secret: process.env.SESSION_SECRET || "secret",
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 7 * 24 * 3600 * 1000,
        httpOnly: true,
        secure: false, // set to true in production with HTTPS
        sameSite: "lax",
      },
    })
  );

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const port = Number(process.env.PORT || 3000);
  await app.listen(port);
}

bootstrap();

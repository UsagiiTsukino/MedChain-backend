import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BlockchainModule } from "./blockchain/blockchain.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { RolesModule } from "./roles/roles.module";
import { PermissionsModule } from "./permissions/permissions.module";
import { VaccinesModule } from "./vaccines/vaccines.module";
import { CentersModule } from "./centers/centers.module";
import { AppointmentsModule } from "./appointments/appointments.module";
import { FilesModule } from "./files/files.module";
import { BookingsModule } from "./bookings/bookings.module";
import { OrdersModule } from "./orders/orders.module";
import { PaymentsModule } from "./payments/payments.module";
import { AiChatbotModule } from "./ai-chatbot/ai-chatbot.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      // Default to MySQL for local testing; override via env if needed
      type: (process.env.DB_TYPE as any) || "mysql",
      host: process.env.DB_HOST || "localhost",
      port: +(process.env.DB_PORT || 3306),
      username: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "dappdb",
      autoLoadEntities: true,
      synchronize: false, // Disabled - using manual migrations
      charset: "utf8mb4",
      extra: {
        // Set default collation for connection to avoid collation mismatch
        connectionLimit: 10,
      },
      // Execute SQL after connection to set collation
      migrations: [],
      migrationsRun: false,
    }),
    BlockchainModule,
    AuthModule,
    UsersModule,
    RolesModule,
    PermissionsModule,
    VaccinesModule,
    CentersModule,
    AppointmentsModule,
    FilesModule,
    BookingsModule,
    OrdersModule,
    PaymentsModule,
    AiChatbotModule,
  ],
})
export class AppModule {}

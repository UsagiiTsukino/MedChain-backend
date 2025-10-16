## Migration guide: Spring Boot → NestJS

This guide maps the existing Spring Boot structure to an equivalent NestJS codebase, including modules, controllers, services, entities (TypeORM), configuration, and blockchain integration.

### Target project structure (NestJS)

```
src/
  app.module.ts
  common/
    filters/http-exception.filter.ts
    interceptors/response.interceptor.ts
    pipes/validation.pipe.ts
  config/
    configuration.ts
  database/
    entities/
    migrations/
  auth/
    auth.module.ts
    auth.controller.ts
    auth.service.ts
    dto/
  users/
    users.module.ts
    users.controller.ts
    users.service.ts
    entities/user.entity.ts
    dto/
  roles/
    roles.module.ts
    roles.controller.ts
    roles.service.ts
    entities/role.entity.ts
  permissions/
    permissions.module.ts
    permissions.controller.ts
    permissions.service.ts
    entities/permission.entity.ts
  vaccines/
    vaccines.module.ts
    vaccines.controller.ts
    vaccines.service.ts
    entities/vaccine.entity.ts
  centers/
    centers.module.ts
    centers.controller.ts
    centers.service.ts
    entities/center.entity.ts
  appointments/
    appointments.module.ts
    appointments.controller.ts
    appointments.service.ts
    dto/
  blockchain/
    blockchain.module.ts
    blockchain.service.ts
    contract/
      VaccineAppointment.abi.json
```

### Dependencies

```bash
npm i @nestjs/common @nestjs/core @nestjs/platform-express @nestjs/config
npm i @nestjs/typeorm typeorm pg class-validator class-transformer
npm i ethers             # web3 integration
npm i express-session    # if keeping session-based wallet handling
npm i @nestjs/passport passport passport-session # optional
npm i pino-http @nestjs/pino # logging (optional)
```

### Configuration (.env)

Re-use values from `application.properties` and `docs/POSTGRES-NOTES.md`:

```
PORT=3000
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=dapp
POSTGRES_USER=dapp
POSTGRES_PASSWORD=secret
RPC_URL=http://localhost:8545
CONTRACT_ADDRESS=0x...
POSTGRES_SSL=false
```

### AppModule and TypeORM

```ts
// app.module.ts (excerpt)
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: "postgres",
      host: process.env.POSTGRES_HOST,
      port: +(process.env.POSTGRES_PORT || 5432),
      username: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DB,
      autoLoadEntities: true,
      synchronize: false,
      ssl:
        process.env.POSTGRES_SSL === "true"
          ? { rejectUnauthorized: false }
          : false,
    }),
    // feature modules...
  ],
})
export class AppModule {}
```

### Entities mapping (JPA → TypeORM)

- `com.dapp.backend.model.User` → `users/entities/user.entity.ts`
- `Role`, `Permission`, `Vaccine`, `Center` similarly.
- Prefer UUID primary keys (or keep bigint if matching chain IDs is desirable).
- For JSON fields, use `@Column({ type: 'jsonb', nullable: true })`.
- For timestamps, use `@CreateDateColumn()` and `@UpdateDateColumn()`.

Example:

```ts
// users/entities/user.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from "typeorm";
import { Center } from "../../centers/entities/center.entity";
import { Role } from "../../roles/entities/role.entity";

@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid") id: string;

  @Column({ unique: true }) walletAddress: string;

  @ManyToOne(() => Center, { nullable: true }) center?: Center;
  @ManyToOne(() => Role, { nullable: true }) role?: Role;

  @Column({ default: false }) isDeleted: boolean;
}
```

### Controllers mapping

Map Spring controllers to Nest controllers preserving paths and verbs.

- `AuthController` (`/auth`) → `auth.controller.ts`
- `AppointmentController` (`/appointments`) → `appointments.controller.ts`
- `UserController` (`/users`) → `users.controller.ts`
- `RoleController` (`/roles`) → `roles.controller.ts`
- `PermissionController` (`/permissions`) → `permissions.controller.ts`
- `VaccineController` (`/vaccines`) → `vaccines.controller.ts`
- `CenterController` (`/centers`) → `centers.controller.ts`

Nest example:

```ts
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post("login")
  login(@Body() dto: LoginDto, @Session() session: Record<string, any>) {
    session.walletAddress = dto.walletAddress;
    return this.authService.login(dto.walletAddress);
  }

  @Get("account")
  me(@Session() session: Record<string, any>) {
    return this.authService.login(session.walletAddress);
  }
}
```

### Services mapping

Each Spring `*Service` → Nest `@Injectable()` service with similar method names.

- Database operations: inject TypeORM repositories via `@InjectRepository`.
- Appointment on-chain operations: move to `appointments.service.ts` and/or a dedicated `blockchain.service.ts`.

### Web3 integration (web3j → ethers.js)

```ts
// blockchain/blockchain.service.ts (excerpt)
import { Injectable, OnModuleInit } from "@nestjs/common";
import { ethers } from "ethers";
import abi from "./contract/VaccineAppointment.abi.json";

@Injectable()
export class BlockchainService implements OnModuleInit {
  provider!: ethers.JsonRpcProvider;
  contract!: ethers.Contract;

  onModuleInit() {
    this.provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    this.contract = new ethers.Contract(
      process.env.CONTRACT_ADDRESS!,
      abi,
      this.provider
    );

    // Example event listener
    // this.contract.on('AppointmentCreated', (...args) => { /* handle */ });
  }
}
```

Appointment service can call `blockchainService.contract` methods to create/update/cancel appointments, then adapt outputs to DTOs similar to `AppointmentMapper`.

### Session handling (HttpSession → express-session)

```ts
// main.ts (excerpt)
import * as session from "express-session";

app.use(
  session({
    secret: process.env.SESSION_SECRET || "secret",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 7 * 24 * 3600 * 1000 },
  })
);
```

Use `@Session()` decorator in controllers to get/set `walletAddress`.

Alternative: switch to JWT and include `walletAddress` in token claims.

### Filtering and pagination (springfilter → query builder)

Options:

1. Implement a minimal parser mapping query params to TypeORM `FindOptionsWhere`.
2. Use a library for advanced filtering, or accept explicit params.

Pagination:

- Accept `page`, `size` (or `limit`, `offset`) and use TypeORM `skip/take`.

### Error handling and response shape

- Replace `GlobalException` with a global `HttpExceptionFilter` that returns a consistent body (like `FormatResponse`).
- Use a response interceptor if you want to wrap all responses with `{ message, data }` similar to `@ApiMessage`.

### DTOs and validation

- Convert `Req*`, `Res*`, `*Dto` classes to Nest DTOs with `class-validator`.
- Enable global validation pipe:

```ts
app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
```

### Migration checklist

1. Setup Nest workspace, install dependencies, create `.env`.
2. Configure TypeORM for PostgreSQL; create base entities and relations.
3. Port DTOs and validation rules.
4. Implement repositories/services for Users, Roles, Permissions, Vaccines, Centers.
5. Implement Auth routes: register, login (set `walletAddress` in session), account, logout.
6. Implement Appointments routes; integrate `BlockchainService` using ethers and ABI JSON.
7. Add filtering/pagination to list endpoints.
8. Add global exception filter and response interceptor.
9. Create and run initial TypeORM migrations; disable `synchronize` in non-dev.
10. Add event listeners for on-chain events if required.

### Notes on IDs and status mapping

- If appointment IDs originate on-chain (BigInteger), map to `bigint` in Postgres or keep as string in DTOs.
- Port `AppointmentStatusMapper` logic to a dedicated utility and ensure UI-facing labels remain stable.

### Testing

- Unit test services/controllers with Jest and testing module.
- For blockchain calls, stub contract methods or run against a local node (e.g., Hardhat/Anvil/Ganache).

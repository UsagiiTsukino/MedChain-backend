## PostgreSQL adoption notes

This project is being migrated to use PostgreSQL. Below is a focused checklist and copy‑paste snippets for both current Spring Boot usage and the upcoming NestJS migration.

### Environment variables (.env)

```
# Common
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=dapp
POSTGRES_USER=dapp
POSTGRES_PASSWORD=secret

# Optional SSL
POSTGRES_SSL=false
```

### Spring Boot (current project)

- Update dependency (replace MySQL connector):

```xml
<dependency>
  <groupId>org.postgresql</groupId>
  <artifactId>postgresql</artifactId>
  <version>42.7.3</version>
</dependency>
```

- Update `application.properties`:

```
spring.datasource.url=jdbc:postgresql://${POSTGRES_HOST:${DB_HOST:localhost}}:${POSTGRES_PORT:${DB_PORT:5432}}/${POSTGRES_DB:${DB_NAME:dapp}}
spring.datasource.username=${POSTGRES_USER:${DB_USER:dapp}}
spring.datasource.password=${POSTGRES_PASSWORD:${DB_PASSWORD:secret}}
spring.datasource.driver-class-name=org.postgresql.Driver

# Recommended Hibernate settings for Postgres
spring.jpa.database-platform=org.hibernate.dialect.PostgreSQLDialect
spring.jpa.hibernate.ddl-auto=update
spring.jpa.properties.hibernate.jdbc.lob.non_contextual_creation=true
```

- Column type hints (if needed): prefer `@Column(columnDefinition = "uuid")` for UUIDs, use `@Type(type = "org.hibernate.type.PostgresUUIDType")` if on older Hibernate.

### NestJS (target stack)

- Install packages:

```bash
npm i @nestjs/typeorm typeorm pg class-validator class-transformer
```

- `app.module.ts` TypeORM config example:

```ts
TypeOrmModule.forRoot({
  type: "postgres",
  host: process.env.POSTGRES_HOST || "localhost",
  port: +(process.env.POSTGRES_PORT || 5432),
  username: process.env.POSTGRES_USER || "dapp",
  password: process.env.POSTGRES_PASSWORD || "secret",
  database: process.env.POSTGRES_DB || "dapp",
  autoLoadEntities: true,
  synchronize: false, // use migrations in production
  ssl:
    process.env.POSTGRES_SSL === "true" ? { rejectUnauthorized: false } : false,
});
```

- `ormconfig` (optional, for CLI):

```ts
export default {
  type: "postgres",
  url: process.env.DATABASE_URL, // or use the vars above
  entities: ["dist/**/*.entity.js"],
  migrations: ["dist/migrations/*.js"],
  synchronize: false,
};
```

### Type mapping cheat sheet

- INTEGER → `integer`
- BIGINT → `bigint`
- DECIMAL/Numeric → `numeric(precision, scale)`
- BOOLEAN → `boolean`
- VARCHAR → `varchar(n)` / `text` (no length cap)
- DATETIME/TIMESTAMP → `timestamp with time zone` (recommended) or `timestamp`
- UUID → `uuid` (use Postgres `uuid-ossp` or app‑side generation)
- JSON → `jsonb` (preferred) or `json`

### SQL differences to keep in mind

- Auto‑increment:
  - Use `serial`/`bigserial` or identity columns (`generated always/by default as identity`).
- Case sensitivity:
  - Unquoted identifiers fold to lowercase. Quote names if you must preserve case.
- LIKE behavior:
  - Use `ILIKE` for case‑insensitive matches.
- True/false values are `true`/`false` (not 1/0).
- Time zones:
  - Prefer `timestamptz` and store in UTC; convert at the edges.

### Migrations (NestJS/TypeORM)

```bash
npx typeorm migration:generate src/migrations/Init -d src/data-source.ts
npx typeorm migration:run -d src/data-source.ts
```

<!--
### Docker Compose (optional)

```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-dapp}
      POSTGRES_USER: ${POSTGRES_USER:-dapp}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-secret}
    ports:
      - "${POSTGRES_PORT:-5432}:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
volumes:
  pgdata:
``` -->

### Data migration from MySQL

1. Export from MySQL as CSV (one table at a time).
2. Create schemas/tables in Postgres via migrations.
3. Import CSV with `\copy` or GUI; map enums/booleans carefully.
4. Rebuild indexes/constraints; verify counts and spot‑check domain rules.

### Checklist when converting code

- Replace MySQL connector with `pg` (Node) or `postgresql` (Spring).
- Update connection strings, env vars, and container orchestration.
- Revisit entity decorators for column types (UUID, JSONB, timestamps).
- Rewrite raw SQL that uses MySQL‑specific syntax (LIMIT/OFFSET is fine, but functions differ).
- Implement migrations and disable auto‑sync in production.

### Connection URL reference

```
postgres://USER:PASSWORD@HOST:PORT/DB
```

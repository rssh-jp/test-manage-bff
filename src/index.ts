import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { buildSchema, parse, validate, execute } from "graphql";

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- GraphQL セットアップ ---

const schemaSDL = readFileSync(join(__dirname, "schema.graphql"), "utf-8");
const schema = buildSchema(schemaSDL);

// persisted-documents.json の読み込み
// FE の codegen 後に `make sync-pq` でこのファイルが更新される
const persistedQueriesPath =
  process.env.PERSISTED_QUERIES_PATH ??
  join(__dirname, "persisted-documents.json");

let parsedPersistedQueries: Record<string, ReturnType<typeof parse>> = {};

function loadPersistedQueries(): void {
  try {
    const content = readFileSync(persistedQueriesPath, "utf-8");
    const manifest = JSON.parse(content) as Record<string, string>;
    const parsed: Record<string, ReturnType<typeof parse>> = {};
    for (const [hash, queryString] of Object.entries(manifest)) {
      const doc = parse(queryString);
      const errors = validate(schema, doc);
      if (errors.length > 0) {
        console.error(
          `Persisted query validation failed for hash ${hash}: ${errors.map((e) => e.message).join(", ")}`,
        );
        continue;
      }
      parsed[hash] = doc;
    }
    parsedPersistedQueries = parsed;
    console.log(`Loaded ${Object.keys(parsed).length} persisted queries from ${persistedQueriesPath}`);
  } catch {
    console.warn(
      `Could not load persisted queries from ${persistedQueriesPath}. Run 'npm run codegen' in FE first.`,
    );
  }
}

loadPersistedQueries();

type User = {
  id: number;
  name: string;
  email: string;
};

type UserListResponse = {
  list?: User[];
  error?: string;
};

type UserResponse = {
  data?: User;
  error?: string;
};

type CreateUserRequest = {
  name: string;
  email: string;
};

const BE_BASE_URL = process.env.BE_BASE_URL ?? "http://localhost:8080";
const PORT = Number(process.env.PORT ?? 8081);

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: true,
});

app.get("/health", async () => ({ ok: true }));

app.get("/api/users", async (request, reply) => {
  const query = (request.query as { query?: string }).query ?? "";
  const searchParams = new URLSearchParams();

  if (query.trim() !== "") {
    searchParams.set("query", query.trim());
  }

  const target = `${BE_BASE_URL}/api/users${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
  const res = await fetch(target);
  const payload = (await res.json()) as UserListResponse;

  if (!res.ok) {
    return reply.code(res.status).send({ error: payload.error ?? "backend request failed" });
  }

  return {
    data: payload.list ?? [],
  };
});

app.post("/api/users", async (request, reply) => {
  const body = request.body as CreateUserRequest;

  const res = await fetch(`${BE_BASE_URL}/api/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: body.name ?? "", email: body.email ?? "" }),
  });

  const payload = (await res.json()) as UserResponse;
  if (!res.ok) {
    return reply.code(res.status).send({ error: payload.error ?? "backend request failed" });
  }

  return reply.code(201).send({ data: payload.data });
});

app.get("/api/users/:id", async (request, reply) => {
  const id = (request.params as { id: string }).id;

  const res = await fetch(`${BE_BASE_URL}/api/users/${id}`);
  const payload = (await res.json()) as UserResponse;

  if (!res.ok) {
    return reply.code(res.status).send({ error: payload.error ?? "backend request failed" });
  }

  return {
    data: payload.data,
  };
});

app.put("/api/users/:id", async (request, reply) => {
  const id = (request.params as { id: string }).id;
  const body = request.body as { name?: string; email?: string };

  const res = await fetch(`${BE_BASE_URL}/api/users/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: body.name ?? "",
      email: body.email ?? "",
    }),
  });

  const payload = (await res.json()) as UserResponse;
  if (!res.ok) {
    return reply.code(res.status).send({ error: payload.error ?? "backend request failed" });
  }

  return {
    data: payload.data,
  };
});

app.delete("/api/users/:id", async (request, reply) => {
  const id = (request.params as { id: string }).id;

  const res = await fetch(`${BE_BASE_URL}/api/users/${id}`, {
    method: "DELETE",
  });

  if (!res.ok) {
    const payload = (await res.json()) as { error?: string };
    return reply.code(res.status).send({ error: payload.error ?? "backend request failed" });
  }

  return reply.code(204).send();
});

// --- GraphQL リゾルバ ---

const resolvers = {
  users: async (args: { query?: string }) => {
    const searchParams = new URLSearchParams();
    if (args.query?.trim()) searchParams.set("query", args.query.trim());
    const url = `${BE_BASE_URL}/api/users${searchParams.toString() ? `?${searchParams}` : ""}`;
    const res = await fetch(url);
    const payload = (await res.json()) as UserListResponse;
    if (!res.ok) throw new Error(payload.error ?? "backend request failed");
    return { data: payload.list ?? [] };
  },

  user: async (args: { id: number }) => {
    const res = await fetch(`${BE_BASE_URL}/api/users/${args.id}`);
    const payload = (await res.json()) as UserResponse;
    if (!res.ok) throw new Error(payload.error ?? "backend request failed");
    return { data: payload.data };
  },

  createUser: async (args: { name: string; email: string }) => {
    const res = await fetch(`${BE_BASE_URL}/api/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: args.name, email: args.email }),
    });
    const payload = (await res.json()) as UserResponse;
    if (!res.ok) throw new Error(payload.error ?? "backend request failed");
    return { data: payload.data };
  },

  updateUser: async (args: { id: number; name: string; email: string }) => {
    const res = await fetch(`${BE_BASE_URL}/api/users/${args.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: args.name, email: args.email }),
    });
    const payload = (await res.json()) as UserResponse;
    if (!res.ok) throw new Error(payload.error ?? "backend request failed");
    return { data: payload.data };
  },

  deleteUser: async (args: { id: number }) => {
    const res = await fetch(`${BE_BASE_URL}/api/users/${args.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const payload = (await res.json()) as { error?: string };
      throw new Error(payload.error ?? "backend request failed");
    }
    return true;
  },
};

// --- Static Persisted Queries エンドポイント ---

type GraphQLRequestBody = {
  variables?: Record<string, unknown>;
  operationName?: string;
  extensions?: {
    persistedQuery?: {
      version: number;
      sha256Hash: string;
    };
  };
};

app.post("/api/graphql", async (request, reply) => {
  const body = request.body as GraphQLRequestBody;
  const hash = body?.extensions?.persistedQuery?.sha256Hash;

  // ハッシュなし（生のクエリ文字列）は全て拒否 — Trusted Documents の要件
  if (!hash) {
    return reply.code(400).send({
      errors: [{ message: "Only persisted queries are accepted." }],
    });
  }

  const document = parsedPersistedQueries[hash];
  if (!document) {
    return reply.code(404).send({
      errors: [{ message: `Persisted query not found: ${hash}` }],
    });
  }

  const result = await execute({
    schema,
    document,
    rootValue: resolvers,
    variableValues: body.variables,
    operationName: body.operationName,
  });

  return reply.send(result);
});

const start = async () => {
  try {
    await app.listen({ port: PORT, host: "0.0.0.0" });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

await start();

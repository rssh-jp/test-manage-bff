import Fastify from "fastify";
import cors from "@fastify/cors";

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

const start = async () => {
  try {
    await app.listen({ port: PORT, host: "0.0.0.0" });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

await start();

import postgres from "postgres";

// CLI prerequisite: push compares schemas but does not run SQL migration files.
const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is required to enable database extensions");
}

const client = postgres(url, { max: 1 });
try {
  await client`CREATE EXTENSION IF NOT EXISTS vector`;
  console.log("Database vector extension is ready.");
} finally {
  await client.end();
}

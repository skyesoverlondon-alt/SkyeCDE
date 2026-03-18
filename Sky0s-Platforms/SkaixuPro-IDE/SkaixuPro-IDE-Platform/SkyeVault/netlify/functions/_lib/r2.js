import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

let client;

function getRequiredEnv(name) {
  const value = (process.env[name] || "").trim();
  if (!value) throw new Error(`missing_${name}`);
  return value;
}

function getClient() {
  if (client) return client;

  const accountId = getRequiredEnv("CLOUDFLARE_ACCOUNT_ID");
  const accessKeyId = getRequiredEnv("CLOUDFLARE_R2_ACCESS_KEY_ID");
  const secretAccessKey = getRequiredEnv("CLOUDFLARE_R2_SECRET_ACCESS_KEY");

  client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey }
  });

  return client;
}

export async function putManifestObject({ bucket, key, body }) {
  const payload = typeof body === "string" ? body : JSON.stringify(body, null, 2);
  await getClient().send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: payload,
    ContentType: "application/json; charset=utf-8"
  }));

  return { bucket, key };
}
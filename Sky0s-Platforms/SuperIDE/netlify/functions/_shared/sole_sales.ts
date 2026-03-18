import crypto from "crypto";
import { q } from "./neon";

const COOKIE = "sole_contractor_session";
let schemaReady: Promise<void> | null = null;

function base64url(buf: Buffer) {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export function parseCookies(cookieHeader: string | undefined) {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  cookieHeader.split(";").forEach((part) => {
    const [key, ...rest] = part.trim().split("=");
    out[key] = rest.join("=") || "";
  });
  return out;
}

function shouldUseSecureCookie(event?: any) {
  const protoHeader = String(
    event?.headers?.["x-forwarded-proto"] || event?.headers?.["X-Forwarded-Proto"] || ""
  )
    .split(",")[0]
    .trim()
    .toLowerCase();

  if (protoHeader === "https") return true;
  if (protoHeader === "http") return false;

  const host = String(event?.headers?.host || event?.headers?.Host || "")
    .trim()
    .toLowerCase()
    .split(":")[0];

  if (!host) return true;
  if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".localhost")) {
    return false;
  }

  return true;
}

export function setSoleSessionCookie(token: string, expires: Date, event?: any) {
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax;${shouldUseSecureCookie(event) ? " Secure;" : ""} Expires=${expires.toUTCString()}`;
}

export function clearSoleSessionCookie(event?: any) {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax;${shouldUseSecureCookie(event) ? " Secure;" : ""} Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

export async function createSoleSession(contractorId: string) {
  const token = base64url(crypto.randomBytes(32));
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14);
  await q(
    "insert into sole_contractor_sessions(contractor_id, token, expires_at) values($1,$2,$3)",
    [contractorId, token, expires.toISOString()]
  );
  return { token, expires };
}

export async function requireSoleContractor(event: any) {
  const cookies = parseCookies(event?.headers?.cookie);
  const token = cookies[COOKIE];
  if (!token) return null;
  const now = new Date().toISOString();
  const result = await q(
    `select s.token, c.id, c.email, c.status
       from sole_contractor_sessions s
       join sole_contractors c on c.id = s.contractor_id
      where s.token = $1 and s.expires_at > $2
      limit 1`,
    [token, now]
  );
  if (!result.rows.length) return null;
  return result.rows[0];
}

export async function ensureSoleSalesSchema() {
  if (schemaReady) return schemaReady;
  schemaReady = (async () => {
    await q("create extension if not exists pgcrypto", []);
    await q(
      `create table if not exists sole_contractors (
         id text primary key,
         email text not null unique,
         password_hash text not null,
         status text not null default 'approved',
         created_at timestamptz not null default now(),
         updated_at timestamptz not null default now()
       )`,
      []
    );
    await q(
      `create table if not exists sole_contractor_sessions (
         token text primary key,
         contractor_id text not null references sole_contractors(id) on delete cascade,
         expires_at timestamptz not null,
         created_at timestamptz not null default now()
       )`,
      []
    );
    await q(
      `create table if not exists sole_sales_leads (
         id text primary key,
         contractor_id text not null references sole_contractors(id) on delete cascade,
         business_name text not null,
         contact_name text,
         phone text,
         email text,
         instagram text,
         website text,
         city text,
         niche text,
         stage text not null default 'New Lead (Unworked)',
         next_step_at timestamptz,
         recommended_package text,
         production_interest text,
         notes text,
         last_activity_at timestamptz,
         created_at timestamptz not null default now(),
         updated_at timestamptz not null default now()
       )`,
      []
    );
    await q(
      `create table if not exists sole_sales_activities (
         id text primary key,
         lead_id text not null references sole_sales_leads(id) on delete cascade,
         contractor_id text not null references sole_contractors(id) on delete cascade,
         channel text not null,
         note text not null default '',
         created_at timestamptz not null default now()
       )`,
      []
    );
    await q(
      `create table if not exists sole_sales_templates (
         id text primary key,
         channel text not null,
         title text not null,
         body text not null,
         published boolean not null default true,
         updated_at timestamptz not null default now()
       )`,
      []
    );
    await q("create index if not exists idx_sole_sales_leads_contractor on sole_sales_leads(contractor_id, updated_at desc)", []);
    await q("create index if not exists idx_sole_sales_activities_lead on sole_sales_activities(lead_id, created_at desc)", []);
  })();
  return schemaReady;
}

export function boolFromEnv(value: string | undefined, fallback: boolean) {
  if (typeof value !== "string" || !value.trim()) return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

export function normalizeLead(row: Record<string, any>) {
  return {
    id: row.id,
    businessName: row.business_name || "",
    contactName: row.contact_name || "",
    phone: row.phone || "",
    email: row.email || "",
    instagram: row.instagram || "",
    website: row.website || "",
    city: row.city || "",
    niche: row.niche || "",
    stage: row.stage || "New Lead (Unworked)",
    nextStepAt: row.next_step_at || null,
    recommendedPackage: row.recommended_package || "",
    productionInterest: row.production_interest || "",
    notes: row.notes || "",
    lastActivityAt: row.last_activity_at || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

export function normalizeActivity(row: Record<string, any>) {
  return {
    id: row.id,
    leadId: row.lead_id,
    channel: row.channel || "Activity",
    note: row.note || "",
    createdAt: row.created_at || null,
  };
}

export function normalizeTemplate(row: Record<string, any>) {
  return {
    id: row.id,
    channel: row.channel || "",
    title: row.title || "",
    text: row.body || "",
    published: Boolean(row.published),
    updatedAt: row.updated_at || null,
  };
}
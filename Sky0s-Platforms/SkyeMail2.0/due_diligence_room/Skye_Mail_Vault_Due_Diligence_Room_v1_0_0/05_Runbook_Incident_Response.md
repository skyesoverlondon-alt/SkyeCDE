# Operations Runbook & Incident Response — Skye Mail Vault — Business Email Center

Effective date: February 21, 2026

Support: SkyesOverLondonLC@solenterprises.org

## Severity levels
- SEV‑1: complete outage, widespread auth failure, suspected data exposure
- SEV‑2: partial outage, delayed notifications, DB saturation, elevated errors
- SEV‑3: minor degradation with workaround
- SEV‑4: cosmetic issues

## Incident workflow
1) Declare incident (timestamp, scope, owner)  
2) Stabilize (stop bleeding)  
3) Diagnose (isolate component)  
4) Mitigate (fix, rollback, throttle, disable inbound)  
5) Recover (verify core flows)  
6) Postmortem (timeline, root cause, actions)

## Common scenarios

### A) API failures (5xx spikes)
- Check Netlify function logs for dominant signature.
- Validate env vars: DATABASE_URL, RESEND_API_KEY, JWT_SECRET, IP_HASH_SALT.
- Check Neon connections.
Mitigation: tighten rate limits, disable heavy paths, rollback if regression.

### B) Neon saturation (timeouts / too many connections)
- Check Neon CPU/IO/connections.
Mitigation: reduce concurrent workload, optimize indexes, add pooling.

### C) Resend delivery failures
- Confirm DNS (SPF/DKIM/DMARC) and Resend status.
Mitigation: retry strategy (roadmap), manual resend, user comms.

### D) Abuse/Bot attack
- Enable Turnstile.
- Tighten IP-hash limits; add denylist buckets.
- Rotate thread tokens for abused threads.

### E) Suspected compromise
Immediate:
- Rotate JWT_SECRET (forces logout)
- Rotate API keys (Resend/Postmark)
- Consider temporary read-only mode (disable submits)
Investigate logs; determine metadata exposure vs ciphertext only; communicate as required.

## Backup & restore
- Neon backups must be enabled operationally.
Restore drill:
1) restore snapshot to new branch
2) point DATABASE_URL
3) smoke test: login, submit, inbox list, open message, attachment download

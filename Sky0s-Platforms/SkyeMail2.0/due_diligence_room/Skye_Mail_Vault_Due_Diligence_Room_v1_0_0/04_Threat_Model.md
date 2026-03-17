# Threat Model — Skye Mail Vault — Business Email Center

Effective date: February 21, 2026

## Assets
A1 Message content (ciphertext stored)  
A2 Attachment content (ciphertext stored)  
A3 Vault private keys (wrapped at rest; unwrapped in browser only)  
A4 Account credentials and sessions  
A5 Thread reply tokens  
A6 Service availability

## Actors
- Legitimate sender (public)
- Legitimate recipient (authenticated)
- Opportunistic attacker
- Targeted attacker (phishing/malware)
- Malicious insider
- Subprocessor compromise

## Attack surfaces
S1 Public submit endpoints  
S2 Auth endpoints  
S3 Message/attachment retrieval  
S4 Browser UI (XSS, extensions)  
S5 Email links (phishing, leakage)  
S6 Inbound pipeline  
S7 Database/logs

## Threats & mitigations (summary)

### XSS
Mitigations: HttpOnly cookies, strict CSP, output escaping.  
Residual: XSS could still act as user; prioritize CSP discipline and avoid unsafe DOM APIs.

### CSRF
Mitigations: SameSite=Strict + CSRF token required for writes.

### Brute force / credential stuffing
Mitigations: hashed-IP rate limiting on auth endpoints; verified email requirement.

### Bot spam on public intake
Mitigations: hashed-IP limits + sender throttles + optional Turnstile.

### Thread token leakage
Mitigations: long random tokens; stored hashed; ability to rotate/revoke threads operationally.

### Server/DB compromise
Mitigations: ciphertext at rest; vault passphrase not stored.  
What leaks: metadata, wrapped key blobs, timestamps, sender emails (if provided).

### Inbound provider boundary
Mitigations: opt-in; prefer SMTP bridge mode for earliest encryption.

## Recommended abuse thresholds
- Public submit: 10/min/IP, 60/hour/IP, plus 10/hour per sender email
- Thread reply: 10/min/IP, 60/hour/IP
- Signup: 5/hour/IP
- Reset: 5/hour/IP

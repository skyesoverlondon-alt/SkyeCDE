# Skye Mail Vault — Business Email Center — Due Diligence Room (v1.0.0)

Effective date: February 21, 2026  
Owner / Vendor: Skyes Over London LC (Phoenix, Arizona, United States)  
Support contact: SkyesOverLondonLC@solenterprises.org

This package is a buyer-ready diligence folder for Skye Mail Vault — Business Email Center. It includes operational runbooks, security posture, threat model, architecture & data flows, and customer-facing legal terms.

## Contents
1. 01_Acquirer_One_Pager.md
2. 02_Architecture_and_Data_Flow.md
3. 03_Security_Overview.md
4. 04_Threat_Model.md
5. 05_Runbook_Incident_Response.md
6. 06_Monitoring_Alerting_Checklist.md
7. 07_Subprocessors_and_Data_Map.md
8. 08_Terms_of_Service.md
9. 09_Privacy_Policy.md
10. 10_Data_Processing_Addendum_DPA.md

## Product summary
Skye Mail Vault — Business Email Center is an encrypted message vault and “business email center” that lets a recipient publish a shareable address (e.g., /u/handle) to receive secure messages and encrypted attachments. Messages are encrypted client-side for the recipient’s vault key, stored as ciphertext in the database, and surfaced in a web inbox where decryption occurs locally after vault unlock. The system supports secure thread reply links, optional inbound email ingestion via an SMTP bridge or inbound provider, and optional AI assistance (via Kaixu Gateway) for summarization/drafting when a user explicitly uses the AI feature.

## Definitions (used across documents)
- **Ciphertext**: Encrypted data stored server-side that is not readable without a vault private key.
- **Vault Passphrase**: User secret used locally to unwrap the vault private key; not transmitted to the service.
- **Metadata**: Non-content fields such as timestamps, sender email, thread identifiers, delivery status, attachment sizes, and rate-limit buckets.
- **Customer / Account Owner**: The organization or individual that controls a vault account.
- **End User**: An authorized user under a Customer account.

## Notes
- These documents describe the enterprise-hardened build with strict CSP (no unsafe-inline), HttpOnly cookie auth + CSRF, email verification, password reset, hashed-IP rate limiting, and batched inbox decryption.
- No document claims formal certifications (e.g., SOC 2) unless a separate attestation is provided.

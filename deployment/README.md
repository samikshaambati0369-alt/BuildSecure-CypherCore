# Deployment Documentation — Build Secure 24

## Overview

This directory contains deployment configuration and deployment records for your application.
Place all relevant infrastructure and deployment configuration files here.

---

## Live Deployment Reference

- **Live Application URL:** 
- **Hosting Platform:** 
- **Access Credentials (if test demo accounts are needed for evaluators):**
  - Role / User 1:
  - Role / User 2:

---

## Required Environment Variables

Document all required environment configuration keys needed to run the application:

| Variable Name | Description | Required (Yes/No) |
|---------------|-------------|-------------------|
| `PORT` | Backend HTTP port | No |
| `FRONTEND_URL` | Exact trusted frontend origin for CORS and browser-origin checks | Yes |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | MySQL connection settings | Yes |
| `JWT_SECRET` | Long random secret used to sign session tokens | Yes |
| `JWT_EXPIRES_IN` | Session token lifetime (for example `2h`) | No |
| `COOKIE_SECURE` | Set `true` when served over HTTPS; use `false` only for local HTTP development | Yes |
| `AI_API_KEY` | Server-side OpenAI API key; never expose it in frontend variables | No (local fallback is used if omitted) |
| `AI_API_URL` | Must be `https://api.openai.com/v1/chat/completions` | No |
| `AI_MODEL` | OpenAI chat model (default: `gpt-4o-mini`) | No |

---

## Build & Deployment Instructions

Provide step-by-step instructions for building and launching the deployment:

1. 
2. 
3. 

For local development, copy `src/backend/.env.example` to `src/backend/.env` and set the values for your machine. The backend `.env` file is ignored by Git; add the OpenAI API key only there, never in frontend variables. If a real credential was previously committed, rotate it because ignoring the file does not remove it from Git history. The assistant falls back to local spending summaries when no key is configured.

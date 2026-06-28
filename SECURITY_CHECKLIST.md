# Pre-Launch Security Checklist

## ✅ Completed Items

- [x] **Security headers added to `vercel.json`**
  - HSTS (HTTP Strict Transport Security)
  - X-Frame-Options (clickjacking protection)
  - X-Content-Type-Options (MIME sniffing prevention)
  - Content-Security-Policy (XSS protection)
  - X-XSS-Protection (legacy XSS protection)
  - Referrer-Policy (privacy)
  - See `vercel.json` for full headers configuration

- [x] **Verified secrets are NOT tracked in git**
  - `.vercel/` is in `.gitignore`
  - No `.env` files are being tracked
  - No API keys in git history

- [x] **Input validation in critical API functions**
  - `account.js` — validates email format, password length, required fields
  - `meeting.js` — filters empty/whitespace messages, validates history structure
  - `ask.js` — validates history is array and non-empty
  - `feedback.js` — validates email format and required fields
  - Auth uses crypto.scrypt + timing-safe comparisons (no timing attacks)

---

## ⚠️ CRITICAL: Manual Actions Required Before Launch

### 1. **Set `AUTH_SECRET` in Vercel** (BLOCKING - required for login/signup to work)
**Why:** Accounts feature will fail without this — session cookies can't be signed.

**Steps:**
1. Go to https://vercel.com/dashboard/usman-s-first-website/settings/environment-variables
2. Click "Add New"
3. Name: `AUTH_SECRET`
4. Value: Run this in your terminal to generate a secure random string:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
5. Paste the output as the value
6. Save and redeploy the site

**Verify:** Try signing up or logging in after redeployment. If accounts don't work, check that AUTH_SECRET was set correctly.

---

### 2. **Set `CRON_SECRET` in Vercel** (Recommended - prevent unauthorized cron execution)
**Why:** The daily follow-up email cron (`/api/account?action=cron-followups`) currently has no protection.

**Steps:**
1. Go to https://vercel.com/dashboard/usman-s-first-website/settings/environment-variables
2. Click "Add New"
3. Name: `CRON_SECRET`
4. Value: Run this in your terminal:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
5. Save and redeploy

**Note:** After setting this, the cron will require the secret. If you want to test it manually, add `?secret=<CRON_SECRET>` to the URL, or update `vercel.json` to pass it as a header.

---

### 3. **Set `RESEND_WEBHOOK_SECRET` in Vercel** (Recommended - validate inbound emails)
**Why:** Currently, `/api/inbound-email.js` accepts webhooks from Resend without signature verification.

**Steps:**
1. Go to https://resend.com/webhooks
2. Find your webhook for inbound emails (or create one for `email.inbound_received`)
3. Copy the **Signing Secret**
4. Go to https://vercel.com/dashboard/usman-s-first-website/settings/environment-variables
5. Click "Add New"
6. Name: `RESEND_WEBHOOK_SECRET`
7. Value: Paste the signing secret
8. Save and redeploy

**Verify:** Inbound email replies to Meeting Room summaries will now be validated before processing.

---

### 4. **GitHub: Enable Secret Scanning** (Recommended - catch leaked keys automatically)
**Steps:**
1. Go to https://github.com/usmanqureshi645-ai/Usman-s-first-website/settings/security_analysis
2. Scroll down to "Secret Scanning"
3. Toggle **"Enable secret scanning"** ON
4. (Optional) Toggle **"Automatic validity checks"** ON to verify leaked keys are real

**What it does:** GitHub will scan every commit for accidentally committed API keys, tokens, and passwords. If any are found, you'll get an alert and can revoke them immediately.

---

### 5. **GitHub: Enable Branch Protection** (Recommended - require review before merge to main)
**Steps:**
1. Go to https://github.com/usmanqureshi645-ai/Usman-s-first-website/settings/branches
2. Under "Branch protection rules", click "Add rule"
3. Branch name pattern: `main`
4. Check:
   - ✓ Require a pull request before merging
   - ✓ Require approvals (at minimum 1)
   - ✓ Require status checks to pass before merging (if you have CI)
   - ✓ Include administrators (so even you follow the rules)
5. Save

**What it does:** Prevents accidental direct pushes to `main`. All changes must go through a PR review first.

---

### 6. **Update `dashboard.html` Access** (Recommended - add authentication)
**Current issue:** The admin dashboard is protected by a **query parameter** (`?key=<REDIS_TOKEN>`), which is the same token used to access your Redis database. This is a security anti-pattern.

**Recommended approach:**
- Option A (Simple): Add an additional check in `dashboard.html` to require a separate admin password set in a new Vercel env var (`DASHBOARD_ADMIN_PASSWORD`)
- Option B (Better): Create a new `/api/dashboard-auth.js` endpoint that validates `AUTH_SECRET` and an admin email list, so only logged-in admins can access

**For now (if you're short on time):**
- Keep the current `?key=<REDIS_TOKEN>` pattern BUT:
  - Never share the dashboard URL publicly
  - Use a separate read-only Redis key if Upstash supports it
  - Monitor who accesses it via Vercel logs

---

## 📋 Post-Launch Recommendations

### Short Term (Next 1-2 weeks)
- [ ] **Enable Dependabot** on GitHub for automated dependency updates
  - https://github.com/usmanqureshi645-ai/Usman-s-first-website/settings/security_analysis → enable "Dependabot"
- [ ] **Minify frontend code** before production (optional but effective)
  - Add build step: `npm install --save-dev terser html-minifier`
  - Run minifiers before each deploy
- [ ] **Monitor Vercel logs** for errors, failed auth attempts, or suspicious patterns
  - https://vercel.com/dashboard/usman-s-first-website/logs
- [ ] **Test the feedback resolve endpoint** to ensure reporters get thank-you emails when bugs are fixed

### Medium Term (Monthly)
- [ ] **Run `npm audit`** to check for vulnerabilities
  ```bash
  npm audit
  npm audit fix  # if vulnerabilities found
  ```
- [ ] **Review Vercel analytics** for unusual traffic patterns
- [ ] **Check Upstash dashboard** for unexpected data growth or access patterns
- [ ] **Monitor Resend email deliverability** to ensure emails aren't getting flagged as spam

### Long Term (Quarterly)
- [ ] **Conduct a security audit** of new features before deploying to production
- [ ] **Update dependencies** monthly and test changes before merging
- [ ] **Review error logs** for patterns that suggest attempts to exploit the site
- [ ] **Consider adding rate limiting** to expensive endpoints (`/api/ask`, `/api/meeting`, `/api/fsreview`)

---

## Security Implementation Details

### Secrets Management (✅ Correctly Implemented)
- ✅ All API keys (`ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `UPSTASH_REDIS_REST_TOKEN`) are **only** in Vercel environment variables
- ✅ No `.env` files in git
- ✅ No secrets hardcoded anywhere
- ⚠️ `UPSTASH_REDIS_REST_TOKEN` is exposed to `/feedback?key=...` for read access (acceptable but not ideal)

### Authentication (✅ Solid Implementation)
- ✅ Passwords hashed with `crypto.scrypt` (industry-standard)
- ✅ Session tokens signed with HMAC-SHA256
- ✅ Timing-safe comparison prevents timing attacks
- ✅ Cookies are `HttpOnly`, `Secure`, `SameSite=Lax`
- ✅ `AUTH_SECRET` properly required (will throw error if not set)
- ⚠️ No multi-factor authentication (acceptable for a free tool)

### API Security (⚠️ Needs Input Validation Hardening)
**Current state:** Basic input validation exists but could be more robust.

**Recommended improvements (priority order):**
1. **Validate message content for XSS** — even though it's sent to Claude, sanitize at API boundary
2. **Validate `agents` parameter in `/api/meeting`** — currently not validated
3. **Validate file uploads** — ensure they're actually PDFs/DOCX, not executable files
4. **Add rate limiting** on expensive endpoints to prevent abuse
5. **Sanitize error messages** — avoid exposing internal details

### Headers & Middleware (✅ Updated)
- ✅ HSTS enabled (1 year, preload)
- ✅ X-Frame-Options: DENY (prevent clickjacking)
- ✅ X-Content-Type-Options: nosniff (prevent MIME sniffing)
- ✅ Content-Security-Policy (prevent XSS)
- ✅ Referrer-Policy (privacy)

### Database Security (✅ Good)
- ✅ Redis accessed via REST API with token authentication
- ✅ Token stored in Vercel env, not exposed in code
- ⚠️ No encryption at rest (Upstash doesn't offer this on free tier)

---

## Testing Before Launch

### 1. **Verify Core Features Work**
- [ ] Signup with a test email
- [ ] Login and logout
- [ ] Save a consultation to workspace
- [ ] Resume a saved consultation
- [ ] Meeting Room chat works
- [ ] Knowledge Test works
- [ ] GAAP Compare works
- [ ] Financial Statement Review works
- [ ] CV Review works
- [ ] Feedback widget works

### 2. **Verify Security Headers**
Run this in your browser's Developer Console on the live site:
```javascript
// Should show all security headers
fetch('https://usman-s-first-website.vercel.app/', { method: 'HEAD' })
  .then(r => Object.entries(r.headers).forEach(([k, v]) => 
    k.toLowerCase().includes('security') || k.toLowerCase().includes('x-') || k.toLowerCase().includes('content-') 
      ? console.log(`${k}: ${v}`) : null))
```

Or use a tool: https://securityheaders.com/?q=usman-s-first-website.vercel.app

Expected: Should get an A or B grade, with all major headers present.

### 3. **Verify Secrets Are Safe**
```bash
# Scan git history for any accidental commits
cd ACTIVE_CODE
git log -p | grep -iE "api.key|anthropic_api_key|resend_api_key|auth_secret" || echo "Clean!"
```

Should return "Clean!" (no secrets in history).

### 4. **Test Auth Flows**
- [ ] Login redirects correctly
- [ ] Session persists across page reloads
- [ ] Logout clears session
- [ ] Accessing logged-in features without auth returns 401

---

## Emergency Response

If you suspect a security breach:

1. **Immediately revoke all secrets in Vercel:**
   - Generate new `ANTHROPIC_API_KEY` from Anthropic console
   - Generate new `RESEND_API_KEY` from Resend console
   - Rotate `UPSTASH_REDIS_REST_TOKEN` from Upstash console
   - Set new `AUTH_SECRET` and `CRON_SECRET`

2. **Force a redeployment:**
   ```bash
   git push --force # (if needed to rollback) or just make a small commit and push
   ```

3. **Check logs for suspicious activity:**
   - Vercel logs: https://vercel.com/dashboard/usman-s-first-website/logs
   - Upstash logs: https://console.upstash.com
   - Resend logs: https://resend.com/emails

4. **Notify users if data was exposed** (check if any consultation history or feedback was accessed)

---

## Questions?

Refer to the full security plan in `/plans/cheerful-seeking-fern.md` for detailed implementation guidance on each area.


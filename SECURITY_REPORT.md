# Security Assessment Report: IT PMO Kanban Board

| | |
|---|---|
| **Repository** | `Training` (GitHub Pages static site) |
| **Assessment date** | 2026-10-19 |
| **Commit assessed** | `ed3590c` (main) plus untracked working-tree files (`v3/`, `.mcp.json`, `skills-lock.json`, `.agents/`) |
| **Method** | Manual SAST of all application code by two scanning agents (app-code agent; secrets/CI/supply-chain agent), with key findings re-checked against the source |
| **Frameworks** | CIA triad, STRIDE, OWASP Top 10 2021, OWASP CI/CD Top 10, OWASP LLM Top 10 2025, MITRE ATT&CK, CWE, CVSS 3.1 |

---

## 1. Executive summary

**Overall risk: LOW.** The scan found **no Critical or High findings, no exploitable XSS, and no secrets** in the working tree or in the full git history (11 commits).

The application is a client-side Kanban board with no backend, no authentication and no persistent task storage. The code handles input well: every user-supplied value goes through an HTML-escaping helper or `textContent` before it reaches the DOM, and form input is checked against strict allowlists in JavaScript.

The real risk sits in two areas:

1. **The FormSubmit email integration (v1, v2).** It is inactive today because the endpoint is still a placeholder. As soon as a real address is configured, it becomes an open, captcha-disabled relay that anyone can use to spam the PMO inbox or send it phishing emails.
2. **Supply chain for development tooling.** The Playwright MCP server is unpinned and auto-installs, and the third-party agent skills are unpinned.

| Severity | Count | Findings |
|---|---|---|
| Critical | 0 | none |
| High | 0 | none |
| Medium | 2 | SEC-01, SEC-02 |
| Low | 7 | SEC-03 to SEC-09 |
| Info | 7 | SEC-10 to SEC-16 |

**Remediation update (2026-10-19):** All P1 and P2 items are now fixed in the working tree, but nothing is committed yet. That covers SEC-01 to SEC-08 and SEC-15, apart from the parts only the owner can do (see §11). With these in place, residual risk is **LOW**, and the Medium findings drop to Low or Info.

**Top three actions (original)**

1. Fix SEC-01, SEC-03 and SEC-04 **before** setting a real FormSubmit address.
2. Pin `@playwright/mcp` to an exact version (SEC-02).
3. Add a Content-Security-Policy and self-host the fonts (SEC-05, SEC-06).

---

## 2. Scope and context

| Asset | Description | Deployed? |
|---|---|---|
| `index.html` (v1) | Kanban board with an Add Task form and a FormSubmit email notification. No external resources. | Yes |
| `v2/index.html` | Redesign of v1 with the same logic. Adds Google Fonts and stores the theme choice in `localStorage`. | Yes |
| `v3/index.html` | Static visual mock: drag and drop only, no form, Google Fonts | No (untracked, not in workflow) |
| `.github/workflows/pages.yml` | Build and deploy to GitHub Pages | n/a |
| `.mcp.json` | Local Playwright MCP server config | No (untracked) |
| `skills-lock.json`, `.agents/skills/**`, `.claude/**` | Third-party and local Claude agent skills | No (untracked or gitignored) |

### 2.1 Data classification

| Data | Classification | Where it lives |
|---|---|---|
| Seed and user-entered tasks | Internal (demo data) | Browser memory only. Lost on refresh. |
| Theme preference | Public | `localStorage` key `pmo-theme` (v2) |
| PMO recipient email (once configured) | Internal / PII | Hard-coded in client JS (v1, v2) |
| Task data emailed via FormSubmit | Internal | FormSubmit (third party), then the PMO mailbox |

### 2.2 Attack surface

| Entry point | v1 | v2 | v3 | Trust boundary crossed |
|---|---|---|---|---|
| Add Task form | ✔ | ✔ | none | User to DOM, and user to FormSubmit to mailbox |
| Assignee filter / search | ✔ | ✔ | none | User to DOM |
| Drag and drop (`dataTransfer`) | ✔ | ✔ | ✔ | Another origin's drag source to app |
| `localStorage` read | none | ✔ (theme) | none | Storage to DOM attribute |
| Outbound `fetch` to formsubmit.co | ✔ | ✔ | none | Browser to third party |
| Google Fonts CSS | none | ✔ | ✔ | Third party to page |
| CI/CD pipeline | ✔ | ✔ | none | Repo to GitHub Pages |
| Developer tooling (MCP, skills) | n/a | n/a | n/a | npm/GitHub to developer workstation |

**Not present:** URL hash or query parsing, JSON import, `eval` / `new Function` / string `setTimeout`, `document.write`, inline `on*` handlers, `target="_blank"` links, and third-party JavaScript.

### 2.3 Threat actors

| Actor | Motivation | Relevance |
|---|---|---|
| Opportunistic spammers and bots | Abuse open form relays | **High** once FormSubmit is configured |
| Phishers | Use a trusted-looking PMO email channel | Medium (needs FormSubmit) |
| Supply-chain attackers | Compromise npm packages or GitHub repos | Medium (developer workstation) |
| Malicious framing site | Clickjacking | Low (state is per-tab and in memory) |
| Insider or PR author | Abuse CI token scope | Low (forks get read-only tokens) |

---

## 3. Findings

Severity combines CVSS 3.1 with environmental context: likelihood, whether the issue is exploitable today, and the value of what's at risk. Findings marked **(conditional)** only become exploitable after the FormSubmit endpoint is configured.

### SEC-01: FormSubmit endpoint is an open, captcha-disabled relay (conditional)
| | |
|---|---|
| **Severity** | 🟠 **Medium**. CVSS 3.1 `AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:L/A:L` = **6.5** once configured. |
| **Location** | [index.html:654](index.html:654), [index.html:1004](index.html:1004); [v2/index.html:651](v2/index.html:651), [v2/index.html:1011](v2/index.html:1011) |
| **Classification** | CWE-799, CWE-770 · OWASP A04:2021 Insecure Design · STRIDE: **Spoofing, Denial of Service** · ATT&CK T1499 / T1566 |
| **CIA impact** | Integrity (forged tasks), Availability (inbox flooding) |

**Evidence**
```js
const FORMSUBMIT_ENDPOINT = "https://formsubmit.co/ajax/YOUR_EMAIL@example.com";
...
_captcha: "false",
```

**Attack scenario:** The endpoint URL is in public page source. Anyone can POST arbitrary JSON to it in a loop, without ever visiting the site. Client-side `validateTask` offers no protection for a third-party endpoint, and `_captcha: "false"` removes FormSubmit's own bot defense. The result is a flooded PMO inbox full of forged "New task" emails.

**Current status:** Not exploitable. The placeholder guard throws before sending.

**Remediation**
- Use FormSubmit's random-string alias endpoint instead of the raw email address.
- Remove `_captcha: "false"`, or add a `_honey` honeypot field. Set `_blacklist`.
- Treat these emails as *unverified notifications*, never as the system of record.
- Long term: a serverless relay with rate limiting plus a Cloudflare Turnstile token.

---

### SEC-02: Playwright MCP server is unpinned (`@latest`) and auto-installs (`-y`)
| | |
|---|---|
| **Severity** | 🟠 **Medium**. CVSS 3.1 `AV:N/AC:H/PR:N/UI:R/S:U/C:H/I:H/A:H` = 7.5 by formula; ~5.0 after adjusting for low likelihood. |
| **Location** | [.mcp.json:6](.mcp.json:6) |
| **Classification** | CWE-494, CWE-829, CWE-1357 · OWASP A08:2021, A06:2021, LLM03:2025 Supply Chain · STRIDE: **Tampering, Elevation of Privilege** · ATT&CK **T1195.001** |
| **CIA impact** | Confidentiality, Integrity and Availability of the developer workstation |

**Evidence**
```json
"args": ["/c", "npx", "-y", "@playwright/mcp@latest"]
```

**Attack scenario:** Every Claude Code launch resolves and runs the latest version of the package and its whole dependency tree, without a prompt. A hijacked maintainer account or a compromised transitive dependency would get code execution with the user's privileges and a browser it controls. If `.mcp.json` is committed (SEC-08), every person who clones the repo inherits this. Claude Code's project-MCP approval prompt partly mitigates it.

**Remediation:** Pin an exact version (`@playwright/mcp@0.0.X`) and bump it deliberately. Better still, add it as a devDependency with a lockfile (`npm ci`) and run the local binary.

---

### SEC-03: Untrusted task text relayed into PMO email (content / phishing injection) (conditional)
| | |
|---|---|
| **Severity** | 🟡 **Low**. CVSS 3.1 up to `AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N` = 6.1 if FormSubmit renders raw HTML; realistically ~4.0 |
| **Location** | [index.html:1002](index.html:1002) (and lines 1006–1011); [v2/index.html:1009](v2/index.html:1009) (and lines 1009–1018) |
| **Classification** | CWE-74, CWE-80 · OWASP A03:2021 Injection · STRIDE: **Spoofing, Tampering** · ATT&CK T1566.002 |

**Evidence**
```js
_subject: `[UOB IT PMO] New task ${task.id}: ${task.title}`,
```

**Attack scenario:** An anonymous visitor puts a phishing link or lure in the task title or description. It arrives in the PMO inbox inside an official-looking `[UOB IT PMO]` table email. Whether FormSubmit escapes the HTML was not verified, and plain-text lures get through either way.

**Remediation:** Put only the task ID in `_subject`. Add an "Unverified public submission" banner field. Optionally strip URLs from the description.

---

### SEC-04: Recipient email address exposed in client source (conditional)
| | |
|---|---|
| **Severity** | 🟡 **Low**. CVSS 3.1 `AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N` = 5.3 by formula; Low in practice. |
| **Location** | [index.html:654](index.html:654), [v2/index.html:651](v2/index.html:651) |
| **Classification** | CWE-200, CWE-359 · OWASP A05:2021 · STRIDE: **Information Disclosure** · ATT&CK T1589.002 (Gather Email Addresses) |

**Attack scenario:** Scrapers harvest the address, which leads to spam and targeted phishing of the PMO mailbox.
**Remediation:** Use the FormSubmit hashed alias, or a relay that keeps the address server-side.

---

### SEC-05: No Content-Security-Policy in any version
| | |
|---|---|
| **Severity** | 🟡 **Low** (defense in depth). Amplifier only, ~4.2. |
| **Location** | `<head>` of [index.html](index.html:3), [v2/index.html](v2/index.html:3), [v3/index.html](v3/index.html:3) |
| **Classification** | CWE-693 · OWASP A05:2021 Security Misconfiguration · STRIDE: **Elevation of Privilege** (mitigation gap) |

**Impact:** No XSS exists today. If a future change introduces an unescaped sink (see SEC-12), nothing would limit script execution or data exfiltration.

**Remediation:** Add a hash-based meta CSP. Example for v2:
```html
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'sha256-<theme-script>' 'sha256-<main-script>'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; connect-src https://formsubmit.co; img-src 'self' data:; base-uri 'none'; form-action 'none'">
```
- **v1:** drop the font sources.
- **v3:** use `connect-src 'none'` and keep `img-src data:` for the grain SVG.

---

### SEC-06: Third-party Google Fonts stylesheet (no SRI, unpinned, privacy leak)
| | |
|---|---|
| **Severity** | 🟡 **Low**. CVSS 3.1 `AV:N/AC:H/PR:N/UI:R/S:U/C:L/I:L/A:N` = **4.2**. |
| **Location** | [v2/index.html:8-10](v2/index.html:8), [v3/index.html:8-10](v3/index.html:8). v1 loads nothing external. |
| **Classification** | CWE-829, CWE-353, CWE-359 · OWASP A08:2021 · STRIDE: **Tampering, Information Disclosure** · ATT&CK T1195 |

**Impact**
- A compromised or MITM'd stylesheet could inject CSS, enabling UI redress or attribute-selector beacons.
- SRI is impossible because Google varies the CSS by user agent.
- Every visitor's IP address goes to Google. A German court (LG München, 2022) ruled this a GDPR violation.

**No third-party JavaScript is loaded anywhere.**

**Remediation:** Self-host the `woff2` files with a local `@font-face`, remove the preconnects, and set the CSP to `font-src 'self'`.

---

### SEC-07: Over-broad CI token permissions at workflow level
| | |
|---|---|
| **Severity** | 🟡 **Low**. CVSS 3.1 `AV:N/AC:H/PR:H/UI:N/S:U/C:N/I:L/A:N` = **2.2**. |
| **Location** | [.github/workflows/pages.yml:11-14](.github/workflows/pages.yml:11) |
| **Classification** | CWE-250 · OWASP CI/CD **CICD-SEC-5** (Insufficient PBAC), A01:2021 · STRIDE: **Elevation of Privilege** · ATT&CK T1528 |

**Evidence:** `pages: write` and `id-token: write` are granted to every job, including `build`, which also runs on `pull_request`. Only `deploy` needs them.

**Mitigating factors**
- Fork PRs get read-only tokens.
- No untrusted `${{ }}` expression appears in any `run:` step.
- `deploy` is gated to `refs/heads/main` and the `github-pages` environment.

**Remediation:** Keep only `contents: read` at workflow level and move `pages: write` / `id-token: write` into the `deploy` job.

---

### SEC-08: Untracked tooling config not gitignored; `skills-lock.json` leaks a local path
| | |
|---|---|
| **Severity** | 🟡 **Low**. CVSS 3.1 `AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N` = 5.3 by formula; Low in practice. |
| **Location** | [.gitignore](.gitignore), [skills-lock.json:4](skills-lock.json:4) |
| **Classification** | CWE-538 · OWASP A05:2021 · STRIDE: **Information Disclosure** · ATT&CK T1592 |

**Evidence:** `.mcp.json`, `skills-lock.json` and `.agents/` are neither tracked nor ignored, so `git add .` would publish them. `skills-lock.json` contains a local Windows temp path that includes the username and a session UUID. Committing these files would also spread SEC-02 and SEC-10 to anyone who clones the repo.

**Remediation:** Either add them to `.gitignore`, or commit them deliberately after pinning versions and replacing the local skill source.

---

### SEC-09: No clickjacking protection (platform limitation)
| | |
|---|---|
| **Severity** | 🟡 **Low**. CVSS 3.1 `AV:N/AC:L/PR:N/UI:R/S:U/C:N/I:L/A:N` = **4.3**. |
| **Location** | All pages |
| **Classification** | CWE-1021 · OWASP A05:2021 · STRIDE: **Tampering, Spoofing** |

**Context:** GitHub Pages cannot send `X-Frame-Options` headers, and browsers ignore `frame-ancestors` in a meta CSP. Impact is low because board state lives in memory per tab.

**Remediation:** Accept and document the risk, or add a JS frame-buster (`if (top !== self) document.documentElement.style.display = "none"`). For real header control, serve the site through Cloudflare or Netlify.

---

### Informational findings

| ID | Finding | Location | Classification | Recommendation |
|---|---|---|---|---|
| **SEC-10** | Third-party agent skills are unpinned (no commit SHA). `persona-project-manager` can send Gmail, upload to Drive and send calendar invites (excessive agency). The `cybersecurity-analyst` skill comes from a temp scratchpad path. **No malicious content found.** | [skills-lock.json:10-29](skills-lock.json:10), `.agents/skills/` | CWE-1357 · LLM03 Supply Chain, LLM01, LLM06 · STRIDE Tampering · T1195.001 | Pin each skill to a SHA and review diffs before updating. Remove unused skills. Move local skills to a stable location. |
| **SEC-11** | GitHub Actions pinned by major tag, not commit SHA. All are first-party `actions/*`. | [pages.yml:26,40,43,57](.github/workflows/pages.yml:26) | CWE-829 · CICD-SEC-3 · T1195.002 | Pin to full SHAs and let Dependabot (`github-actions`) keep them current. |
| **SEC-12** | Latent XSS sink: `priority` is interpolated into a class attribute without escaping. It is safe today only because of allowlist validation. It would become XSS if import, persistence or URL state were added. | [index.html:839](index.html:839), [v2/index.html:844](v2/index.html:844) | CWE-79 (latent), CWE-116 · A03:2021 · STRIDE EoP | Map through a lookup table (`PRIO_CLASS[task.priority] \|\| "medium"`) or escape the value. |
| **SEC-13** | Assignee length is enforced only by the HTML `maxlength`. `validateTask` checks only that it is non-empty. Self-DoS only. | [index.html:1043](index.html:1043), [v2/index.html:1050](v2/index.html:1050) | CWE-20, CWE-1284 · A04:2021 · STRIDE DoS | Add a JS length check (≤ 60). |
| **SEC-14** | Real bank acronym "UOB" used in task IDs and email subjects of a "fictitious bank" demo. It creates trademark and impersonation risk and makes SEC-03 phishing look more credible. | [index.html:655](index.html:655), [v2/index.html:652](v2/index.html:652) | STRIDE Spoofing | Use a neutral prefix (`ITPM-`, as v3 already does). |
| **SEC-15** | No referrer policy. The browser default already limits the leak to the origin, and there are no outbound links. | All `<head>`s | CWE-200 · A05:2021 | `<meta name="referrer" content="no-referrer">` |
| **SEC-16** | The `github-pages` environment's deployment-branch rule can't be verified from the repo. | [pages.yml:50-53](.github/workflows/pages.yml:50) | CICD-SEC-1 | Confirm Settings → Environments → github-pages → Deployment branches = `main`. |

---

## 4. STRIDE threat model summary

| STRIDE | Threat | Findings | Residual risk |
|---|---|---|---|
| **S**poofing | Forged task emails and phishing via the PMO channel; framed UI | SEC-01, 03, 09, 14 | Medium (conditional) |
| **T**ampering | Compromised npm package, skill, action or font CSS | SEC-02, 06, 10, 11 | Medium |
| **R**epudiation | Anonymous submissions can't be attributed | SEC-01 | Low (demo app, no audit need) |
| **I**nformation disclosure | Email exposure, local path leak, visitor IPs sent to Google | SEC-04, 06, 08, 15 | Low |
| **D**enial of service | Inbox flooding; oversized input (self only) | SEC-01, 13 | Low–Medium (conditional) |
| **E**levation of privilege | CI token scope; no CSP containment; latent sink | SEC-05, 07, 12 | Low |

## 5. MITRE ATT&CK mapping

| Tactic | Technique | Findings |
|---|---|---|
| Reconnaissance | T1589.002 Gather Email Addresses; T1592 Gather Victim Host Info | SEC-04, SEC-08 |
| Initial Access | T1195.001 / T1195.002 Supply Chain Compromise; T1566 Phishing | SEC-02, 10, 11; SEC-03 |
| Credential Access | T1528 Steal Application Access Token | SEC-07 |
| Impact | T1499 Endpoint Denial of Service (email flooding) | SEC-01 |

## 6. Risk heat map

| Likelihood ↓ / Impact → | Low | Medium | High |
|---|---|---|---|
| **High** | none | SEC-01* | none |
| **Medium** | SEC-06, SEC-09 | SEC-03* | none |
| **Low** | SEC-04*, SEC-08, SEC-13, SEC-15 | SEC-05, SEC-07, SEC-12 | SEC-02 |

\* = conditional. Likelihood applies once FormSubmit is configured; it is zero today.

---

## 7. Positive security controls (verified)

1. **Centralized output encoding.** `escapeHtml` ([index.html:717](index.html:717), v2 same line) and `esc` ([v3/index.html:535](v3/index.html:535)) encode `& < > " '`. That covers both text and quoted-attribute contexts, and every user-controlled field passes through them before `innerHTML`.
2. **`textContent` for dynamic messages.** Toasts, form errors, counters and progress text are never interpreted as HTML.
3. **Strict JS allowlist validation.** Project, category, priority and status must come from fixed arrays. Title is capped at 80 and description at 500 characters, and the date must match a regex and not be in the past. `readForm` reads a fixed field list, which prevents prototype pollution.
4. **Constrained drag and drop.** Drag payloads are used only as lookup keys, and unknown IDs or statuses are rejected. `CSS.escape` is used when building selectors.
5. **Safe `localStorage` use (v2).** Access is wrapped in try/catch, the value is allowlisted to `light`/`dark`, and no task data is stored.
6. **No dangerous APIs.** No `eval`, `Function`, string `setTimeout`, `document.write` or inline handlers. All events use `addEventListener`.
7. **No third-party JavaScript and no `target="_blank"`.** That removes script supply-chain risk and reverse tabnabbing.
8. **Guarded integration.** Sending is blocked until FormSubmit is configured. Non-2xx and `success:false` responses are handled, and a double-submit guard exists.
9. **Clean secrets posture.** No credentials in tree or history. Commits use the GitHub noreply email. `.gitignore` covers `.env*`, keys, certs, `credentials*.json`, `.claude/` and `.playwright-mcp/`.
10. **Sound CI design.** Uses `pull_request`, not `pull_request_target`. Build and deploy are split, and deploy is gated to `main` and the `github-pages` environment. The artifact is built from an explicit allowlist (only the HTML files ship). No script injection via `${{ }}`. All actions are first-party.
11. **Benign skill code.** The ui-ux-pro-max Python scripts use only the standard library, make no network calls and write files with slug sanitization. The visual-design skill can only be invoked explicitly.

---

## 8. Remediation roadmap

| Priority | When | Actions | Findings |
|---|---|---|---|
| **P1: Gate** | Before FormSubmit goes live | Alias endpoint, re-enable captcha or honeypot, task ID only in the subject, "unverified" banner | SEC-01, 03, 04 |
| **P1** | This week | Pin `@playwright/mcp` to an exact version; decide whether to gitignore or commit the tooling files | SEC-02, 08 |
| **P2** | Next iteration | Hash-based meta CSP and referrer meta; self-host fonts; job-scoped workflow permissions | SEC-05, 06, 07, 15 |
| **P3** | Backlog | Priority lookup map; assignee length check; neutral ID prefix; SHA-pin actions and skills; frame-buster; verify environment rule | SEC-09 to 14, 16 |

---

## 9. Compliance notes

- **GDPR:** Google Fonts sends visitor IPs to Google (SEC-06), and the FormSubmit flow processes task data through a third party. If the site is used with real EU users, self-host the fonts and document FormSubmit as a processor.
- **Trademark:** remove the real bank acronym from a fictitious demo (SEC-14).
- No PCI-DSS or HIPAA data is in scope.

## 10. Assumptions and limitations

- This was a static, manual review. No dynamic testing or live exploitation was done, and the deployed site was not probed.
- FormSubmit's server-side HTML escaping and rate limiting were not verified.
- GitHub repository settings (environment protection, branch protection, Dependabot) are not visible from the repo.
- The `actions/*@vN` tags and the npm package contents were not checked against upstream.
- `v3/index.html` is untracked and not deployed. It was reviewed as pending work.
- Third-party skills were skimmed for malicious patterns, not audited exhaustively. Their future updates are untrusted.

---

## 11. Remediation status (P1 + P2 applied 2026-10-19)

| ID | Status | Change made | Residual |
|---|---|---|---|
| SEC-01 | ✅ Fixed in code, ⏳ owner action | Removed `_captcha: "false"`. Added a hidden `_honey` honeypot field, passed through to FormSubmit. The config comment now requires the random-string **alias** endpoint. | Low. The owner must use the alias when configuring. |
| SEC-02 | ✅ Fixed | `.mcp.json` pinned to `@playwright/mcp@0.0.83` | Low |
| SEC-03 | ✅ Fixed | `_subject` now carries the task ID only, with "(unverified submission)". Added a `Notice` field warning the recipient not to trust the content. | Info |
| SEC-04 | ✅ Fixed in code, ⏳ owner action | Guidance to use the alias endpoint, so no raw address appears in page source | Info once the alias is used |
| SEC-05 | ✅ Fixed | Meta CSP in all three pages: `default-src 'none'`, hash-pinned `script-src` (LF and CRLF hashes), `connect-src` only `https://formsubmit.co` (v1/v2), `font-src 'self'`, `base-uri 'none'`, `form-action 'none'`. `.gitattributes` pins `*.html` to LF so the hashes stay valid. | Low (`style-src 'unsafe-inline'` still needed for inline styles) |
| SEC-06 | ✅ Fixed | Google Fonts removed. Variable woff2 files are self-hosted in `fonts/` (OFL 1.1, see `fonts/README.md`), and the workflow ships `fonts/`. | None |
| SEC-07 | ✅ Fixed | Workflow default is `contents: read`. `build` gets `contents: read` + `pages: read`; only `deploy` gets `pages: write` + `id-token: write`. | None |
| SEC-08 | ✅ Fixed | `.gitignore` now excludes `.mcp.json`, `skills-lock.json` and `.agents/` | None |
| SEC-15 | ✅ Fixed | `<meta name="referrer" content="no-referrer">` on all pages | None |
| SEC-09 to SEC-14, SEC-16 | ⏭ Not in scope (P3) | none | Unchanged |

**Verification:**
- All three pages were served locally and loaded in a browser. Every inline script ran under the CSP (no violations from the pages themselves), and all eight seed cards rendered on each page.
- The self-hosted fonts reported `loaded`: Plus Jakarta Sans, Geist and Geist Mono.
- Submitting the v2 Add Task form added a card and correctly reported that the email was not sent, because the endpoint is still the placeholder.
- The CI workflow change has not been run yet. It runs on the next push.

**Maintenance note:** after any edit to an inline `<script>`, regenerate its CSP hash. Otherwise the browser will block the script.

# Pórtico — External Setup Checklist

Everything in this document happens **outside the codebase**: in a browser, a DNS panel, or an SSH session. Nothing here is done by writing application code, which is why it lives in its own checklist — these are the steps that block a deploy and that no amount of local work can substitute for.

Commands verified against Dokku **v0.38.27** docs.

## Two environments

| Branch | Dokku app | Domain | `APP_ENV` | Public? |
|---|---|---|---|---|
| `main` | `portico` | `portico.frontendjuan.com` | `production` | Yes — marketing is indexable |
| `develop` | `portico-staging` | `staging-portico.frontendjuan.com` | `staging` | **No** — noindex everywhere, basic auth |

Both run on the **same VPS**, each with its own Postgres service and storage mount. Staging is never wired to production data.

**Architecture:** GitHub Actions builds one image per commit → pushes to GHCR → the matching Dokku app pulls it. The server never compiles anything, and staging and production run the *same artifact* so a green staging deploy is real evidence about production.

```
push
 └─ Actions: install → lint → typecheck → test → docker build → push to GHCR
     ├─ develop → git:from-image portico-staging → verify noindex
     └─ main    → git:from-image portico         → verify indexability
```

---

## Where this stands

| Section | State |
|---|---|
| A–C · VPS, hardening, Dokku | ⬜ in progress — CX23 Helsinki chosen, being provisioned |
| D · DNS (two records) | ⬜ not started |
| E · Apps, Postgres, storage, config | ⬜ not started |
| **F · GitHub repo, Actions, protection** | ✅ **done** except making the GHCR package public |
| G · Deploy key and secrets | ⬜ not started — `DOKKU_HOST` and `DOKKU_SSH_PRIVATE_KEY` confirmed empty in CI |
| H · First deploys and TLS | ⬜ blocked on A–E and G |
| I · Nightly reset | ⬜ blocked on Phase 1 code |
| J · Ongoing | ⬜ after H |
| K · Asset sourcing | ⬜ parallel, blocks nothing |
| L · Staging lockdown | ⬜ after H1 |

**CI is green through `build`.** The `Deploy to staging` job fails on every push, which is correct and expected — the log shows `DOKKU_HOST:` and `SSH_KEY:` empty. It will stay red until G is done, and that is a signal, not noise to suppress.

## Ordering at a glance

Sections **A → B → C** are strictly sequential. **D (DNS)** can run in parallel but must resolve before TLS. **F/G** are independent of the server work and can be done first. **E must precede H**; **H must precede I**. **L (staging lockdown) must follow H.** **K is fully parallel** and blocks nothing but seed quality.

> **The one genuinely easy mistake:** attempting TLS before DNS has propagated, or before the app is actually running. Both fail with errors that don't point at the cause. TLS is deliberately placed at the *end* of section H for this reason.

---

## A. Provision the VPS

Because builds happen in GitHub Actions and the VPS only *pulls* finished images, the server is sized for **runtime, not compilation**. With two environments it has to hold:

| Component | Approx. memory |
|---|---|
| `portico` app | 150–250 MB |
| `portico-staging` app | 150–250 MB |
| Postgres × 2 | ~300 MB |
| Docker + Dokku overhead | ~300 MB |
| **A second container, briefly, during every zero-downtime swap** | + one app's worth |

That lands around **1.3 GB steady with ~250 MB of spike**. Dokku's stated floor is 1 GB plus swap, which is not enough here. **4 GB is the right size** — comfortable for the steady state with room for the swap window, but not so lavish that the swapfile in section B stops mattering.

> **Decided: Hetzner Cloud `CX23`, Helsinki (`hel1`)** — 2 vCPU / 4 GB NVMe, **€4.49/mo**, Ubuntu 24.04.

- [ ] Create the server: plan **`CX23`**, location **Helsinki**, image **Ubuntu 24.04**.
- [ ] ⚠️ **Keep to the `CX` line, not `CAX`.** `CX` is x86 (Intel/AMD shared vCPU), which is what the existing Dockerfile and Actions workflow already build for. The cheaper Arm64 **`CAX`** plans would require an arm64 image build and a matching Prisma query-engine target — real work, for no benefit here.
- [ ] Add your SSH public key during creation. **Do not choose password auth.**
- [ ] Note the IPv4 address; enable IPv6 if offered.

**On the EU location.** Helsinki costs ~100–120 ms extra round-trip for US viewers. For mostly server-rendered pages that shows up as a slightly slower first paint and nothing else — there is no chatty client-side fetching in this app to multiply the penalty. The price is worth more than the latency here.

If it ever does start to bother you, putting Cloudflare in front caches the static marketing pages at the edge, which is the surface a prospect judges first. Not needed to launch, and not worth doing pre-emptively.

**Alternatives, for the record.** DigitalOcean's 4 GB droplet (~$24/mo) has a **Dokku 1-Click image** that skips section C entirely — five times the price to save one command. Vultr and Linode/Akamai are fine. **Avoid Contabo** — heavily oversubscribed, and this is a server you will be showing to paying prospects.

---

## B. Harden the server

Ten minutes, once.

- [ ] `ssh root@<ip>` and confirm access.
- [ ] `apt update && apt upgrade -y`
- [ ] Create a **2 GB swapfile** — real OOM insurance, not a formality. At 4 GB, two apps plus two Postgres services plus the extra container that exists briefly during every zero-downtime swap is a genuine squeeze:
      ```sh
      fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
      echo '/swapfile none swap sw 0 0' >> /etc/fstab   # survives reboot
      ```
- [ ] Firewall:
      ```sh
      ufw allow 22 && ufw allow 80 && ufw allow 443 && ufw enable
      ```
      **Port 80 must stay open** — Let's Encrypt's HTTP-01 challenge needs it, not just 443.
- [ ] Disable SSH password auth: set `PasswordAuthentication no` in `/etc/ssh/sshd_config`, then `systemctl restart ssh`.
- [ ] Recommended: `apt install unattended-upgrades -y` for automatic security patches.
- [ ] Set a recognisable hostname so `dokku` output isn't confusing six months from now.

---

## C. Install Dokku

- [ ] Confirm the current tag at <https://dokku.com/docs/getting-started/installation/> — it moves, so don't paste a stale version.
- [ ] Install:
      ```sh
      wget -NP . https://dokku.com/install/v0.38.27/bootstrap.sh
      sudo DOKKU_TAG=v0.38.27 bash bootstrap.sh
      ```
- [ ] Add your **personal** SSH key so you can run `dokku` remotely:
      ```sh
      cat ~/.ssh/id_ed25519.pub | dokku ssh-keys:add admin
      ```
- [ ] Verify: `dokku version` and `dokku apps:list` (empty is correct).
- [ ] Install the plugins:
      ```sh
      sudo dokku plugin:install https://github.com/dokku/dokku-postgres.git postgres
      sudo dokku plugin:install https://github.com/dokku/dokku-letsencrypt.git
      # locks staging behind HTTP basic auth (section L):
      sudo dokku plugin:install https://github.com/dokku/dokku-http-auth.git
      # only needed if the GHCR package stays private:
      sudo dokku plugin:install https://github.com/dokku/dokku-registry.git
      ```

---

## D. DNS

**Two records**, both pointing at the same VPS.

- [ ] A record: `portico` → VPS IPv4
- [ ] A record: `staging-portico` → VPS IPv4
- [ ] Add matching `AAAA` records if you enabled IPv6.
- [ ] Set TTL low (300 s) for the first day, in case you need to move it.
- [ ] Verify **both** resolve before attempting TLS:
      ```sh
      dig +short portico.frontendjuan.com
      dig +short staging-portico.frontendjuan.com
      ```

---

## E. Create the apps and their services

Run the whole section **twice** — once per environment. The two apps are identical except for the values in this table:

| | production | staging |
|---|---|---|
| App | `portico` | `portico-staging` |
| Postgres service | `portico-db` | `portico-staging-db` |
| Domain | `portico.frontendjuan.com` | `staging-portico.frontendjuan.com` |
| `APP_ENV` | `production` | `staging` |
| `APP_URL` | `https://portico.frontendjuan.com` | `https://staging-portico.frontendjuan.com` |

### Production

- [ ] ```sh
      dokku apps:create portico

      # The link step is what injects DATABASE_URL -- don't skip it.
      dokku postgres:create portico-db
      dokku postgres:link portico-db portico

      # Container filesystems are ephemeral; without this, uploads vanish on
      # every deploy.
      dokku storage:ensure-directory portico
      dokku storage:mount portico /var/lib/dokku/data/storage/portico:/storage

      dokku domains:set portico portico.frontendjuan.com
      dokku ports:set portico http:80:3000

      dokku config:set portico \
        APP_ENV=production \
        APP_URL='https://portico.frontendjuan.com' \
        SESSION_SECRET="$(openssl rand -base64 32)" \
        DEMO_MODE=true \
        NODE_ENV=production
      ```

### Staging

- [ ] ```sh
      dokku apps:create portico-staging

      dokku postgres:create portico-staging-db
      dokku postgres:link portico-staging-db portico-staging

      dokku storage:ensure-directory portico-staging
      dokku storage:mount portico-staging /var/lib/dokku/data/storage/portico-staging:/storage

      dokku domains:set portico-staging staging-portico.frontendjuan.com
      dokku ports:set portico-staging http:80:3000

      dokku config:set portico-staging \
        APP_ENV=staging \
        APP_URL='https://staging-portico.frontendjuan.com' \
        SESSION_SECRET="$(openssl rand -base64 32)" \
        DEMO_MODE=true \
        NODE_ENV=production
      ```

> ### ⚠️ `APP_ENV` is the switch that controls indexability
>
> The app **fails closed**: anything that is not exactly `production` is treated as staging and served `noindex` everywhere.
>
> That's the safe direction — a typo hides staging rather than exposing it — but it also means **a missing or misspelled `APP_ENV=production` makes the real site invisible to search.** The `deploy-production` job checks for this and fails the build if `/` comes back carrying a `noindex`, because silent deindexing is the failure nobody notices for six weeks.
>
> Give each app its **own** `SESSION_SECRET`. Sharing one would make staging cookies valid in production.
>
> Note `APP_URL`, not `NEXT_PUBLIC_APP_URL`. `NEXT_PUBLIC_*` is inlined at build time and CI doesn't know which environment a commit is bound for, so a public-prefixed URL would bake the wrong host into one of the two.

- [ ] **TLS is deferred to section H** for both apps. Let's Encrypt needs a *running container* to answer the HTTP-01 challenge, so it cannot be enabled before the first deploy. Everything else in E must be done before H.

---

## F. GitHub repo and container registry ✅ mostly done

**Repo is live at <https://github.com/moitorrijos/portico>** — public, default branch `develop`.

- [x] Repo created as `moitorrijos/portico`, **public** — free Actions minutes, free GHCR, anonymous image pull from the VPS.
- [x] `origin` remote added over **SSH** (`git@github.com:moitorrijos/portico.git`). SSH matters: the `gh` token carries `gist`, `read:org`, `repo` but **not** `workflow`, and pushing `.github/workflows/` over HTTPS with such a token is rejected. Over SSH the restriction doesn't apply.
- [x] `main` and `develop` both pushed.
- [x] `develop` set as the **default branch**, so PRs target it rather than production by accident.
- [x] GitHub Actions enabled and running. Pipeline is green through `build`: `Lint, typecheck, test` ~15s, `Build and push image` ~1m, images landing at `ghcr.io/moitorrijos/portico:<sha>`.
- [x] **Both branches protected** — PRs required, `Lint, typecheck, test` must pass, no direct pushes, no force-pushes, no deletions, **admin bypass off**.

      Required approvals is deliberately **0**: you cannot approve your own PR, so requiring 1 would deadlock every merge.

      ⚠️ **Escape hatch.** With admin bypass off, broken CI blocks *every* merge including the fix. To recover:
      ```sh
      gh api -X DELETE repos/moitorrijos/portico/branches/develop/protection
      # fix, merge, then re-apply the protection payload
      ```
- [x] Merge settings: squash-only (merge commits disabled), rebase allowed, **merged branches auto-delete**.
- [x] Branch and commit conventions documented in `AGENTS.md`, below the `BEGIN/END:nextjs-agent-rules` markers that `next dev` rewrites.

### Still to do in this section

- [ ] ⚠️ **Make the GHCR package public** — Settings → Packages → `portico` → Change visibility → Public.

      **This blocks the VPS from pulling.** GHCR packages are private by default even in a public repo, so `git:from-image` will fail with an auth error until this is flipped. I can't verify or change it from here — the token lacks `read:packages`.

      If you'd rather keep it private, run this on the VPS instead:
      ```sh
      dokku registry:login --global ghcr.io moitorrijos <PAT-with-read:packages>
      ```
- [ ] Optional: **GitHub Environments.** `staging` was created automatically by the first run; `production` appears after the first `main` deploy. Adding a required reviewer on `production` under Settings → Environments gives you a manual release gate without touching any YAML.
- [ ] Deferred: `.gitignore` ignores `.env*` wholesale, so a committed `.env.example` will need a `!.env.example` negation line. Nothing to commit yet — do this when the first env var appears in Phase 1.

---

## G. Deploy key and Actions secrets

> **This section is what is currently failing CI.** Every push runs `Deploy to staging`, which exits 1 because `DOKKU_HOST` and `SSH_KEY` resolve to empty strings. Expected until the VPS exists.

The workflow SSHes in and runs one Dokku command per environment. Authenticate **as the `dokku` user** — its shell is restricted to Dokku subcommands, so a leaked key can't get a root prompt. **One key serves both environments.**

- [ ] Generate a **dedicated** CI keypair. Never reuse your personal key:
      ```sh
      ssh-keygen -t ed25519 -C "github-actions-portico" -f ./portico_deploy -N ""
      ```
- [ ] On the VPS:
      ```sh
      cat portico_deploy.pub | dokku ssh-keys:add github-actions
      ```
- [ ] In GitHub → Settings → Secrets and variables → Actions, add:

| Secret | Value | Notes |
|---|---|---|
| `DOKKU_HOST` | VPS IP or `portico.frontendjuan.com` | Shared by both environments |
| `DOKKU_SSH_PRIVATE_KEY` | contents of `portico_deploy` (the private half) | Paste the whole file, including header and footer lines |
| `STAGING_BASIC_AUTH` | `user:password` | **Add after section L.** Without it the staging post-deploy checks read a 401 page and fail |

- [ ] **Delete the local private key file** after pasting it.
- [ ] **No registry secret is needed for pushing** — the workflow uses the built-in `GITHUB_TOKEN` with `permissions: packages: write`.

---

## H. First deploys and verification

Do **staging first.** That's the entire point of having it — find the broken SSH key or the wrong GHCR visibility on the environment nobody is looking at.

### H1. Staging

- [ ] Push to `develop` and watch the run: `check` → `build` → `deploy-staging`.
- [ ] `git:from-image <app> <docker-image>` is the exact signature. It updates the app's git repo to point at the image, which triggers the deploy. **The host must be able to pull the image** (hence F).
- [ ] Enable TLS now that a container is running:
      ```sh
      dokku letsencrypt:set portico-staging email <confirm-which-address>
      dokku letsencrypt:enable portico-staging
      dokku letsencrypt:cron-job --add   # global; only needs adding once
      ```
- [ ] Confirm staging is **not** indexable:
      ```sh
      curl -sI https://staging-portico.frontendjuan.com/ | grep -i x-robots-tag
      #   expect: noindex, nofollow, noarchive, nosnippet, noimageindex
      curl -s  https://staging-portico.frontendjuan.com/robots.txt
      #   expect: Disallow: /   (for * and for the named AI crawlers)
      ```
      The workflow asserts both automatically and fails the job if either is missing — but check by hand once, so you've seen it with your own eyes.
- [ ] Now do **section L** before leaving staging exposed.

### H2. Production

- [ ] Merge `develop` into `main`. Watch `deploy-production`.
- [ ] Enable TLS:
      ```sh
      dokku letsencrypt:set portico email <confirm-which-address>
      dokku letsencrypt:enable portico
      ```
      **Decide which address gets cert-expiry notices.** The git committer identity on this repo is `juanmtorrijos@gmail.com`; the session context showed `juanm@intermaritime.org`. For a personal portfolio project the personal address is probably right — but it's your call, and it's the address that emails you when renewal breaks.
- [ ] Confirm indexability is the *right way round*:
      ```sh
      curl -sI https://portico.frontendjuan.com/       | grep -i x-robots-tag  # expect NOTHING
      curl -sI https://portico.frontendjuan.com/app    | grep -i x-robots-tag  # expect noindex
      curl -sI https://portico.frontendjuan.com/portal | grep -i x-robots-tag  # expect noindex
      curl -s  https://portico.frontendjuan.com/robots.txt                     # expect Allow: /
      ```
      A `noindex` on `/` means `APP_ENV` isn't set to `production`. The workflow fails the job on this, but verify once by hand.
- [ ] Seed each environment once:
      ```sh
      dokku run portico-staging pnpm tsx scripts/seed.ts
      dokku run portico         pnpm tsx scripts/seed.ts
      ```
- [ ] Sanity-check memory headroom with **both** apps up: `free -h` and `dokku report portico`.
- [ ] Re-load each over `https://` and confirm the `http://` redirect works.

---

## I. Nightly reset

- [ ] The schedule lives in `app.json` **in the repo**, so it deploys with the code and applies to *both* apps — nothing to configure by hand. Confirm:
      ```sh
      dokku cron:list portico
      dokku cron:list portico-staging
      ```
- [ ] Staging resetting nightly is **desirable** — it exercises the reset path before production does.
- [ ] Test manually before trusting the schedule:
      ```sh
      dokku run portico-staging pnpm tsx scripts/reset-demo.ts
      ```
- [ ] Confirm the demo banner's claim ("resets nightly") is actually true. Spec §2's honesty rules mean the banner must not say something the cron doesn't do.

---

## L. Lock staging down

`robots.txt` and `X-Robots-Tag` are **requests, not barriers.** A crawler that ignores one ignores the other, and several AI scrapers ignore both. Basic auth is the only layer here that actually enforces anything.

- [ ] Enable it:
      ```sh
      dokku http-auth:enable portico-staging <username> <strong-password>
      ```
- [ ] Verify it bites:
      ```sh
      curl -so /dev/null -w '%{http_code}\n' https://staging-portico.frontendjuan.com/   # expect 401
      curl -so /dev/null -w '%{http_code}\n' -u user:pass \
           https://staging-portico.frontendjuan.com/                                     # expect 200
      ```
- [ ] Add the credentials as the `STAGING_BASIC_AUTH` secret (`user:password`) so the workflow's post-deploy checks can read past the 401.
- [ ] Note: **Dokku's own healthchecks bypass nginx**, hitting the container directly — so basic auth does not break zero-downtime deploys. Only external checks need credentials.
- [ ] Useful extras:
      ```sh
      dokku http-auth:report portico-staging            # confirm what's active
      dokku http-auth:add-allowed-ip portico-staging <your-home-ip>   # skip the prompt for yourself
      ```
- [ ] Sanity check you have **not** enabled it on production: `dokku http-auth:report portico` should show it disabled. The whole value of the piece is a prospect clicking a link with no barrier.

---

## J. Ongoing

- [ ] **Uptime monitoring** — a free UptimeRobot or Better Stack check on the **production** marketing page. This link goes in proposals; you want to know it's down before a prospect tells you. Don't monitor staging; it'll page you for nothing.
- [ ] **No database backups.** The data is seeded and truncated nightly by design — backing it up would be theatre. Deliberate, not an oversight.
- [ ] Verify Let's Encrypt auto-renewal fires at ~60 days for **both** domains: `dokku letsencrypt:list`.
- [ ] `docker system prune -af` monthly. Two apps plus two Postgres services fill a 40 GB volume with old layers noticeably faster than one — consider a cron.
- [ ] Watch the first few deploys for OOM in `dmesg`. If swap gets hammered with both apps up, resize one tier.
- [ ] Periodically re-check that staging is still 401ing and still `noindex` — it's the kind of thing that silently regresses after a config change.

---

## K. Asset sourcing

Parallel track. Blocks **seed quality**, not infrastructure.

**Sequencing:** the seed script reads image paths from the `prep-images.ts` manifest, so early phases don't stall waiting on curation — they seed against the 7 existing usable frames, reusing community heroes where needed. Top-ups drop into the manifest any time before the public site is built.

- [ ] **Cut from the moodboard:**
      - the two square AI-rendered gyms (`boutique-hotel-gym-...`, `hotel-gym-with-stateoftheart-...`)
      - `gorgeous-woman-gym-doing-exercise.jpg` — model stock
      - `interior-industrial-style-coworking-office.jpg` — reads 2016
      - one of the two duplicate `...vilnius-lithuania` frames (**keep the `(1)` dusk courtyard** — it's the better image)
- [ ] Decide whether `swimming-pool-resort.jpg` stays. It's beautiful but reads holiday-lettings rather than managed rental.
- [ ] **Source 8–12 frames from Unsplash/Pexels.** Priority order:
      1. **Interior unit shots** — the moodboard has *zero*, and the configurator needs them most. Living room / kitchen / bath, with finishes that plausibly map to the option groups.
      2. A third hero-grade community exterior (we have two strong ones).
      3. Lobby / leasing office, resident lounge, package room — the amenity set is over-indexed on fitness (5 frames) and has no arrival sequence at all.
- [ ] **Curation constraints** so the set reads as one company: bright-to-mid key, warm ivory/sand/oak bias, no visible brand signage, no smiling-model stock, no AI renders, landscape 3:2 where possible.
- [ ] Drop originals into `assets/source/` (gitignored); `scripts/prep-images.ts` produces the committed variants.
- [ ] Record attribution in `docs/CREDITS.md` even where the license doesn't require it.
- [ ] Invent the company, community, resident and street names — plausible and boring, per §9. **No real business's name or branding anywhere** (§2).

---

## Rough cost

| Item | Cost |
|---|---|
| Hetzner CX23 VPS, Helsinki (hosts **both** environments) | €4.49/mo |
| Domain (already owned) | — |
| TLS × 2 (Let's Encrypt) | free |
| GitHub Actions (public repo) | free |
| GHCR (public package) | free |
| **Total** | **~€5/mo** |

Adding staging costs nothing but RAM, which is exactly why section A sizes for 4 GB and section B insists on the swapfile. Prices drift; confirm current rates at signup.

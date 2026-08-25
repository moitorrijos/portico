# Pórtico — External Setup Checklist

Everything in this document happens **outside the codebase**: in a browser, a DNS panel, or an SSH session. Nothing here is done by writing application code, which is why it lives in its own checklist — these are the steps that block a deploy and that no amount of local work can substitute for.

Commands verified against Dokku **v0.38.27** docs.

## Two environments

| Branch | Dokku app | Domain | `APP_ENV` | Public? |
|---|---|---|---|---|
| `main` | `portico` | `portico.frontendjuan.com` | `production` | Yes — marketing is indexable |
| `develop` | `portico-staging` | `portico-staging.frontendjuan.com` | `staging` | **No** — noindex everywhere, basic auth |

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
| A · VPS provisioned | ✅ CX23 Helsinki, `95.216.145.241`, specs read off the box |
| B · Hardening | ✅ except the **firewall**, still inactive |
| C · Dokku install | ✅ v0.38.27 + Docker + nginx, via the official bootstrap |
| D · DNS | ✅ both records live on `frontendjuan.com`, reaching nginx |
| E · Apps, Postgres, storage, config | ✅ done — both apps, both databases linked, storage mounted, config set |
| **F · GitHub repo, Actions, protection** | ✅ **done** — GHCR package verified publicly pullable from the VPS |
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

> **Provisioned: Hetzner Cloud `CX23`, Helsinki (`hel1`)** — **$6.49/mo**, `95.216.145.241`.
>
> Read off the box, not a screenshot:
>
> | | |
> |---|---|
> | Architecture | `x86_64` — no arm64 image or Prisma engine work needed |
> | vCPU | 2 |
> | RAM | 3.7 GiB usable (the 4 GB tier) |
> | Disk | 38 GB, 35 GB free |
> | OS | Ubuntu 24.04.4 LTS, kernel 6.8 |

- [x] Create the server: plan **`CX23`**, location **Helsinki**, image **Ubuntu 24.04**.
- [x] ⚠️ **Keep to the `CX` line, not `CAX`.** `CX` is x86 (Intel/AMD shared vCPU), which is what the existing Dockerfile and Actions workflow already build for. The cheaper Arm64 **`CAX`** plans would require an arm64 image build and a matching Prisma query-engine target — real work, for no benefit here.
- [x] Add your SSH public key during creation. **Do not choose password auth.**
- [x] Note the IPv4 address (`95.216.145.241`); enable IPv6 if offered.

**On the EU location.** Helsinki costs ~100–120 ms extra round-trip for US viewers. For mostly server-rendered pages that shows up as a slightly slower first paint and nothing else — there is no chatty client-side fetching in this app to multiply the penalty. The price is worth more than the latency here.

If it ever does start to bother you, putting Cloudflare in front caches the static marketing pages at the edge, which is the surface a prospect judges first. Not needed to launch, and not worth doing pre-emptively.

**Alternatives, for the record.** DigitalOcean's 4 GB droplet (~$24/mo) has a **Dokku 1-Click image** that skips section C entirely — nearly four times the price to save one command. Vultr and Linode/Akamai are fine. **Avoid Contabo** — heavily oversubscribed, and this is a server you will be showing to paying prospects.

---

## B. Harden the server ✅ except the firewall

Verified on the box, not assumed.

- [x] `ssh root@<ip>` and confirm access.
- [x] `apt update && apt upgrade -y` — ⚠️ 3 packages upgradable again (`console-setup`, `console-setup-linux`, `keyboard-configuration`) and **a reboot is pending**. Neither is urgent.
- [x] **2 GB swapfile**, created and verified:
      ```sh
      fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
      echo '/swapfile none swap sw 0 0' >> /etc/fstab
      ```
      `chmod 600` before `mkswap` is not hygiene theatre — swap can hold anything that was in memory, including `SESSION_SECRET` and `DATABASE_URL`.

      **Prove the fstab line works before trusting it**, since a bad entry only shows up at boot:
      ```sh
      swapoff /swapfile && swapon -a && swapon --show   # reappears = valid
      ```
- [x] **`vm.swappiness` lowered to 10.** Ubuntu ships 60, which pages out eagerly. Here swap is OOM insurance for the deploy window, not routine paging — a dashboard that pages in mid-request feels broken:
      ```sh
      sysctl vm.swappiness=10 && echo 'vm.swappiness=10' > /etc/sysctl.d/99-swap.conf
      ```
- [ ] ⚠️ **Firewall — still inactive.** `ufw` is installed but off. Only `sshd` and nginx listen publicly, but **the box logged 18,612 failed SSH login attempts in 24 hours** — it is being actively brute-forced. They all fail (password auth is off), so this is not urgent, but it is not hypothetical either.
      ```sh
      ufw allow 22 && ufw allow 80 && ufw allow 443 && ufw --force enable
      ```
      **Allow 22 before enabling**, or you drop your own session. `--force` skips the prompt that otherwise hangs a non-interactive run.

      **Port 80 must stay open** — Let's Encrypt's HTTP-01 challenge needs it, not just 443.

      > ⚠️ **Docker bypasses ufw.** Docker writes its own iptables rules, so a published container port stays reachable even when `ufw status` says otherwise. It mostly does not bite here — Dokku serves through nginx on 80/443 and keeps Postgres on an internal network — but check with `ss -tlnp`, not `ufw status`.
- [x] **SSH password auth already disabled** — Hetzner's image ships key-only. Verified the *effective* config, not the file:
      ```
      passwordauthentication no      permitrootlogin without-password
      pubkeyauthentication yes       permitemptypasswords no
      ```
      Read it with `sshd -T | grep -i passwordauth`; a later `Include` can override what `sshd_config` appears to say.
- [x] **`unattended-upgrades` installed *and* enabled** — not the same thing. Service enabled and active, `/etc/apt/apt.conf.d/20auto-upgrades` has both periodic keys at `1`, and it last ran today.
- [x] **Hostname set to `dokku-hel1`** (was `ubuntu-personal-2026`), and it survived a reboot along with the swapfile.
      ```sh
      hostnamectl set-hostname dokku-hel1
      ```
      Two cloud-init traps on Hetzner, both hit here:

      - `preserve_hostname` was `false`, so cloud-init would have reapplied the console name at next boot and silently undone this. Set it to `true` in `/etc/cloud/cloud.cfg`.
      - `manage_etc_hosts` is `true`, so `/etc/hosts` is regenerated from a template. It now maps `dokku-hel1` at **`127.0.1.1`** — the Debian convention for the machine's own name, not `127.0.0.1`. Get it wrong and `sudo` hangs for seconds on every call.

      Named for the host, not the app: this is a general Dokku box that may hold more than Pórtico, and a machine named after one of three apps is worse than no name.

      > Not to be confused with `dokku domains:set` in section E. The hostname is the machine's name and invisible to visitors; the domain is what nginx serves.

---

## C. Install Dokku ✅ done

- [x] Dokku **v0.38.27**, Docker **29.7.2**, nginx **1.24.0** — installed and active.
      ```sh
      wget -NP . https://dokku.com/install/v0.38.27/bootstrap.sh
      sudo DOKKU_TAG=v0.38.27 bash bootstrap.sh
      ```
- [x] **Use the official bootstrap, never a source build.** This box was first set up from source, which skipped the Debian package's `postinst` and produced two failures that only surfaced later:

      - **nginx was never installed** — the deb pulls it in as a dependency. Dokku sat there with `computed proxy type: nginx` and no nginx binary, so a deploy would have built the image fine and then served nothing.
      - **The sudoers files were missing**, so the `dokku` user could not reload nginx: `dokku nginx:validate-config` failed with `sudo: a password is required`.

      Re-running the official bootstrap over the top fixed both, kept the version identical, and preserved the existing app. Verified after: `nginx:validate-config`, `nginx:reload` and `domains:set-global` all exit `0`.

      > The sudoers files are **per-plugin** — `dokku-nginx`, `dokku-storage`, `dokku-docker-container-healthchecker`. Looking for a single `/etc/sudoers.d/dokku` and concluding they are absent is an easy false alarm; I made exactly that mistake.
- [x] Personal SSH key added: `cat ~/.ssh/id_ed25519.pub | dokku ssh-keys:add admin`
- [x] **Global domain set**, so apps get sensible vhosts by default:
      ```sh
      dokku domains:set-global frontendjuan.com
      ```
      It defaulted to the machine hostname (`dokku-hel1`), which resolves nowhere. With this set, `apps:create portico` lands on `portico.frontendjuan.com` and `portico-staging` on `portico-staging.frontendjuan.com` — the naming actually in use, which makes section E's explicit `domains:set` calls belt-and-braces rather than load-bearing.
- [x] Catch-all vhost at `/etc/nginx/conf.d/00-default-vhost.conf`; nginx's conflicting `sites-enabled/default` removed.

      It answers unknown Host headers with `444` (close, no response). **An unmatched hostname returning nothing is correct**, not a fault — before this, nginx's "Welcome to nginx" page answered on every hostname pointed at the box. A deployed app with no vhost yet also falls through to this, so `HTTP 000` before the first deploy is expected.
- [x] Remaining plugins installed — `postgres` 1.48.0, `letsencrypt` 0.25.1, and `http-auth` 0.13.0 (the last needed for section L):
      ```sh
      sudo dokku plugin:install https://github.com/dokku/dokku-postgres.git postgres
      sudo dokku plugin:install https://github.com/dokku/dokku-letsencrypt.git
      ```
- [x] ⚠️ **`enabled` in `plugin:list` does not mean the plugin is installed.** The postgres plugin cloned fine and reported `enabled`, but `postgres:create` then failed with:
      ```
      mkdir: cannot create directory '/var/lib/dokku/services': Permission denied
      ```
      A plugin's `install` trigger is a separate step from the clone. The postgres one pulls **five** images (`postgres`, `busybox`, `ambassador`, `s3backup`, `wait`) under `set -eo pipefail` *before* it creates any directory, so a single failed pull aborts it — leaving the plugin enabled but with no data root and no sudoers file. Here only `postgres:18.4` had landed; the other four were absent, so it died on the second pull.

      The permission error is a symptom, not the cause. **`/var/lib/dokku` is `root:root`**, so only root can create `services/` — and the trigger that would have done it never got that far. Running as root does not help, because the missing step is the trigger, not the `mkdir`.

      Recovery — no arguments, which re-runs the `install` trigger for **every** enabled plugin and is idempotent:
      ```sh
      sudo dokku plugin:install
      ```
      Give it several minutes; it re-attempts every pull. Killing it partway is how the box got into this state to begin with.

      Verify all three artifacts, not just the first:
      ```sh
      ls -l  /etc/sudoers.d/dokku-postgres          # 0440 root:root
      ls -ld /var/lib/dokku/services/postgres       # dokku:dokku
      ls -ld /var/lib/dokku/config/postgres         # dokku:dokku
      ```
      `services/` itself staying `root:root` is correct — only the leaf is chowned.

      > Plugins whose data root sits under `/var/lib/dokku/data/` (`letsencrypt`, `http-auth`) are **not** affected by this failure mode: that directory is already `dokku`-owned, so their triggers succeed where postgres's cannot. A working letsencrypt is no evidence that postgres installed.

---

## D. DNS ✅ done

Both records live on **`frontendjuan.com`**, matching §1 of the spec — the piece sits alongside `urbana.frontendjuan.com` as one body of work.

- [x] A record: `portico` → `95.216.145.241`
- [x] A record: `portico-staging` → `95.216.145.241`
- [x] Verified resolving *and* reaching nginx on the box:
      ```sh
      dig +short portico.frontendjuan.com          # -> 95.216.145.241
      dig +short portico-staging.frontendjuan.com  # -> 95.216.145.241
      ```
- [x] **Proxy status `DNS only`** (grey cloud) in Cloudflare. Keep it — proxying breaks Let's Encrypt's HTTP-01 challenge in section H.
- [ ] Optional: `AAAA` records if you enable IPv6.

> **A dead domain is usually not DNS.** When these first looked unreachable, the records were already correct and propagated — nothing was listening on port 80. Check the raw IP with `curl -sI http://<ip>/` before suspecting DNS; if the IP does not answer either, the problem is on the box.
>
> Earlier records on `juanmtorrijos.com` are now spare and can be deleted.

---

## E. Create the apps and their services ✅ done

Run the whole section **twice** — once per environment. The two apps are identical except for the values in this table:

| | production | staging |
|---|---|---|
| App | `portico` | `portico-staging` |
| Postgres service | `portico-db` | `portico-staging-db` |
| Domain | `portico.frontendjuan.com` | `portico-staging.frontendjuan.com` |
| `APP_ENV` | `production` | `staging` |
| `APP_URL` | `https://portico.frontendjuan.com` | `https://portico-staging.frontendjuan.com` |

### Production

- [x] ```sh
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

- [x] ```sh
      dokku apps:create portico-staging

      dokku postgres:create portico-staging-db
      dokku postgres:link portico-staging-db portico-staging

      dokku storage:ensure-directory portico-staging
      dokku storage:mount portico-staging /var/lib/dokku/data/storage/portico-staging:/storage

      dokku domains:set portico-staging portico-staging.frontendjuan.com
      dokku ports:set portico-staging http:80:3000

      dokku config:set portico-staging \
        APP_ENV=staging \
        APP_URL='https://portico-staging.frontendjuan.com' \
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

### Verified after the run

Read back off the box, both apps identical apart from the environment values:

| | `portico` | `portico-staging` |
|---|---|---|
| `APP_ENV` | `production` | `staging` |
| `DATABASE_URL` | injected by `postgres:link` | injected by `postgres:link` |
| Postgres `Links:` | `portico` | `portico-staging` |
| Postgres `Status:` | `running` | `running` |
| Domain vhost | `portico.frontendjuan.com` | `portico-staging.frontendjuan.com` |
| `Ports map:` | `http:80:3000` | `http:80:3000` |
| Deploy mount | `/var/lib/dokku/data/storage/portico:/storage` | `/var/lib/dokku/data/storage/portico-staging:/storage` |
| `SESSION_SECRET` | 44 chars, `sha256:63c65e9afb8b` | 44 chars, `sha256:19169b37956a` |

Distinct fingerprints, which is the point — a shared secret would make staging cookies valid in production. Fingerprints rather than values so this file never carries the secrets.

Memory with both databases up: **636 MiB used, 3.1 GiB available, swap at 1 MiB.** Room for both app containers plus a swap-window spike, which is what section A sized for.

- [x] ⚠️ **`ports:set` had to be explicit — the detected default is wrong.** Before it was set, both apps reported `Ports map detected: http:80:5000`. 5000 is the herokuish default; the Next.js standalone server listens on **3000**. Dokku only *detects* that value, it does not commit it, so `Ports map:` was empty and the first deploy would have proxied to a dead port.

- [x] ⚠️ **`storage:ensure-directory` chowns to the wrong uid for a Dockerfile app.** It set `32767:32767` (the herokuish "nobody" uid), but our Dockerfile ends on `USER nextjs` = **uid 1001**, so every upload write into `/storage` would have failed with `EACCES` — and only in Phase 5, when the first maintenance photo is uploaded.

      ```sh
      chown 1001:1001 /var/lib/dokku/data/storage/portico
      chown 1001:1001 /var/lib/dokku/data/storage/portico-staging
      ```

      Proven rather than assumed, by writing as that uid through the same mount:
      ```sh
      docker run --rm -u 1001:1001 \
        -v /var/lib/dokku/data/storage/portico:/storage \
        busybox sh -c 'touch /storage/.probe && echo WRITE_OK && rm /storage/.probe'
      ```

      **If the Dockerfile's uid ever changes, this chown has to change with it.** The mount will keep working and only writes will fail.

- [x] ⚠️ **`config:set` echoes the values it sets, secrets included.** Both `SESSION_SECRET`s were printed to the terminal in full. Harmless here — nothing was deployed and no session had ever been signed — but they were rotated immediately, with output suppressed:
      ```sh
      dokku config:set --no-restart portico SESSION_SECRET="$(openssl rand -base64 32)" >/dev/null 2>&1
      ```
      Confirm without revealing anything: `dokku config:get <app> SESSION_SECRET | sha256sum`.

      Use `--no-restart` for pre-deploy config. Without it Dokku attempts a restart per call, which is noise on an app that has no image yet.

- [ ] **TLS is deferred to section H** for both apps. Let's Encrypt needs a *running container* to answer the HTTP-01 challenge, so it cannot be enabled before the first deploy. Everything else in E must be done before H.

---

## F. GitHub repo and container registry ✅ done

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

### Optional and deferred — nothing here blocks a deploy

- [x] **GHCR package is already public — nothing to do.** This was previously listed here as a blocker, on the assumption that GHCR packages are private by default. That is true of packages pushed by hand, but **not** of one pushed by Actions from a public repo: GitHub links the package to the repository and it inherits the repo's visibility.

      **Corrected location, for whenever it does need changing.** Package visibility is a property of the *package*, at account scope — it is **not** in repository Settings, which is where this checklist used to point:

      ```
      https://github.com/users/moitorrijos/packages/container/portico/settings
      ```
      (profile → **Packages** tab → `portico` → **Package settings** → Danger Zone → Change visibility)

      **Verify it rather than reading the UI**, since a wrong answer here costs a failed deploy. Fetch an anonymous pull token and list the tags — no credentials anywhere in this:
      ```sh
      TOK=$(curl -s "https://ghcr.io/token?scope=repository:moitorrijos/portico:pull&service=ghcr.io" \
            | python3 -c 'import sys,json; print(json.load(sys.stdin)["token"])')
      curl -s -H "Authorization: Bearer $TOK" https://ghcr.io/v2/moitorrijos/portico/tags/list
      ```
      A tag list means public. A **403** means private — and a nonexistent package returns 403 too, so check the name is right before concluding anything.

      Confirmed from the VPS itself, which is the machine that actually matters, with **no `registry:login` configured**:
      ```sh
      docker manifest inspect ghcr.io/moitorrijos/portico:<sha>   # -> OCI index, linux/amd64
      ```
      `linux/amd64` also confirms the image platform matches the `x86_64` box, per section A.

      If you ever make it private, the VPS then needs:
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
      curl -sI https://portico-staging.frontendjuan.com/ | grep -i x-robots-tag
      #   expect: noindex, nofollow, noarchive, nosnippet, noimageindex
      curl -s  https://portico-staging.frontendjuan.com/robots.txt
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
      curl -so /dev/null -w '%{http_code}\n' https://portico-staging.frontendjuan.com/   # expect 401
      curl -so /dev/null -w '%{http_code}\n' -u user:pass \
           https://portico-staging.frontendjuan.com/                                     # expect 200
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
- [ ] `docker system prune -af` monthly. Two apps plus two Postgres services accumulate old image layers noticeably faster than one — consider a cron.
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
| Hetzner CX23 VPS, Helsinki (hosts **both** environments) | $6.49/mo |
| Domain (already owned) | — |
| TLS × 2 (Let's Encrypt) | free |
| GitHub Actions (public repo) | free |
| GHCR (public package) | free |
| **Total** | **~$6.50/mo** |

Adding staging costs nothing but RAM, which is exactly why section A sizes for 4 GB and section B insists on the swapfile. Prices drift; confirm current rates at signup.

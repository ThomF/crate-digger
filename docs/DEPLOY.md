# Deploying Frisson

One server, Docker Compose, two containers:

```
internet ──▶ caddy (ports 80/443, HTTPS) ──▶ app (port 3000, private) ──▶ /data volume
                                              API + built web app       crate.db, covers/, avatars/, backups/
```

- **app** is built from the repo's `Dockerfile`. It serves the API and the Vue app, and stores
  everything in one Docker volume (`crate-data`, mounted at `/data`).
- **caddy** gets and renews HTTPS certificates from Let's Encrypt automatically, adds security
  headers, and forwards requests to the app. The app is never reachable directly.

## 1. Try it on your own machine first

Needs Docker Desktop running.

```bash
cp .env.example .env
```

Put your email after `ADMIN_EMAIL=` and a password of at least 8 characters after
`ADMIN_PASSWORD=` in `.env`, and leave `DOMAIN=http://localhost`. Then:

```bash
docker compose up -d --build
```

Open http://localhost, log in with that email and password, and make your first crate.
`docker compose down` stops it; your data stays in the volume for next time.

## 2. Get a server and a domain

- **A small VPS** is plenty: 1 vCPU and 1–2 GB RAM, e.g. Hetzner CX22, DigitalOcean's smallest
  droplet. Pick Ubuntu 24.04 LTS. Both x86 and ARM servers work.
- **A domain or subdomain**, e.g. `crates.yourname.com`. In your DNS provider, add an **A record**
  pointing it at the server's IP address (and an AAAA record for IPv6, if the server has one).
  DNS changes can take a few minutes to spread.

## 3. Set up the server

SSH in, then install Docker with its official script:

```bash
curl -fsSL https://get.docker.com | sh
```

Allow only SSH and web traffic through the firewall:

```bash
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw enable
```

> Docker publishes ports itself and can bypass `ufw` rules. That's fine here: the compose file
> only publishes 80 and 443 (Caddy). The app has no published port.

## 4. Deploy

```bash
git clone https://github.com/ThomF/crate-digger.git
cd crate-digger
cp .env.example .env
nano .env
```

In `.env`:

- `ADMIN_EMAIL` and `ADMIN_PASSWORD`: the first admin account. On the first start with no admin
  yet, the app creates an admin with this email and password. Make the password long and random
  (`openssl rand -base64 24` makes a good one; at least 8 characters, or the app will not start).
  Compose refuses to start without either one.
- `DOMAIN`: your domain **without** `http://`, e.g. `crates.yourname.com`. That tells Caddy to
  fetch a real certificate.
- `SEED_DEMO_DATA` (optional): leave it empty for a real instance. `true` adds fictional demo users,
  news and crates on each start, so everyone who visits sees them. Setting it back does not remove
  them, and there is no removal command, so try it on a throwaway instance first
  (see [ADR 0006](adr/0006-following-home-and-demo-content.md)).

```bash
docker compose up -d --build
```

The first start takes a few minutes (building the image, then Caddy requesting the certificate).
Watch it with `docker compose logs -f`. When it's done, https://crates.yourname.com is live.

## Updating

After merging new work into `main`:

```bash
git pull
docker compose up -d --build
```

Database migrations run automatically when the new app container starts.

### Upgrading to following and the Home page

Nothing to do by hand. Migration 0005 adds the follows and news tables when the app starts, and no
demo content is added unless you set `SEED_DEMO_DATA=true`. Without it, Home shows empty news and
recommended sections. The crate browser moved from `/` to `/shelf`, so update any bookmarks.

### Upgrading to user profiles

Nothing to do by hand. Migration 0004 adds the profile fields (bio, location, avatar, verified
badge) and the social links table when the app starts, and every existing user gets an empty
profile automatically. Uploaded avatars go in a new `avatars` folder next to `covers` in the same
`/data` volume (`DATA_DIR/avatars`, or `AVATARS_DIR` if you set it).

### Upgrading to user accounts

This version replaces the single shared "Staff log in" password with user accounts. Your
database, covers and backups stay where they are (`crate.db` in the `crate-data` volume, mounted
at `/data`); nothing to move. Before `docker compose up -d --build`:

1. **Add `ADMIN_EMAIL` to `.env`**, next to your existing `ADMIN_PASSWORD`. Compose now refuses to
   start without it. On the next start the app creates an admin account with that email and your
   current `ADMIN_PASSWORD`, and makes it the owner of every existing crate. If you start the app
   without `ADMIN_EMAIL` some other way (e.g. plain `docker run`), there is no admin and your
   existing crates stay locked: nobody can edit them until an admin exists.
2. **Check `ADMIN_PASSWORD` is at least 8 characters.** A shorter one stops the app from starting
   while it has no admin yet.
3. `SESSION_SECRET` is no longer used. You can leave it in `.env` or delete it.

**Everyone is signed out once** by the upgrade: old logins are not carried over. Log in again with
`ADMIN_EMAIL` and `ADMIN_PASSWORD`. Other people can now make their own accounts at `/signup`.

## Accounts

- Anyone can browse. Signed-in users can create crates and edit only their own crates and the
  albums in them. Admins can edit everything.
- Sign up at `/signup`. Logins last 30 days.
- Log in and sign up are rate limited to 10 tries per 15 minutes per IP address. The app reads the
  visitor's IP from Caddy's `X-Forwarded-For`, which needs `TRUST_PROXY=true` (already set in
  `compose.yaml`). Without it, every visitor shares Caddy's IP and one limit. Only set it when the
  app is reachable solely through a proxy you control.
- `ADMIN_EMAIL` and `ADMIN_PASSWORD` are only used to create the first admin when none exists.
  Changing them later does not change or add an admin. There is no in-app password change yet.

## Backups

Everything worth keeping is in the `/data` volume. Back up the database with SQLite's online
backup (safe while the app is running), then copy the whole folder off the server:

```bash
docker compose exec app node apps/api/src/db/backup.ts
docker compose cp app:/data ./crate-backup
```

`crate-backup/backups/` holds dated `.db` files, `crate-backup/covers/` the cover images and
`crate-backup/avatars/` the profile pictures. Copy `crate-backup` somewhere that isn't this server
(your laptop, cloud storage). If you set `COVERS_DIR` or `AVATARS_DIR` to a path outside `/data`,
copy those folders too.

> Don't treat `crate-backup/crate.db` itself as the backup: it may be missing recent changes that
> were still in `crate.db-wal`. Use the files in `backups/`.

## Restoring

Stop the app, restore a backup through SQLite, put the covers and avatars back, and start it again. Replace
the file name with the backup you want:

```bash
docker compose stop app
docker compose run --rm --no-deps -v "$PWD/crate-backup:/restore:ro" app \
  node apps/api/src/db/restore.ts /restore/backups/crate-2026-10-12T21-32-14.db
docker compose run --rm --no-deps -v "$PWD/crate-backup:/restore:ro" app \
  cp -R /restore/covers/. /data/covers/
docker compose run --rm --no-deps -v "$PWD/crate-backup:/restore:ro" app \
  sh -c 'mkdir -p /data/avatars && cp -R /restore/avatars/. /data/avatars/'
docker compose start app
```

The restore script checks the backup's integrity before touching anything. Backups made before
profiles existed have no `avatars` folder; skip that step for them.

## Day to day

| Task                         | Command                      |
| ---------------------------- | ---------------------------- |
| See what's running           | `docker compose ps`          |
| Follow the logs              | `docker compose logs -f app` |
| Restart after editing `.env` | `docker compose up -d`       |
| Stop everything              | `docker compose down`        |

## Hosting at home instead

A spare computer or Raspberry Pi works too, with the same steps. Two differences:

- Your home IP may change and your router must forward ports 80 and 443 to the machine.
- Or skip port forwarding with a **Cloudflare Tunnel**, which connects outward to Cloudflare and
  serves your domain from there. Cloudflare then handles HTTPS, so set `DOMAIN=:80` (plain HTTP
  for any host name) and point the tunnel at `http://localhost:80`.

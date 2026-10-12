# Deploying Crate Digger

One server, Docker Compose, two containers:

```
internet ──▶ caddy (ports 80/443, HTTPS) ──▶ app (port 3000, private) ──▶ /data volume
                                              API + built web app       crate.db, covers/, backups/
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

Put any password after `ADMIN_PASSWORD=` in `.env` and leave `DOMAIN=http://localhost`. Then:

```bash
docker compose up -d --build
```

Open http://localhost, use **Staff log in** at the bottom, and make your first crate.
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

- `ADMIN_PASSWORD`: long and random. `openssl rand -base64 24` makes a good one. Compose refuses
  to start without it.
- `DOMAIN`: your domain **without** `http://`, e.g. `crates.yourname.com`. That tells Caddy to
  fetch a real certificate.

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

## Backups

Everything worth keeping is in the `/data` volume. Back up the database with SQLite's online
backup (safe while the app is running), then copy the whole folder off the server:

```bash
docker compose exec app node apps/api/src/db/backup.ts
docker compose cp app:/data ./crate-backup
```

`crate-backup/backups/` holds dated `.db` files, `crate-backup/covers/` the cover images. Copy
`crate-backup` somewhere that isn't this server (your laptop, cloud storage).

> Don't treat `crate-backup/crate.db` itself as the backup: it may be missing recent changes that
> were still in `crate.db-wal`. Use the files in `backups/`.

## Restoring

Stop the app, restore a backup through SQLite, put the covers back, and start it again. Replace
the file name with the backup you want:

```bash
docker compose stop app
docker compose run --rm --no-deps -v "$PWD/crate-backup:/restore:ro" app \
  node apps/api/src/db/restore.ts /restore/backups/crate-2026-10-12T21-32-14.db
docker compose run --rm --no-deps -v "$PWD/crate-backup:/restore:ro" app \
  cp -R /restore/covers/. /data/covers/
docker compose start app
```

The restore script checks the backup's integrity before touching anything.

## Day to day

| Task                         | Command                                                      |
| ---------------------------- | ------------------------------------------------------------ |
| See what's running           | `docker compose ps`                                          |
| Follow the logs              | `docker compose logs -f app`                                 |
| Restart after editing `.env` | `docker compose up -d`                                       |
| Stop everything              | `docker compose down`                                        |
| Change the admin password    | Edit `.env`, then `docker compose up -d` (logs everyone out) |

## Hosting at home instead

A spare computer or Raspberry Pi works too, with the same steps. Two differences:

- Your home IP may change and your router must forward ports 80 and 443 to the machine.
- Or skip port forwarding with a **Cloudflare Tunnel**, which connects outward to Cloudflare and
  serves your domain from there. Cloudflare then handles HTTPS, so set `DOMAIN=:80` (plain HTTP
  for any host name) and point the tunnel at `http://localhost:80`.

# Deploying Sitbaby

Two supported paths, depending on whether the host is dedicated or shared.

## A) Dedicated VM (turnkey, Caddy TLS)

Best for a fresh OCI Compute (or any) VM that Sitbaby owns entirely.

- **First boot from scratch:** paste [`oci-cloud-init.yaml`](oci-cloud-init.yaml)
  into the instance's *user data* when launching an Ubuntu 22.04 VM (edit the
  `SITE_ADDRESS` / `NEXTAUTH_URL` / `TLS_EMAIL` values first, and point your
  domain's DNS A record at the instance). It installs Docker, clones the repo,
  generates secrets, and starts the stack behind Caddy.
- **Manual:** on a host with Docker, `cp .env.prod.example .env`, fill it in,
  then:
  ```bash
  docker compose -f docker-compose.prod.yml up -d --build
  ```
  [`docker-compose.prod.yml`](../docker-compose.prod.yml) runs Postgres + the
  app + a [Caddy](Caddyfile) reverse proxy that terminates TLS on 80/443. Set
  `SITE_ADDRESS` to a domain for automatic Let's Encrypt HTTPS (or `:80` for
  plain HTTP). Only Caddy is internet-facing; the app and DB ports are not
  published.

## B) Shared host behind an existing nginx (no ports 80/443 free)

When the VM already runs other apps behind a host **nginx + certbot** (e.g. the
OCI box `140.238.131.77`), do **not** use the Caddy compose — it would collide
with nginx on 80/443. Instead run only the app + DB bound to loopback and add an
nginx vhost. This is how the live demo is deployed:

1. Clone and start with the base compose, binding to free loopback ports (the
   `${VAR}:port` form binds the host side):
   ```bash
   git clone https://github.com/asam89/sitter.git ~/sitbaby && cd ~/sitbaby
   cat > .env <<'EOF'
   POSTGRES_USER=postgres
   POSTGRES_DB=sitbaby
   POSTGRES_PASSWORD=<openssl rand -base64 24>
   DB_PORT=127.0.0.1:5439        # DB reachable only on localhost
   APP_PORT=127.0.0.1:3003       # pick a free port; 3000-3002 were taken
   NEXTAUTH_SECRET=<openssl rand -base64 32>
   NEXTAUTH_URL=https://sitbaby.140.238.131.77.nip.io
   SEED_ON_START=true            # demo accounts; turn OFF for real use
   EOF
   docker compose up -d --build
   ```
2. Add an nginx vhost proxying the public hostname to the app port, then get a
   cert. A `*.<ip>.nip.io` name needs no DNS setup and still gets real TLS:
   ```bash
   # /etc/nginx/sites-available/sitbaby -> proxy_pass http://127.0.0.1:3003;  server_name sitbaby.140.238.131.77.nip.io;
   sudo ln -s /etc/nginx/sites-available/sitbaby /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   sudo certbot --nginx -d sitbaby.140.238.131.77.nip.io --redirect \
     --non-interactive --agree-tos --register-unsafely-without-email
   ```

> **Security note:** `SEED_ON_START=true` creates demo accounts with the shared
> password `password123`. Turn it off (and remove those users) before any real
> use of an internet-facing deployment.

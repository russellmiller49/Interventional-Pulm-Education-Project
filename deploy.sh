#!/usr/bin/env bash
set -euo pipefail

############################
# >>> VARIABLES TO EDIT <<<
############################
APP_NAME="interventionalpulm"
DOMAIN="interventionalpulm.org"

# VPS login
SERVER_HOST="62.72.48.70"   # VPS IP or hostname
SERVER_PORT="65002"         # Hostinger custom SSH port
SERVER_USER="u572533996"    # Hostinger SSH username
SSH_KEY="$HOME/.ssh/id_ed25519_new"

# Node & app
NODE_VERSION="20"           # LTS recommended
APP_PORT="3000"             # internal port Next.js listens on (matches start:prod script)
REMOTE_DIR="/home/u572533996/${APP_NAME}"  # app directory on server

# Optional: environment for Next.js on server
ENV_PROD=$'NODE_ENV=production\nNEXT_PUBLIC_APP_URL=https://'"${DOMAIN}"

# Add any additional environment variables your app needs here:
# ENV_PROD+=$'\nDATABASE_URL=your_database_url'
# ENV_PROD+=$'\nAPI_KEY=your_api_key'
# ENV_PROD+=$'\nNEXTAUTH_SECRET=your_nextauth_secret'
# ENV_PROD+=$'\nNEXTAUTH_URL=https://'"${DOMAIN}"


#######################################
# Helper
#######################################
say() { echo -e "\033[1;32m[INFO]\033[0m $*"; }
warn(){ echo -e "\033[1;33m[WARN]\033[0m $*"; }
fail(){ echo -e "\033[1;31m[FAIL]\033[0m $*"; exit 1; }


#######################################
# 0) Preflight
#######################################
[ -f package.json ] || fail "Run this from your project root (package.json not found)."
command -v rsync >/dev/null || fail "Install rsync on WSL: sudo apt-get update && sudo apt-get install -y rsync"

# Check SSH key exists
[ -f "$SSH_KEY" ] || fail "SSH key not found at $SSH_KEY. Generate one with: ssh-keygen -t ed25519 -C 'your_email@example.com'"

# Test server connectivity
say "Testing server connectivity..."
if ! ssh -p "$SERVER_PORT" -i "$SSH_KEY" -o ConnectTimeout=10 -o BatchMode=yes ${SERVER_USER}@${SERVER_HOST} "echo 'Connection successful'" >/dev/null 2>&1; then
  fail "Cannot connect to server. Check:\n  - SSH key is added to server: ssh-copy-id -i $SSH_KEY ${SERVER_USER}@${SERVER_HOST}\n  - Server IP/hostname is correct\n  - SSH port is correct"
fi

say "Building locally (to ensure clean artifacts)…"
# If you prefer building on the server, comment these two and keep server-side build below.
pnpm install
pnpm run build

say "Packing sources (excluding heavy/unsafe folders)…"
EXCLUDES=(
  --exclude '.git' --exclude 'node_modules' --exclude '.next/cache'
  --exclude '.env*' --exclude 'deploy.sh' --exclude '*.log'
)
# Create a transfer dir to avoid sending junk
rm -rf .deploy_push && mkdir .deploy_push
rsync -a --delete "${EXCLUDES[@]}" ./ .deploy_push/

#######################################
# 1) Push files via rsync
#######################################
say "Uploading to ${SERVER_USER}@${SERVER_HOST}:${REMOTE_DIR} …"
ssh -p "$SERVER_PORT" -i "$SSH_KEY" ${SERVER_USER}@${SERVER_HOST} "mkdir -p ${REMOTE_DIR}"
rsync -az --delete -e "ssh -p ${SERVER_PORT} -i ${SSH_KEY}" .deploy_push/ ${SERVER_USER}@${SERVER_HOST}:${REMOTE_DIR}/

#######################################
# 2) Remote setup: Node, PM2, env, build, run
#######################################
say "Configuring server & starting app…"
ssh -p "$SERVER_PORT" -i "$SSH_KEY" ${SERVER_USER}@${SERVER_HOST} bash <<EOF
set -euo pipefail

# ----- Node via nvm (safe across distros) -----
if ! command -v node >/dev/null; then
  # Try different package managers
  if command -v apt-get >/dev/null; then
    apt-get update -y
    apt-get install -y curl build-essential
  elif command -v yum >/dev/null; then
    yum update -y
    yum install -y curl gcc gcc-c++ make
  elif command -v dnf >/dev/null; then
    dnf update -y
    dnf install -y curl gcc gcc-c++ make
  else
    # Fallback: just install curl if available
    echo "No standard package manager found, trying to install Node.js directly..."
  fi
  
  # Install nvm
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
fi

# load nvm in non-interactive shell
export NVM_DIR="\$HOME/.nvm"
[ -s "\$NVM_DIR/nvm.sh" ] && . "\$NVM_DIR/nvm.sh"

nvm install ${NODE_VERSION}
nvm use ${NODE_VERSION}
corepack enable || true     # enables pnpm/yarn shims
corepack prepare pnpm@latest --activate

# ----- App dir & env -----
mkdir -p ${REMOTE_DIR}
cd ${REMOTE_DIR}

# Create/refresh .env.production if you want defaults from the script
if [ ! -f .env.production ]; then
  cat > .env.production <<'EENV'
${ENV_PROD}
EENV
fi

# ----- Dependencies & build -----
pnpm install --frozen-lockfile || pnpm install --force
# Skip server-side build since we built locally - just use the uploaded .next folder
echo "Using locally built .next folder"

# ----- PM2 start (ecosystem-free, simple) -----
# Ensure PM2 is installed globally for this Node
pnpm dlx pm2@latest stop ${APP_NAME} >/dev/null 2>&1 || true
pnpm dlx pm2@latest delete ${APP_NAME} >/dev/null 2>&1 || true
pnpm dlx pm2@latest start "pnpm start:prod" --name "${APP_NAME}" --cwd "${REMOTE_DIR}"
pnpm dlx pm2@latest save

# ----- PM2 autostart on reboot -----
# Build a systemd unit if not already set (pm2 startup can be flaky on non-login shells)
cat >/etc/systemd/system/pm2-${SERVER_USER}.service <<UNIT
[Unit]
Description=PM2 process manager for ${SERVER_USER}
After=network.target

[Service]
Type=simple
User=${SERVER_USER}
Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/root/.nvm/versions/node/v${NODE_VERSION}.*/bin
Environment=PM2_HOME=/home/${SERVER_USER}/.pm2
ExecStart=/usr/local/bin/pm2 resurrect
ExecReload=/usr/local/bin/pm2 reload all
Restart=always

[Install]
WantedBy=multi-user.target
UNIT

# Try to find pm2 binary path and create symlink
PM2_PATH=\$(which pm2 2>/dev/null || pnpm dlx which pm2 2>/dev/null || echo "/usr/local/bin/pm2")
if [ ! -f /usr/local/bin/pm2 ]; then
  ln -sf "\$PM2_PATH" /usr/local/bin/pm2 2>/dev/null || true
fi

systemctl daemon-reload
systemctl enable pm2-${SERVER_USER}.service
systemctl restart pm2-${SERVER_USER}.service

echo "App started on 127.0.0.1:${APP_PORT}"
EOF

#######################################
# 3) Nginx (one-time setup) — prints config
#######################################
cat <<NGINX

==========================================================
Add this Nginx server block on the VPS (one time):

/etc/nginx/sites-available/${DOMAIN}
----------------------------------------------------------
server {
  server_name ${DOMAIN} www.${DOMAIN};

  # Force HTTPS if you add certificates later
  listen 80;
  listen [::]:80;

  # Security headers (matches your Next.js config)
  add_header X-Frame-Options "DENY" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header Referrer-Policy "strict-origin-when-cross-origin" always;

  location / {
    proxy_pass http://127.0.0.1:${APP_PORT};
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    
    # Timeout settings
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
  }

  # Optional: Static file caching
  location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
    proxy_pass http://127.0.0.1:${APP_PORT};
    proxy_set_header Host \$host;
  }
}
----------------------------------------------------------

Then run (on the VPS):
  ln -s /etc/nginx/sites-available/${DOMAIN} /etc/nginx/sites-enabled/${DOMAIN}
  nginx -t && systemctl reload nginx

(Optional) Enable HTTPS with Let's Encrypt:
  apt-get update && apt-get install -y certbot python3-certbot-nginx
  certbot --nginx -d ${DOMAIN} -d www.${DOMAIN}

Re-deploy any time with:
  bash deploy.sh
==========================================================

NGINX

say "✅ Done. If Nginx is configured, your site will be live at https://${DOMAIN}"

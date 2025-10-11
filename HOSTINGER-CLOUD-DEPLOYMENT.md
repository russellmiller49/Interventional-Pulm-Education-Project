# Hostinger Cloud Plan Deployment Guide

This guide is specifically for deploying your Next.js 14 project to Hostinger's Cloud plan (VPS hosting).

## Prerequisites

- Hostinger Cloud plan with SSH access
- Domain pointed to your Cloud server
- Basic command line knowledge

## Step 1: Access Your Cloud Server

1. **Get SSH credentials** from your Hostinger control panel
2. **Connect via SSH**:
   ```bash
   ssh root@your-server-ip
   # or
   ssh your-username@your-server-ip
   ```

## Step 2: Install Required Software

### Update System
```bash
sudo apt update && sudo apt upgrade -y
```

### Install Node.js (LTS version)
```bash
# Install Node.js 18.x (LTS)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version
npm --version
```

### Install PM2 (Process Manager)
```bash
sudo npm install -g pm2
```

### Install Nginx (Web Server)
```bash
sudo apt install nginx -y
sudo systemctl start nginx
sudo systemctl enable nginx
```

## Step 3: Deploy Your Application

### On Your Local Machine
1. **Build your project**:
   ```bash
   npm run deploy:cloud
   ```

2. **Transfer files to server**:
   ```bash
   # Create a compressed archive
   tar -czf interventionalpulm.tar.gz --exclude=node_modules --exclude=.next --exclude=.git .
   
   # Transfer to server
   scp interventionalpulm.tar.gz root@your-server-ip:/var/www/
   ```

### On Your Server
1. **Extract and setup**:
   ```bash
   cd /var/www
   tar -xzf interventionalpulm.tar.gz
   cd interventionalpulm
   
   # Install dependencies
   npm install --production
   ```

2. **Start with PM2**:
   ```bash
   pm2 start npm --name "interventionalpulm" -- start
   pm2 save
   pm2 startup
   ```

## Step 4: Configure Nginx

### Create Nginx Configuration
```bash
sudo nano /etc/nginx/sites-available/interventionalpulm
```

Add this configuration:
```nginx
server {
    listen 80;
    server_name interventionalpulm.org www.interventionalpulm.org;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
}
```

### Enable the Site
```bash
sudo ln -s /etc/nginx/sites-available/interventionalpulm /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Step 5: Setup SSL Certificate

### Install Certbot
```bash
sudo apt install certbot python3-certbot-nginx -y
```

### Get SSL Certificate
```bash
sudo certbot --nginx -d interventionalpulm.org -d www.interventionalpulm.org
```

### Auto-renewal
```bash
sudo crontab -e
# Add this line:
0 12 * * * /usr/bin/certbot renew --quiet
```

## Step 6: Configure Firewall

```bash
# Allow SSH, HTTP, and HTTPS
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

## Step 7: Environment Variables

Create production environment file:
```bash
nano /var/www/interventionalpulm/.env.production
```

Add your production variables:
```env
NEXT_PUBLIC_APP_URL=https://interventionalpulm.org
NODE_ENV=production
```

## Monitoring and Maintenance

### Check Application Status
```bash
pm2 status
pm2 logs interventionalpulm
```

### Update Application
```bash
cd /var/www/interventionalpulm
git pull origin main
npm install --production
pm2 restart interventionalpulm
```

### Backup Strategy
```bash
# Create backup script
nano /root/backup.sh
```

Add to backup script:
```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
tar -czf /root/backup_$DATE.tar.gz /var/www/interventionalpulm
```

Make executable and schedule:
```bash
chmod +x /root/backup.sh
crontab -e
# Add: 0 2 * * * /root/backup.sh
```

## Performance Optimization

### Enable Gzip Compression
Add to Nginx config:
```nginx
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
```

### Setup Log Rotation
```bash
sudo nano /etc/logrotate.d/interventionalpulm
```

Add:
```
/var/www/interventionalpulm/.next/cache/*.log {
    daily
    missingok
    rotate 52
    compress
    notifempty
    create 644 root root
}
```

## Troubleshooting

### Common Issues:

1. **Application not starting**:
   ```bash
   pm2 logs interventionalpulm
   pm2 restart interventionalpulm
   ```

2. **Nginx not serving**:
   ```bash
   sudo nginx -t
   sudo systemctl status nginx
   ```

3. **SSL issues**:
   ```bash
   sudo certbot certificates
   sudo certbot renew --dry-run
   ```

4. **Port conflicts**:
   ```bash
   sudo netstat -tlnp | grep :3000
   ```

## Security Checklist

- [ ] Firewall configured
- [ ] SSL certificate installed
- [ ] Regular updates scheduled
- [ ] Backup strategy in place
- [ ] Environment variables secured
- [ ] PM2 process monitoring enabled

Your Next.js application is now running on Hostinger Cloud with full production capabilities! 🚀





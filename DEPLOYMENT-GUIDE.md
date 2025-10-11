# 🚀 Deployment Guide for interventionalpulm.org

This guide will help you deploy your Next.js application to Hostinger Cloud and connect it to your domain `interventionalpulm.org`.

## 📋 Prerequisites

- ✅ Hostinger Cloud plan with SSH access
- ✅ Domain `interventionalpulm.org` pointed to your Cloud server
- ✅ SSH access to your server
- ✅ Basic command line knowledge

## 🎯 Quick Deployment (Recommended)

### Step 1: Get Your Server Details

1. **Log into your Hostinger control panel**
2. **Go to Cloud → Your Server**
3. **Note down your server IP address**
4. **Get your SSH credentials** (username/password or SSH key)

### Step 2: Update the Deployment Script

Edit the `deploy.sh` file and add your server IP:

```bash
# Open the deployment script
nano deploy.sh

# Find this line and replace with your server IP:
SERVER_IP="YOUR_SERVER_IP_HERE"
```

### Step 3: Run the Deployment

```bash
# Make sure you're in the project directory
cd /home/rjm/projects/IP_website

# Run the deployment script
./deploy.sh
```

The script will:

- ✅ Build your Next.js application
- ✅ Create a deployment package
- ✅ Transfer files to your server
- ✅ Install dependencies on the server
- ✅ Start the application with PM2
- ✅ Configure environment variables

## 🔧 Manual Deployment (Alternative)

If you prefer to deploy manually, follow these steps:

### On Your Local Machine

1. **Build the application:**

   ```bash
   pnpm install
   pnpm run build
   ```

2. **Create deployment package:**

   ```bash
   tar -czf interventionalpulm.tar.gz \
       --exclude=node_modules \
       --exclude=.next \
       --exclude=.git \
       --exclude=*.log \
       --exclude=.env.local \
       .
   ```

3. **Transfer to server:**
   ```bash
   scp interventionalpulm.tar.gz root@YOUR_SERVER_IP:/var/www/
   ```

### On Your Server

1. **Connect via SSH:**

   ```bash
   ssh root@YOUR_SERVER_IP
   ```

2. **Extract and setup:**

   ```bash
   cd /var/www
   tar -xzf interventionalpulm.tar.gz
   cd interventionalpulm
   npm install --production
   ```

3. **Create environment file:**

   ```bash
   cat > .env.production << EOL
   NEXT_PUBLIC_APP_URL=https://interventionalpulm.org
   NODE_ENV=production
   EOL
   ```

4. **Start with PM2:**
   ```bash
   pm2 start npm --name "interventionalpulm" -- start:prod
   pm2 save
   pm2 startup
   ```

## 🌐 Configure Nginx (Web Server)

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

## 🔒 Setup SSL Certificate (HTTPS)

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

## 🔥 Configure Firewall

```bash
# Allow SSH, HTTP, and HTTPS
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

## 📊 Monitoring Your Application

### Check Application Status

```bash
pm2 status
pm2 logs interventionalpulm
pm2 monit
```

### Restart Application

```bash
pm2 restart interventionalpulm
```

### View Logs

```bash
pm2 logs interventionalpulm --lines 100
```

## 🔄 Updating Your Application

### Method 1: Using the Deployment Script

```bash
# On your local machine
./deploy.sh
```

### Method 2: Manual Update

```bash
# On your server
cd /var/www/interventionalpulm
git pull origin main  # if using git
npm install --production
pm2 restart interventionalpulm
```

## 🛠️ Troubleshooting

### Application Not Starting

```bash
pm2 logs interventionalpulm
pm2 restart interventionalpulm
```

### Nginx Issues

```bash
sudo nginx -t
sudo systemctl status nginx
sudo systemctl restart nginx
```

### SSL Issues

```bash
sudo certbot certificates
sudo certbot renew --dry-run
```

### Port Conflicts

```bash
sudo netstat -tlnp | grep :3000
```

## 🔐 Security Checklist

- [ ] Firewall configured (UFW enabled)
- [ ] SSL certificate installed and auto-renewal set up
- [ ] Nginx security headers configured
- [ ] PM2 process monitoring enabled
- [ ] Regular backups scheduled
- [ ] Environment variables secured
- [ ] SSH key authentication (recommended)

## 📈 Performance Optimization

### Enable Gzip Compression in Nginx

Add to your Nginx config:

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

## 🎉 Success!

Once deployed, your website will be available at:

- **Main site**: https://interventionalpulm.org
- **WWW version**: https://www.interventionalpulm.org

## 📞 Support

If you encounter any issues:

1. Check the logs: `pm2 logs interventionalpulm`
2. Verify Nginx: `sudo nginx -t`
3. Check SSL: `sudo certbot certificates`
4. Review the troubleshooting section above

Your Next.js application is now running on Hostinger Cloud with full production capabilities! 🚀

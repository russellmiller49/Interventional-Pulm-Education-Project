# Hostinger Deployment Guide

This guide covers deploying your Next.js 14 project to Hostinger hosting.

## Hosting Options

### Option 1: Shared Hosting (Static Export)

**Best for**: Simple websites, lower cost
**Limitations**: No server-side features, API routes, or dynamic content

#### Steps:

1. **Configure for Static Export**
   ```bash
   # Edit next.config.ts and uncomment these lines:
   output: 'export',
   trailingSlash: true,
   images: {
     unoptimized: true,
   },
   ```

2. **Build Static Files**
   ```bash
   npm run deploy:static
   ```

3. **Upload to Hostinger**
   - Upload contents of `/out` directory to your domain's `public_html` folder
   - Ensure `index.html` is in the root of `public_html`

### Option 2: VPS Hosting (Full Next.js)

**Best for**: Full-featured applications with API routes and server-side rendering

#### Prerequisites:
- Hostinger VPS plan
- SSH access to your VPS

#### Steps:

1. **Build for Production**
   ```bash
   npm run deploy:vps
   ```

2. **Transfer Files to VPS**
   ```bash
   # From your local machine
   scp -r . user@your-vps-ip:/var/www/your-domain
   ```

3. **SSH into VPS and Setup**
   ```bash
   # Install Node.js (if not already installed)
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt install -y nodejs

   # Navigate to project directory
   cd /var/www/your-domain

   # Install dependencies
   npm install --production

   # Start with PM2
   npm install -g pm2
   pm2 start npm --name "interventionalpulm" -- start
   pm2 save
   pm2 startup
   ```

4. **Configure Nginx (Reverse Proxy)**
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
   }
   ```

   Enable the site:
   ```bash
   sudo ln -s /etc/nginx/sites-available/interventionalpulm /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

5. **Setup SSL Certificate**
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d interventionalpulm.org -d www.interventionalpulm.org
   ```

## Environment Variables

Create a `.env.production` file for production environment variables:

```env
NEXT_PUBLIC_APP_URL=https://interventionalpulm.org
# Add other production environment variables here
```

## Domain Configuration

1. **Point Domain to Hostinger**
   - Update DNS records to point to Hostinger's servers
   - For VPS: Point A record to your VPS IP address

2. **SSL Certificate**
   - Hostinger provides free SSL certificates
   - For VPS: Use Let's Encrypt (certbot) as shown above

## Monitoring and Maintenance

### For VPS Deployment:
```bash
# Check application status
pm2 status

# View logs
pm2 logs interventionalpulm

# Restart application
pm2 restart interventionalpulm

# Update application
git pull origin main
npm install --production
pm2 restart interventionalpulm
```

## Troubleshooting

### Common Issues:

1. **Static Export Issues**
   - Ensure no server-side features are used
   - Check for API routes (not supported in static export)
   - Verify image optimization is disabled

2. **VPS Deployment Issues**
   - Check firewall settings (ensure port 3000 is accessible)
   - Verify Node.js version compatibility
   - Check PM2 process status

3. **Domain Issues**
   - Verify DNS propagation
   - Check SSL certificate status
   - Ensure proper Nginx configuration

## Performance Optimization

1. **Enable Gzip Compression** (Nginx)
2. **Setup CDN** (Cloudflare recommended)
3. **Optimize Images** (use Next.js Image component)
4. **Enable Caching** (browser and server-side)

## Security Considerations

1. **Keep Dependencies Updated**
2. **Use Environment Variables** for sensitive data
3. **Enable Security Headers** (already configured in next.config.ts)
4. **Regular Backups** of your application and database





# 🚀 Automatic HTTPS Deployment

## **One Command Deployment**

```bash
docker-compose up -d --build
```

That's it! Your application will be available with HTTPS automatically.

## **What Happens Automatically**

1. ✅ **SSL certificates** are generated inside the container
2. ✅ **HTTPS configuration** is applied automatically
3. ✅ **HTTP redirects** to HTTPS
4. ✅ **No manual setup** required

## **Access Your Application**

- **HTTPS**: `https://your-server-ip:8443` or `https://your-domain.com:8443`
- **HTTP**: `http://your-server-ip:8080` (redirects to HTTPS)
- **Health Check**: `https://your-server-ip:8443/health`

## **SSL Certificate**

- **Type**: Self-signed (auto-generated)
- **Validity**: 365 days
- **Browser warnings**: Normal for self-signed certificates
- **Auto-renewal**: Built into container startup

## **Troubleshooting**

```bash
# View logs
docker-compose logs -f

# Restart
docker-compose restart

# Rebuild
docker-compose up -d --build
```

## **Files Created**

- `startup.sh` - Automatic SSL certificate generation
- `deploy-auto.sh` - Simple deployment script
- `AUTO_DEPLOYMENT.md` - Detailed guide
- Updated `Dockerfile` - Includes openssl and startup script
- Updated `docker-compose.yml` - Exposes ports 80 and 443

**No manual SSL setup required!** 🎉

# 🔒 CodeSight Security Setup Guide

## **⚠️ IMPORTANT: Read This First**

This project contains sensitive information and requires proper security setup.

## **🚨 Before You Start**

### **1. Check Your .env File**
```bash
# Make sure your .env file is NOT in git
git status .env

# If it shows up, it's NOT protected\! 
# Run: git rm --cached .env
```

### **2. Verify .gitignore**
```bash
# Check that .gitignore includes .env
grep -n "\.env" .gitignore

# Should show multiple entries protecting .env files
```

### **3. Set Up Environment Variables**
```bash
# Copy the template
cp .env.example .env

# Edit with your actual values
nano .env
```

## **🔑 Required API Keys**

### **MongoDB Atlas**
1. Go to [MongoDB Atlas](https://cloud.mongodb.com/)
2. Create a cluster
3. Get connection string
4. Add to `.env` as `MONGODB_CONNECTION_STRING`

### **Pinecone Vector Database**
1. Go to [Pinecone](https://pinecone.io/)
2. Create an index named `codesight-vectors`
3. Get API key
4. Add to `.env` as `PINECONE_API_KEY`

### **OpenAI API**
1. Go to [OpenAI](https://platform.openai.com/)
2. Create API key
3. Add to `.env` as `OPENAI_API_KEY`

## **🛡️ Security Checklist**

- [ ] `.env` file is in `.gitignore`
- [ ] Never commit API keys
- [ ] Use different keys for dev/prod
- [ ] Enable 2FA on all accounts
- [ ] Regular key rotation
- [ ] Monitor API usage
- [ ] Use environment variables only
- [ ] Never hardcode secrets
- [ ] Clear logs with sensitive data
- [ ] Use HTTPS in production

## **🚀 Quick Start (After Security Setup)**

```bash
# Install dependencies
npm install

# Start API server
npm run api

# Start mobile client (in another terminal)
cd mobile-client
npm install
npm start
```

## **📱 Mobile Client Security**

The mobile client connects to your local API server. Make sure:

1. API server is running (`npm run api`)
2. No hardcoded credentials in mobile app
3. Server URL is configurable in app settings
4. Use HTTPS in production

## **🔍 Test Your Setup**

```bash
# Test API server
curl http://localhost:3000/health

# Test database connections
npm run test:database

# Test mobile client
cd mobile-client && npm start
```

## **🆘 If You Accidentally Commit Secrets**

1. **Immediately rotate all API keys**
2. **Change all passwords**
3. **Remove from git history**:
   ```bash
   git filter-branch --force --index-filter \
   'git rm --cached --ignore-unmatch .env' \
   --prune-empty --tag-name-filter cat -- --all
   ```
4. **Force push** (⚠️ dangerous):
   ```bash
   git push origin --force --all
   ```

## **📞 Need Help?**

- Check `SECURITY.md` for detailed guidelines
- Review `.env.example` for required variables
- Ensure API keys are valid and have proper permissions
- Monitor logs for any authentication errors

---

**🔒 Remember: Security first\! Never commit sensitive information.**
EOF < /dev/null
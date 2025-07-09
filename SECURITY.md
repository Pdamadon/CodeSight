# Security Guidelines for CodeSight

## 🔒 **Private Information Protection**

This repository contains sensitive information that must be protected:

### **Never Commit These Files:**
- `.env` - Contains API keys and database credentials
- `logs/` - May contain sensitive scraped data
- `data/` - Contains database files with scraped content
- `results/` - May contain private scraped data
- `screenshots/` - May contain sensitive website content

### **Environment Variables**
All sensitive configuration is stored in environment variables:
- `MONGODB_CONNECTION_STRING` - MongoDB Atlas connection with credentials
- `PINECONE_API_KEY` - Pinecone vector database API key
- `OPENAI_API_KEY` - OpenAI API key for AI functionality

### **Setup Instructions**
1. Copy `.env.example` to `.env`
2. Fill in your actual API keys and credentials
3. Never commit the `.env` file
4. Use different credentials for development and production

### **Database Security**
- MongoDB Atlas connection uses TLS encryption
- Pinecone uses API key authentication
- Local database files are excluded from git

### **API Security**
- All API endpoints should validate input
- Rate limiting is implemented to prevent abuse
- WebSocket connections are secured with origin validation

### **Mobile App Security**
- Server URL is configurable
- No hardcoded credentials in mobile app
- All API communication uses HTTPS in production

### **Development Security**
- Use environment variables for all secrets
- Never log sensitive information
- Clear browser cache containing scraped data
- Use headless mode to avoid screenshots with sensitive content

### **Production Security**
- Use strong, unique passwords for all services
- Enable 2FA on all accounts
- Use separate API keys for production
- Monitor API usage and rate limits
- Regular security audits of dependencies

### **Incident Response**
If sensitive data is accidentally committed:
1. Immediately rotate all API keys
2. Change all passwords
3. Review git history for leaked credentials
4. Consider using `git filter-branch` to remove sensitive data
5. Notify team members to update their local repositories

### **Third-Party Services**
- MongoDB Atlas: Database hosting
- Pinecone: Vector database
- OpenAI: AI model access
- All services use encrypted connections
- Regular security updates applied

### **Code Review**
- All code changes must be reviewed
- Check for hardcoded secrets
- Verify proper error handling
- Ensure sensitive data is not logged
- Test with minimal required permissions

### **Monitoring**
- Log all API access attempts
- Monitor unusual activity patterns
- Track rate limit violations
- Alert on failed authentication attempts
- Regular backup of encrypted data

---

**Remember: Security is everyone's responsibility. When in doubt, ask\!**
EOF < /dev/null
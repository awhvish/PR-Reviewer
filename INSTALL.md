# 🚀 Installation Guide

Complete setup instructions for the AI PR Reviewer bot.

## 📋 Prerequisites

### System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| **Node.js** | v20.0.0 | v20.18.1+ |
| **Memory** | 4GB RAM | 8GB RAM |
| **Storage** | 10GB free | 50GB free |
| **CPU** | 2 cores | 4+ cores |

### Required Software

```bash
# Node.js (using nvm - recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20

# Docker & Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Git
sudo apt update && sudo apt install git  # Ubuntu/Debian
# or
brew install git  # macOS
```

## 🔧 GitHub App Setup

### Step 1: Create GitHub App

1. Go to [GitHub Apps settings](https://github.com/settings/apps/new)
2. Fill in the required fields:

```
App name: Your PR Reviewer
Homepage URL: https://github.com/yourusername/PR-Reviewer
Webhook URL: https://smee.io/new (get this from smee.io)
Webhook secret: Generate a random string
```

### Step 2: Set Permissions

#### Repository permissions:
- **Contents**: Read
- **Issues**: Write  
- **Pull requests**: Write
- **Metadata**: Read

#### Subscribe to events:
- [x] Issues
- [x] Pull request
- [x] Issue comment
- [x] Pull request review comment

### Step 3: Generate Private Key

1. After creating the app, scroll down to "Private keys"
2. Click "Generate a private key" 
3. Download the `.pem` file
4. Convert to environment variable format:

```bash
# Convert .pem to single line for .env
awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' your-app.pem
```

### Step 4: Install App

1. Go to your GitHub App's page
2. Click "Install App" in the left sidebar
3. Select repositories you want to enable
4. Note the installation ID from the URL after installation

## 🛠️ Project Setup

### Step 1: Clone Repository

```bash
git clone https://github.com/awhvish/PR-Reviewer.git
cd PR-Reviewer
```

### Step 2: Install Dependencies

```bash
# Install Node.js dependencies
npm install

# Verify installation
npm run type-check
```

### Step 3: Environment Configuration

```bash
# Copy example environment file
cp .env.example .env

# Edit with your credentials
nano .env  # or use your preferred editor
```

#### Required Environment Variables

```bash
# GitHub App Configuration
APP_ID=123456                          # From GitHub App settings
WEBHOOK_SECRET=your_webhook_secret      # You created this
SMEE_URL=https://smee.io/abc123        # From smee.io
PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA...
-----END RSA PRIVATE KEY-----"

# LLM Provider (choose one)
LLM_PROVIDER=openai                    # or "ollama"
OPENAI_API_KEY=sk-proj-...            # Required if using OpenAI

# Vector Database
CHROMA_HOST=localhost
CHROMA_PORT=8000

# Optional Configuration
CONFIDENCE_THRESHOLD=50                 # Only post reviews above this confidence
MAX_REPO_SIZE_GB=5                     # Skip repos larger than this
ENABLE_EMBEDDING_CACHE=true            # Save on API costs
LOG_LEVEL=info                         # debug, info, warn, error
```

### Step 4: Start Services

```bash
# Start ChromaDB and related services
docker-compose up -d

# Verify services are running
docker-compose ps

# Expected output:
# NAME                    COMMAND                  SERVICE             STATUS
# pr-reviewer-chromadb-1  "/docker-entrypoint.…"   chromadb           Up 30 seconds
```

### Step 5: Start Development Server

```bash
# Start the bot in development mode
npm run dev

# You should see:
# 🤖 PR Reviewer App is loaded!
# Webhook proxy started on port 3000
```

## 🔒 Privacy Mode Setup (Ollama)

For sensitive repositories, set up local AI processing:

### Step 1: Install Ollama

```bash
# Linux/macOS
curl -fsSL https://ollama.ai/install.sh | sh

# Windows
# Download from https://ollama.ai/download
```

### Step 2: Start Ollama Service

```bash
# Start Ollama server
ollama serve

# Verify it's running
curl http://localhost:11434/api/version
```

### Step 3: Pull Required Models

```bash
# Language model for code review (8B parameters)
ollama pull llama3.1:8b

# Embedding model for vector search
ollama pull nomic-embed-text

# Verify models are downloaded
ollama list
```

### Step 4: Configure Privacy Mode

```bash
# Update environment for local processing
echo "LLM_PROVIDER=ollama" >> .env

# Remove OpenAI key if present
sed -i '/OPENAI_API_KEY/d' .env

# Restart the bot
npm restart
```

### Step 5: Verify Privacy Mode

```bash
# Check logs for Ollama usage
DEBUG=pr-reviewer:llm* npm run dev

# Should see logs like:
# pr-reviewer:llm Using Ollama provider at http://localhost:11434
# pr-reviewer:llm Model: llama3.1:8b
```

## 🧪 Testing Installation

### Step 1: Webhook Test

```bash
# Test webhook delivery using Smee
npx smee-client --url $SMEE_URL --path /api/github/webhooks

# In another terminal
curl -X POST $SMEE_URL \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

### Step 2: Create Test PR

1. Create a test repository
2. Install your GitHub App on it
3. Create a simple PR with this content:

```javascript
// test.js - intentionally flawed for testing
function getUserData(userId) {
    const query = `SELECT * FROM users WHERE id = ${userId}`;  // SQL injection
    const apiKey = "sk-1234567890";  // Hardcoded secret
    return database.query(query);
}
```

4. The bot should comment with security warnings

### Step 3: Verify Dashboard

```bash
# Access dashboard
open http://localhost:3000/dashboard

# Should show:
# - Review statistics
# - Recent activity
# - Performance metrics
```

## 🐳 Production Deployment

### Option 1: Docker Compose (Recommended)

```bash
# Create production environment
cp .env.example .env.production

# Build production image
docker-compose -f docker-compose.prod.yml build

# Deploy
docker-compose -f docker-compose.prod.yml up -d

# Verify deployment
docker-compose -f docker-compose.prod.yml ps
```

### Option 2: Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Deploy
railway up

# Set environment variables in Railway dashboard
railway variables set APP_ID=123456
railway variables set WEBHOOK_SECRET=your_secret
# ... etc
```

### Option 3: Render

```bash
# Connect GitHub repository to Render
# Set environment variables in Render dashboard
# Deploy from GitHub main branch
```

### Option 4: VPS Deployment

```bash
# On your server
git clone https://github.com/awhvish/PR-Reviewer.git
cd PR-Reviewer

# Install dependencies
npm ci --production

# Build application
npm run build

# Create systemd service
sudo nano /etc/systemd/system/pr-reviewer.service
```

```ini
[Unit]
Description=PR Reviewer Bot
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/PR-Reviewer
Environment=NODE_ENV=production
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start service
sudo systemctl enable pr-reviewer
sudo systemctl start pr-reviewer

# Check status
sudo systemctl status pr-reviewer
```

## ⚙️ Configuration Options

### Performance Tuning

```bash
# .env performance settings
CONFIDENCE_THRESHOLD=70           # Higher = fewer but better comments
MAX_PARALLEL_REVIEWS=3           # Concurrent PR processing
EMBEDDING_BATCH_SIZE=50          # Batch embeddings for efficiency
REPO_CACHE_SIZE_GB=10           # Increase for better performance
REQUEST_TIMEOUT_MS=30000        # Timeout for API requests
```

### Security Settings

```bash
# Enhanced security configuration
ENABLE_SECRET_SCANNING=true     # Scan for hardcoded secrets
REDACT_SECRETS_IN_LOGS=true    # Don't log sensitive data
ALLOWED_REPO_PATTERNS=org/*    # Restrict to specific repositories
WEBHOOK_VERIFICATION=strict    # Verify all webhook signatures
```

### Advanced Features

```bash
# Feature flags
ENABLE_CALL_GRAPH_ANALYSIS=true    # Track function relationships
ENABLE_INLINE_SUGGESTIONS=true     # GitHub suggestion format
ENABLE_FEEDBACK_LEARNING=true      # Learn from user reactions
ENABLE_COST_TRACKING=true          # Track OpenAI API costs
ENABLE_PERFORMANCE_METRICS=true    # Detailed performance logging
```

## 🔧 Troubleshooting

### Common Issues

#### Issue: Webhook events not received

```bash
# Check Smee connection
npx smee-client --url $SMEE_URL --path /api/github/webhooks

# Verify webhook URL in GitHub App settings
# Ensure firewall allows incoming connections on port 3000
```

#### Issue: ChromaDB connection failed

```bash
# Check if ChromaDB is running
docker-compose logs chromadb

# Restart ChromaDB
docker-compose restart chromadb

# Check connection
curl http://localhost:8000/api/v1/heartbeat
```

#### Issue: High OpenAI API costs

```bash
# Enable embedding cache
echo "ENABLE_EMBEDDING_CACHE=true" >> .env

# Switch to Ollama for free inference
echo "LLM_PROVIDER=ollama" >> .env
ollama pull llama3.1:8b

# Monitor costs in dashboard
open http://localhost:3000/dashboard
```

#### Issue: Poor review quality

```bash
# Increase confidence threshold
echo "CONFIDENCE_THRESHOLD=75" >> .env

# Check user feedback
npm run feedback-report

# Review recent examples
tail -f logs/reviews.log
```

#### Issue: Bot crashes on large repositories

```bash
# Reduce maximum repo size
echo "MAX_REPO_SIZE_GB=2" >> .env

# Increase memory limit
echo "NODE_OPTIONS=--max-old-space-size=8192" >> .env

# Skip large files
echo "MAX_FILE_SIZE_KB=100" >> .env
```

#### Issue: Slow performance

```bash
# Enable all caches
echo "ENABLE_EMBEDDING_CACHE=true" >> .env
echo "ENABLE_REPO_CACHE=true" >> .env

# Increase parallel processing
echo "MAX_PARALLEL_REVIEWS=5" >> .env

# Use faster embedding model
echo "EMBEDDING_MODEL=text-embedding-3-small" >> .env
```

### Debug Mode

```bash
# Enable full debug logging
DEBUG=pr-reviewer* npm run dev

# Specific subsystem debugging
DEBUG=pr-reviewer:webhook* npm run dev    # Webhook events
DEBUG=pr-reviewer:llm* npm run dev        # LLM interactions
DEBUG=pr-reviewer:rag* npm run dev        # RAG pipeline
DEBUG=pr-reviewer:security* npm run dev   # Security scanning
```

### Log Analysis

```bash
# View recent logs
tail -f logs/app.log

# Search for errors
grep ERROR logs/app.log | tail -20

# Monitor performance
grep "Review completed" logs/app.log | awk '{print $3}' | sort -n
```

## 📊 Monitoring & Maintenance

### Health Checks

```bash
# Application health
curl http://localhost:3000/health

# Database health  
curl http://localhost:8000/api/v1/heartbeat

# Ollama health (if using)
curl http://localhost:11434/api/version
```

### Backup Strategy

```bash
# Backup ChromaDB data
docker run --rm -v pr-reviewer_chromadb_data:/data -v $(pwd):/backup ubuntu tar czf /backup/chromadb-backup.tar.gz /data

# Backup feedback database
cp data/feedback.db backups/feedback-$(date +%Y%m%d).db

# Backup configuration
cp .env backups/.env-$(date +%Y%m%d)
```

### Updating

```bash
# Pull latest changes
git pull origin main

# Update dependencies
npm update

# Rebuild and restart
npm run build
docker-compose restart

# Verify update
curl http://localhost:3000/health
```

## 🆘 Getting Help

- **Documentation**: Check [docs/](./docs/) directory
- **Issues**: [GitHub Issues](https://github.com/awhvish/PR-Reviewer/issues)
- **Discussions**: [GitHub Discussions](https://github.com/awhvish/PR-Reviewer/discussions)
- **Discord**: [Community Server](https://discord.gg/pr-reviewer) 
- **Email**: support@pr-reviewer.ai

## 🎯 Next Steps

After successful installation:

1. **Test thoroughly** - Create test PRs with known issues
2. **Tune confidence** - Adjust threshold based on team feedback
3. **Monitor costs** - Track OpenAI usage in dashboard
4. **Gather feedback** - Encourage team to use 👍/👎 reactions
5. **Scale up** - Install on more repositories gradually

Ready to catch bugs faster! 🚀
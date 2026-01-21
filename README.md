# 🤖 AI PR Reviewer

> Catch bugs before your teammates do. An intelligent GitHub bot that provides context-aware code reviews using AI and retrieval-augmented generation.

![GitHub stars](https://img.shields.io/github/stars/awhvish/PR-Reviewer)
![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)
![Docker](https://img.shields.io/badge/docker-ready-blue.svg)

![Demo Preview](./docs/demo.gif)

## ✨ Features

### 🔒 **Privacy-First Design**
- **Ollama Support**: Run completely offline with local LLMs for private repositories
- **Enterprise Ready**: Zero code leakage to external APIs when using privacy mode
- **Configurable Providers**: Switch between OpenAI and local models seamlessly

### 🧠 **Context-Aware Intelligence**
- **RAG Pipeline**: Understands your entire codebase, not just the diff
- **Hybrid Retrieval**: Combines vector search with keyword matching for better context
- **Call Graph Analysis**: Tracks function relationships and dependencies
- **Semantic Code Understanding**: Uses Tree-sitter for accurate AST parsing

### 🔐 **Advanced Security Scanning**
- **Secret Detection**: Catches API keys, passwords, and tokens before commit
- **Vulnerability Analysis**: Detects SQL injection, XSS, and other security flaws
- **Pattern Recognition**: Learns your codebase's security patterns

### 📊 **Smart Feedback Loop**
- **User Reactions**: Learn from 👍/👎 feedback to improve review quality
- **Confidence Scoring**: Only surfaces high-confidence suggestions
- **Severity Levels**: 🔴 Critical, 🟡 Warning, 🔵 Suggestion classifications
- **Live Dashboard**: Real-time metrics and performance tracking

### 🚀 **Production Ready**
- **Dockerized Deployment**: One-command deployment with Docker Compose
- **Caching Strategy**: Efficient repo caching and embedding reuse
- **Rate Limiting**: Smart backoff to handle API limits gracefully
- **Health Monitoring**: Built-in health checks and monitoring

## 📊 Benchmark Results

| Metric | OpenAI GPT-4 | Ollama Llama3.1:8b | Traditional Tools |
|--------|--------------|---------------------|-------------------|
| **Precision** | 74% | 68% | 45% |
| **Recall** | 52% | 48% | 30% |
| **Helpful Rate** | 78% 👍 | 71% 👍 | 42% 👍 |
| **Avg Latency** | 4.2s | 8.1s | 2.1s |
| **Cost per PR** | $0.08 | $0.00 | $0.00 |
| **Security Issues Caught** | 89% | 82% | 35% |


## 🏗️ Architecture

```mermaid
flowchart TD
    subgraph GitHub
        PR[Pull Request] --> WH[Webhook]
    end
    
    subgraph "PR Reviewer Bot"
        WH --> Handler[Event Handler]
        Handler --> Clone[Repo Cloner]
        Clone --> Cache[(Repo Cache<br/>LRU)]
        Clone --> Parser[Tree-sitter Parser]
        Parser --> Indexer[Code Indexer]
        
        Handler --> Diff[Diff Parser]
        Diff --> Security[Security Scanner]
        
        Indexer --> VDB[(ChromaDB<br/>Vector Store)]
        Diff --> Retriever[Hybrid Retriever<br/>Vector + BM25]
        Retriever --> VDB
        
        Security --> LLM{LLM Provider}
        Retriever --> LLM
        LLM --> OpenAI[OpenAI GPT-4]
        LLM --> Ollama[Ollama Local]
        
        LLM --> Formatter[Review Formatter]
        Formatter --> Review[GitHub Review<br/>Inline Comments]
    end
    
    subgraph "Analytics & Feedback"
        Review --> Reactions[👍/👎 Reactions]
        Reactions --> FDB[(Feedback DB)]
        FDB --> Dashboard[📊 Live Dashboard]
    end
    
    style LLM fill:#e1f5fe
    style VDB fill:#f3e5f5
    style Cache fill:#e8f5e8
```

## 🚀 Quick Start

### Prerequisites
- Node.js ≥ 20.0.0
- Docker & Docker Compose
- GitHub App credentials

### 1-Minute Setup

```bash
# Clone the repository
git clone https://github.com/awhvish/PR-Reviewer.git
cd PR-Reviewer

# Install dependencies
npm install

# Start services
docker-compose up -d

# Configure environment (see INSTALL.md for details)
cp .env.example .env
# Edit .env with your credentials

# Run the bot
npm run dev
```

For detailed setup instructions, see [INSTALL.md](./INSTALL.md).

## 🔧 Configuration

### Environment Variables

```bash
# Required - GitHub App
APP_ID=your_github_app_id
PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n..."
WEBHOOK_SECRET=your_webhook_secret

# Optional - LLM Provider (defaults to OpenAI)
LLM_PROVIDER=openai  # or "ollama" for privacy mode
OPENAI_API_KEY=sk-...  # Required if using OpenAI

# Optional - Vector Database
CHROMA_HOST=localhost
CHROMA_PORT=8000

# Optional - Performance
MAX_REPO_SIZE_GB=5
CONFIDENCE_THRESHOLD=50
RATE_LIMIT_RPM=60
```

### Privacy Mode Setup

For sensitive repositories, use Ollama for 100% local processing:

```bash
# Install and start Ollama
curl -fsSL https://ollama.ai/install.sh | sh
ollama serve

# Pull required models
ollama pull llama3.1:8b
ollama pull nomic-embed-text

# Configure privacy mode
echo "LLM_PROVIDER=ollama" >> .env

# Restart the bot
npm restart
```

## 💻 Usage Examples

### Basic Code Review
When you open a PR, the bot automatically:

```markdown
🤖 **AI Code Review**

🔴 **1 Critical Issue** • 🟡 **2 Warnings** • 🔵 **1 Suggestion**

---

🔴 **CRITICAL** (92% confidence)

**Possible SQL injection vulnerability**
```suggestion
- const result = await db.query(`SELECT * FROM users WHERE id = ${userId}`);
+ const result = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
```

🟡 **WARNING** (78% confidence)

**Missing error handling for async operation**
This function calls `getUserById` but doesn't handle potential failures. Consider adding try-catch.

🔵 **SUGGESTION** (65% confidence)

**Consider using consistent naming**
Based on your codebase patterns, consider renaming `validateInput` to `validateUserInput` to match the convention used in `auth/validators.js`.
```

### Security Scanning Results

```markdown
🛡️ **Security Scan Results**

⚠️ Found 1 security issue:

**Line 23**: Potential secret detected
```
const API_KEY = "sk-1234567890abcdef"; // 🔴 This looks like an OpenAI API key
```

**Recommendation**: Move to environment variables
```suggestion
const API_KEY = process.env.OPENAI_API_KEY;
```
```

### Context-Aware Suggestions

The bot understands your codebase patterns:

```markdown
🧠 **Context-Aware Analysis**

I noticed you're modifying the `calculateTax` function. Based on similar functions in your codebase:

- `calculateShipping` (utils/shipping.js:45) handles edge cases for zero amounts
- `calculateDiscount` (utils/pricing.js:23) includes input validation
- Both functions use the same error handling pattern

Consider applying similar patterns to maintain consistency.
```

## 📈 Dashboard & Analytics

Access the live dashboard at `http://localhost:3000/dashboard`:

```
┌─────────────────────────────────────────────────────────────┐
│  🚀 PR Reviewer Dashboard                                   │
├─────────────┬──────────────┬─────────────┬─────────────────┤
│ Reviews     │ Helpful Rate │ Avg Latency │ Cost Today      │
│ 47 today    │ 78% 👍       │ 4.2s        │ $0.83           │
├─────────────┴──────────────┴─────────────┴─────────────────┤
│ [📈 7-day trend chart showing review quality over time]    │
├─────────────────────────────────────────────────────────────┤
│ Recent Reviews                                              │
│ ├─ user/repo#123: 3 issues (1 🔴, 2 🟡) — 2 min ago        │
│ ├─ org/project#456: 1 issue (1 🔵) — 15 min ago           │
│ └─ team/app#789: 0 issues ✓ — 1 hour ago                  │
├─────────────────────────────────────────────────────────────┤
│ Top Issue Categories This Week                              │
│ ├─ Security Issues: 23 (↑15%)                              │
│ ├─ Logic Errors: 18 (↓5%)                                  │
│ ├─ Performance: 12 (↑8%)                                   │
│ └─ Style Issues: 9 (↓20%)                                  │
└─────────────────────────────────────────────────────────────┘
```

## 🛠️ Development

### Project Structure

```
pr-reviewer/
├── src/
│   ├── index.ts              # Entry point
│   ├── github/
│   │   ├── webhook.ts        # Event handlers
│   │   └── comments.ts       # Review posting
│   ├── git/
│   │   └── cloner.ts         # Repository cloning with cache
│   ├── parsing/
│   │   ├── treeSitter.ts     # AST parsing
│   │   └── codeChunker.ts    # Code chunking for RAG
│   ├── rag/
│   │   ├── embeddings.ts     # Embedding generation
│   │   ├── vectorStore.ts    # ChromaDB operations
│   │   ├── retriever.ts      # Hybrid search
│   │   └── indexer.ts        # Full indexing pipeline
│   ├── llm/
│   │   ├── provider.ts       # Abstract LLM interface
│   │   ├── openai.ts         # OpenAI provider
│   │   └── ollama.ts         # Ollama local provider
│   ├── security/
│   │   ├── secretScanner.ts  # Secret detection
│   │   └── vulnScanner.ts    # Vulnerability scanning
│   ├── review/
│   │   ├── diffParser.ts     # PR diff parsing
│   │   └── generator.ts      # Review generation
│   ├── feedback/
│   │   ├── collector.ts      # User feedback handling
│   │   └── db.ts             # Feedback storage
│   └── dashboard/
│       ├── server.ts         # Express dashboard
│       └── views/            # Dashboard UI
├── scripts/
│   └── evaluate.ts           # Benchmark evaluation
├── docker-compose.yml        # Full stack deployment
├── Dockerfile               # Production container
└── package.json
```

### Available Commands

```bash
# Development
npm run dev                    # Start with hot reload
npm run build                  # Compile TypeScript
npm run type-check             # Type checking only

# Services
docker-compose up -d           # Start ChromaDB + services
docker-compose down            # Stop all services

# Privacy Mode
ollama serve                   # Start local LLM server
LLM_PROVIDER=ollama npm run dev

# Utilities
npm run index -- --repo owner/repo  # Manually index repository
npm run clean-cache            # Clear repository cache
npm run feedback-report        # Show user feedback stats

# Testing & Evaluation
npm run test                   # Run test suite
npm run evaluate               # Run benchmark evaluation
npm run lint                   # ESLint checking
```

### Adding New Language Support

```typescript
// src/parsing/treeSitter.ts
private GRAMMAR_MAP: Record<string, string> = {
  ".js": "tree-sitter-javascript",
  ".ts": "tree-sitter-typescript", 
  ".py": "tree-sitter-python",
  ".go": "tree-sitter-go",
  ".rs": "tree-sitter-rust",     // Add new language
  ".rb": "tree-sitter-ruby",     // Add new language
  // ...
};
```

## 🔍 Supported Languages

| Language | Tree-sitter | Security Scanning | Embedding Support |
|----------|-------------|-------------------|------------------|
| JavaScript | ✅ | ✅ (XSS, injection) | ✅ |
| TypeScript | ✅ | ✅ (XSS, injection) | ✅ |
| Python | ✅ | ✅ (SQL injection) | ✅ |
| Go | ✅ | ✅ (secrets) | ✅ |
| Java | ✅ | ✅ (SQL injection) | ✅ |
| C/C++ | ✅ | ⚠️ (basic) | ✅ |
| Rust | ⚠️ (experimental) | ⚠️ (basic) | ✅ |

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

### Areas for Contribution

- **New Language Support**: Add Tree-sitter grammars for more languages
- **Security Patterns**: Expand vulnerability detection patterns
- **LLM Providers**: Add support for new AI providers (Anthropic, Cohere, etc.)
- **Evaluation**: Expand benchmark test cases
- **UI Improvements**: Enhance the dashboard interface

## 📊 Performance & Scaling

### Resource Requirements

| Component | Memory | CPU | Storage |
|-----------|--------|-----|---------|
| Main App | 512MB | 1 vCPU | 100MB |
| ChromaDB | 2GB | 2 vCPU | 50GB |
| Ollama (optional) | 8GB | 4 vCPU | 10GB |

### Scaling Considerations

- **Repository Cache**: Configured for 5GB max, auto-cleanup with LRU
- **Embedding Cache**: Content-hash based, saves 90% of API costs
- **Rate Limiting**: Built-in exponential backoff for API limits
- **Horizontal Scaling**: Stateless design supports multiple instances

## 🔧 Troubleshooting

### Common Issues

**Bot not responding to PRs:**
```bash
# Check webhook delivery in GitHub App settings
# Verify SMEE_URL is correctly configured
curl -X POST $SMEE_URL -d '{"test": true}'
```

**ChromaDB connection errors:**
```bash
# Restart ChromaDB container
docker-compose restart chromadb
# Check logs
docker-compose logs chromadb
```

**High OpenAI costs:**
```bash
# Enable embedding cache
echo "ENABLE_EMBEDDING_CACHE=true" >> .env
# Or switch to Ollama for free inference
echo "LLM_PROVIDER=ollama" >> .env
```

**Poor review quality:**
```bash
# Adjust confidence threshold
echo "CONFIDENCE_THRESHOLD=70" >> .env
# Check feedback metrics in dashboard
open http://localhost:3000/dashboard
```

### Debug Mode

```bash
# Enable verbose logging
DEBUG=pr-reviewer* npm run dev

# View detailed request logs
DEBUG=pr-reviewer:api* npm run dev

# Monitor embedding generation
DEBUG=pr-reviewer:embeddings* npm run dev
```

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## 🌟 Acknowledgments

- [Tree-sitter](https://tree-sitter.github.io/) for AST parsing
- [ChromaDB](https://www.trychroma.com/) for vector storage
- [Probot](https://probot.github.io/) for GitHub App framework
- [Ollama](https://ollama.ai/) for local LLM support

## 🔗 Links

- [Installation Guide](./INSTALL.md)
- [API Documentation](./docs/API.md)
- [Contributing Guidelines](./CONTRIBUTING.md)
- [Evaluation Results](./docs/EVALUATION.md)
- [Architecture Deep Dive](./docs/ARCHITECTURE.md)

---

**Built with ❤️ for the developer community**

*Star this project if it helped you catch bugs faster!* ⭐
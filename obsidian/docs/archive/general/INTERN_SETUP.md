# Intern Setup Guide - Orchestrator AI

Welcome to the Orchestrator AI project! This guide will help you get your local development environment set up quickly and cleanly.

## 🚀 Quick Setup (Clean Branch)

For the fastest and cleanest setup experience, use the `clean-migrations` branch:

```bash
# 1. Clone the repository
git clone <repository-url>
cd orchestrator-ai

# 2. Switch to the clean-migrations branch
git checkout clean-migrations

# 3. Install dependencies
cd apps/api
npm install

# 4. Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# 5. Start Supabase (requires Docker)
supabase start

# 6. Your database is ready! 🎉
```

## ✨ What's Different About This Branch?

The `clean-migrations` branch contains:
- **Single migration file** instead of 27+ incremental migrations
- **Faster setup** - database setup completes in seconds, not minutes
- **Same functionality** - all features and data structures are identical
- **Cleaner development experience** - no migration history noise

## 🗂️ Database Information

After running `supabase start`, you'll have access to:

- **API URL**: `http://127.0.0.1:7011`
- **Database URL**: `postgresql://postgres:postgres@127.0.0.1:6012/postgres`
- **Studio URL**: `http://127.0.0.1:7013` (Database management UI)
- **GraphQL URL**: `http://127.0.0.1:7011/graphql/v1`

## 📊 Database Schema Overview

Your local database includes:

### Core Tables (Public Schema)
- **users** - User management and authentication
- **llm_providers** - AI service provider configurations  
- **llm_models** - Available AI models with capabilities
- **llm_usage** - Usage tracking and analytics
- **agent_conversations** - Chat conversations and history
- **deliverables** - Generated content and documents
- **deliverable_versions** - Version control for deliverables
- **project_steps** - Multi-step project orchestration
- **redaction_patterns** - Privacy and data protection
- **pseudonym_mappings** - Data anonymization

### Company Schema
- **kpi_categories** - Business metrics organization
- **kpis** - Key performance indicators
- **kpi_data** - Historical KPI values

## 🔄 Switching Between Branches

If you need to work with the full migration history:

```bash
# Switch to main branch (full migration history)
git checkout main
cd apps/api
supabase db reset  # This will take longer but includes full history

# Switch back to clean branch
git checkout clean-migrations
supabase db reset  # Fast setup
```

## 🛠️ Development Workflow

1. **Make changes** to your code
2. **Test locally** using the Supabase Studio at `http://127.0.0.1:54323`
3. **Reset database** if needed: `supabase db reset`
4. **Create new migrations** for schema changes (ask your mentor)

## 🆘 Troubleshooting

### Supabase won't start
```bash
# Check if Docker is running
docker ps

# Stop and restart Supabase
supabase stop
supabase start
```

### Database issues
```bash
# Reset to clean state
supabase db reset

# Check status
supabase status
```

### Migration errors
- You're on the clean branch, so you should only have 1 migration file
- If you see multiple migration files, you might be on the wrong branch
- Switch to `clean-migrations` branch and try again

## 🔑 Environment Variables & API Keys

### Setting Up Your `.env` File

After copying `.env.example` to `.env`, you'll need to add your API keys. Here are the key ones:

```bash
# Supabase (already configured for local development)
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# AI Provider API Keys (add your own)
ANTHROPIC_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here
PERPLEXITY_API_KEY=your_key_here
```

### 🤖 Ollama Cloud Setup (Recommended for Students/Interns)

**Ollama Cloud** is a hosted service that lets you run AI models without needing powerful local hardware. This is perfect for students and interns who want to get started quickly!

#### Getting Your Ollama Cloud API Key

1. **Sign up for Ollama Cloud**:
   - Visit [https://ollama.com](https://ollama.com)
   - Create a free account (no credit card required for basic usage)
   - Navigate to your account settings or API keys section

2. **Get your API key**:
   - Once logged in, find your API key in your account dashboard
   - Copy the API key (it will look something like `ollama_xxxxxxxxxxxxx`)

3. **Add to your `.env` file**:
   ```bash
   # Add this to your .env file
   OLLAMA_CLOUD_API_KEY=your_ollama_cloud_api_key_here
   ```

4. **That's it!** The system will automatically detect the API key and switch to cloud mode.

#### Local vs Cloud Mode

- **Local Mode** (default): Requires installing Ollama locally and running models on your machine. Great if you have a powerful computer with lots of RAM.
- **Cloud Mode** (when `OLLAMA_CLOUD_API_KEY` is set): Uses Ollama's hosted service. No local installation needed! Perfect for:
  - Students with basic laptops
  - Interns getting started quickly
  - Anyone who doesn't want to manage local model files

**Note**: When `OLLAMA_CLOUD_API_KEY` is set, the system automatically uses cloud mode and ignores `OLLAMA_BASE_URL`. You don't need to configure both!

#### Why Use Ollama Cloud?

- ✅ **No local installation** - Works on any computer
- ✅ **Free tier available** - Great for learning and development
- ✅ **Access to large models** - Run models that wouldn't fit on your laptop
- ✅ **Easy setup** - Just add one API key to your `.env` file

## 📚 Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Ollama Cloud Documentation](https://ollama.com/docs/cloud)
- [Project Architecture Overview](./docs/technical/)
- [API Documentation](./apps/api/README.md)

## 🤝 Getting Help

- Ask your mentor for guidance
- Check the project documentation in the `docs/` folder
- Use the Supabase Studio UI for database exploration

---

**Happy coding! 🚀**

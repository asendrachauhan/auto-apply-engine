#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
#  AutoApply AI — One-command local setup
#  Run: bash setup.sh
# ─────────────────────────────────────────────────────────────────
set -e

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

echo -e "${CYAN}"
echo "  ╔═══════════════════════════════╗"
echo "  ║    AutoApply AI — Setup       ║"
echo "  ╚═══════════════════════════════╝"
echo -e "${NC}"

# Check Node version
NODE_VER=$(node -v 2>/dev/null | cut -d'v' -f2 | cut -d'.' -f1)
if [ -z "$NODE_VER" ] || [ "$NODE_VER" -lt 20 ]; then
  echo -e "${YELLOW}⚠  Node.js 20+ required. Install from https://nodejs.org${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Node.js $(node -v)${NC}"

# Backend setup
echo -e "\n${CYAN}── Backend setup ──${NC}"
cd backend
if [ ! -f .env ]; then
  cp .env.example .env
  echo -e "${YELLOW}⚠  backend/.env created from .env.example — fill in your API keys!${NC}"
fi
npm install
echo -e "${GREEN}✓ Backend dependencies installed${NC}"
cd ..

# Frontend setup
echo -e "\n${CYAN}── Frontend setup ──${NC}"
cd frontend
npm install
echo -e "${GREEN}✓ Frontend dependencies installed${NC}"
cd ..

echo -e "\n${GREEN}✅ Setup complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Edit backend/.env  → add MONGODB_URI, GROQ_API_KEY, STRIPE keys, etc."
echo "  2. Terminal 1: cd backend && npm run dev"
echo "  3. Terminal 2: cd frontend && ng serve"
echo "  4. Open: http://localhost:4200"
echo ""
echo "Or run everything with Docker:"
echo "  docker-compose up --build"
echo ""
echo "📚 Full docs: README.md"

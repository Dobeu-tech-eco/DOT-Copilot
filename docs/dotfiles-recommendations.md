# Dotfiles Recommendations — DOT-Copilot

Productivity shell and editor configurations for the DOT-Copilot monorepo.
Stack: Node.js 22 / TypeScript 5.7, React 19, Vite 6, Prisma 5, Supabase, Docker Compose, Express 4.

---

## Table of Contents

1. [zsh](#1-zsh)
2. [bash](#2-bash)
3. [fish](#3-fish)
4. [VS Code](#4-vs-code)
5. [vim / neovim](#5-vim--neovim)
6. [Ona devcontainer integration](#6-ona-devcontainer-integration)

---

## 1. zsh

Place in `~/.zshrc` (or source from a dedicated `~/.zshrc.d/dot-copilot.zsh`).

```zsh
# ── Node / NVM ────────────────────────────────────────────────────────────────
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

# Auto-switch node version when entering a directory with .nvmrc
autoload -U add-zsh-hook
load-nvmrc() {
  local nvmrc_path
  nvmrc_path="$(nvm_find_nvmrc)"
  if [ -n "$nvmrc_path" ]; then
    local nvmrc_node_version
    nvmrc_node_version=$(nvm version "$(cat "${nvmrc_path}")")
    if [ "$nvmrc_node_version" = "N/A" ]; then
      nvm install
    elif [ "$nvmrc_node_version" != "$(nvm version)" ]; then
      nvm use
    fi
  fi
}
add-zsh-hook chpwd load-nvmrc
load-nvmrc

# ── pnpm / npm ────────────────────────────────────────────────────────────────
export PNPM_HOME="$HOME/.local/share/pnpm"
export PATH="$PNPM_HOME:$PATH"

# ── Project root shortcuts ────────────────────────────────────────────────────
export DOT_ROOT="$HOME/workspaces/DOT-Copilot"
export DOT_BACKEND="$DOT_ROOT/cursor-projects/DOT-Copilot/backend"
export DOT_FRONTEND_INNER="$DOT_ROOT/cursor-projects/DOT-Copilot/frontend"

alias dot='cd $DOT_ROOT'
alias dotbe='cd $DOT_BACKEND'
alias dotfe='cd $DOT_FRONTEND_INNER'

# ── Dev servers ───────────────────────────────────────────────────────────────
alias dev='cd $DOT_ROOT && npm run dev'
alias devbe='cd $DOT_BACKEND && npm run dev'
alias devfe='cd $DOT_FRONTEND_INNER && npm run dev'

# ── Prisma ────────────────────────────────────────────────────────────────────
alias pmig='cd $DOT_BACKEND && npx prisma migrate dev'
alias ppush='cd $DOT_BACKEND && npx prisma db push'
alias pseed='cd $DOT_BACKEND && npx prisma db seed'
alias pstudio='cd $DOT_BACKEND && npx prisma studio'
alias pgen='cd $DOT_BACKEND && npx prisma generate'

# ── Supabase CLI ──────────────────────────────────────────────────────────────
alias sbstart='cd $DOT_ROOT && npx supabase start'
alias sbstop='cd $DOT_ROOT && npx supabase stop'
alias sbmig='cd $DOT_ROOT && npx supabase migration new'
alias sbpush='cd $DOT_ROOT && npx supabase db push'
alias sbstatus='cd $DOT_ROOT && npx supabase status'

# ── Docker Compose ────────────────────────────────────────────────────────────
alias dcup='cd $DOT_ROOT/cursor-projects/DOT-Copilot && docker compose -f docker-compose.dev.yml up -d'
alias dcdown='cd $DOT_ROOT/cursor-projects/DOT-Copilot && docker compose -f docker-compose.dev.yml down'
alias dclogs='cd $DOT_ROOT/cursor-projects/DOT-Copilot && docker compose -f docker-compose.dev.yml logs -f'
alias dcps='docker compose ps'

# ── Git / Conventional Commits ────────────────────────────────────────────────
alias gs='git status'
alias gd='git diff'
alias gl='git log --oneline -15'
alias gco='git checkout'
alias gcb='git checkout -b'
alias gp='git push'
alias gpl='git pull --rebase'

# Conventional commit helpers
gc-feat()  { git commit -m "feat: $*"; }
gc-fix()   { git commit -m "fix: $*"; }
gc-docs()  { git commit -m "docs: $*"; }
gc-ref()   { git commit -m "refactor: $*"; }
gc-test()  { git commit -m "test: $*"; }
gc-chore() { git commit -m "chore: $*"; }

# ── TypeScript / Linting ──────────────────────────────────────────────────────
alias tsc-check='npx tsc --noEmit'
alias lint='npm run lint'

# ── Testing ───────────────────────────────────────────────────────────────────
alias jest='cd $DOT_BACKEND && npm test'
alias vitest='cd $DOT_FRONTEND_INNER && npm test'
alias test-cov='cd $DOT_BACKEND && npm run test:coverage'
```

### Oh My Zsh plugins (recommended)

Add to `plugins=(...)` in `~/.zshrc`:

```zsh
plugins=(
  git
  node
  npm
  docker
  docker-compose
  nvm
  z           # directory jumping
  zsh-autosuggestions
  zsh-syntax-highlighting
)
```

Install community plugins:
```bash
git clone https://github.com/zsh-users/zsh-autosuggestions ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-autosuggestions
git clone https://github.com/zsh-users/zsh-syntax-highlighting ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-syntax-highlighting
```

---

## 2. bash

Place in `~/.bashrc` or source from `~/.bashrc.d/dot-copilot.sh`.

```bash
# ── Node / NVM ────────────────────────────────────────────────────────────────
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

# ── Project root shortcuts ────────────────────────────────────────────────────
export DOT_ROOT="$HOME/workspaces/DOT-Copilot"
export DOT_BACKEND="$DOT_ROOT/cursor-projects/DOT-Copilot/backend"
export DOT_FRONTEND_INNER="$DOT_ROOT/cursor-projects/DOT-Copilot/frontend"

alias dot='cd $DOT_ROOT'
alias dotbe='cd $DOT_BACKEND'
alias dotfe='cd $DOT_FRONTEND_INNER'

# ── Dev servers ───────────────────────────────────────────────────────────────
alias dev='cd $DOT_ROOT && npm run dev'
alias devbe='cd $DOT_BACKEND && npm run dev'

# ── Prisma ────────────────────────────────────────────────────────────────────
alias pmig='cd $DOT_BACKEND && npx prisma migrate dev'
alias ppush='cd $DOT_BACKEND && npx prisma db push'
alias pseed='cd $DOT_BACKEND && npx prisma db seed'
alias pstudio='cd $DOT_BACKEND && npx prisma studio'

# ── Supabase CLI ──────────────────────────────────────────────────────────────
alias sbstart='cd $DOT_ROOT && npx supabase start'
alias sbstop='cd $DOT_ROOT && npx supabase stop'
alias sbmig='cd $DOT_ROOT && npx supabase migration new'
alias sbpush='cd $DOT_ROOT && npx supabase db push'

# ── Docker Compose ────────────────────────────────────────────────────────────
alias dcup='cd $DOT_ROOT/cursor-projects/DOT-Copilot && docker compose -f docker-compose.dev.yml up -d'
alias dcdown='cd $DOT_ROOT/cursor-projects/DOT-Copilot && docker compose -f docker-compose.dev.yml down'
alias dclogs='cd $DOT_ROOT/cursor-projects/DOT-Copilot && docker compose -f docker-compose.dev.yml logs -f'

# ── Git helpers ───────────────────────────────────────────────────────────────
alias gs='git status'
alias gd='git diff'
alias gl='git log --oneline -15'

gc-feat()  { git commit -m "feat: $*"; }
gc-fix()   { git commit -m "fix: $*"; }
gc-docs()  { git commit -m "docs: $*"; }
gc-ref()   { git commit -m "refactor: $*"; }
gc-test()  { git commit -m "test: $*"; }
gc-chore() { git commit -m "chore: $*"; }

# ── Bash completion for npm scripts ──────────────────────────────────────────
if [ -f /usr/share/bash-completion/completions/npm ]; then
  . /usr/share/bash-completion/completions/npm
fi
```

---

## 3. fish

Place in `~/.config/fish/conf.d/dot-copilot.fish`.

```fish
# ── Project roots ─────────────────────────────────────────────────────────────
set -gx DOT_ROOT $HOME/workspaces/DOT-Copilot
set -gx DOT_BACKEND $DOT_ROOT/cursor-projects/DOT-Copilot/backend

# ── Navigation ────────────────────────────────────────────────────────────────
abbr --add dot  'cd $DOT_ROOT'
abbr --add dotbe 'cd $DOT_BACKEND'

# ── Dev servers ───────────────────────────────────────────────────────────────
abbr --add dev   'cd $DOT_ROOT && npm run dev'
abbr --add devbe 'cd $DOT_BACKEND && npm run dev'

# ── Prisma ────────────────────────────────────────────────────────────────────
abbr --add pmig    'npx prisma migrate dev'
abbr --add ppush   'npx prisma db push'
abbr --add pseed   'npx prisma db seed'
abbr --add pstudio 'npx prisma studio'

# ── Supabase ──────────────────────────────────────────────────────────────────
abbr --add sbstart 'npx supabase start'
abbr --add sbstop  'npx supabase stop'
abbr --add sbmig   'npx supabase migration new'

# ── Docker ────────────────────────────────────────────────────────────────────
abbr --add dcup   'docker compose -f docker-compose.dev.yml up -d'
abbr --add dcdown 'docker compose -f docker-compose.dev.yml down'
abbr --add dclogs 'docker compose -f docker-compose.dev.yml logs -f'

# ── Git ───────────────────────────────────────────────────────────────────────
abbr --add gs 'git status'
abbr --add gd 'git diff'
abbr --add gl 'git log --oneline -15'

# ── NVM (via fisher plugin or manual) ────────────────────────────────────────
# Install: fisher install jorgebucaran/nvm.fish
# Then: nvm use lts
```

---

## 4. VS Code

### Workspace settings

Place at `.vscode/settings.json` in the repo root (already gitignored — add an exception or commit it):

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "editor.tabSize": 2,
  "editor.insertSpaces": true,
  "editor.rulers": [100],
  "files.trimTrailingWhitespace": true,
  "files.insertFinalNewline": true,

  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.preferences.importModuleSpecifier": "relative",
  "typescript.inlayHints.parameterNames.enabled": "literals",
  "typescript.inlayHints.variableTypes.enabled": false,

  "eslint.workingDirectories": [
    { "directory": ".", "changeProcessCWD": true },
    { "directory": "cursor-projects/DOT-Copilot/backend", "changeProcessCWD": true },
    { "directory": "cursor-projects/DOT-Copilot/frontend", "changeProcessCWD": true }
  ],
  "eslint.validate": ["typescript", "typescriptreact"],

  "tailwindCSS.experimental.classRegex": [
    ["clsx\\(([^)]*)\\)", "(?:'|\"|`)([^']*)(?:'|\"|`)"],
    ["cn\\(([^)]*)\\)", "(?:'|\"|`)([^']*)(?:'|\"|`)"]
  ],
  "tailwindCSS.includeLanguages": {
    "typescript": "javascript",
    "typescriptreact": "javascript"
  },

  "prisma.showPrismaDataPlatformNotification": false,

  "git.enableSmartCommit": true,
  "git.confirmSync": false,
  "git.autofetch": true,

  "search.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/.git": true,
    "**/build": true,
    "**/_archive": true
  },

  "files.exclude": {
    "**/node_modules": true,
    "**/.git": false
  },

  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[typescriptreact]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[json]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[prisma]": {
    "editor.defaultFormatter": "Prisma.prisma"
  }
}
```

### Recommended extensions

Place at `.vscode/extensions.json`:

```json
{
  "recommendations": [
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "bradlc.vscode-tailwindcss",
    "Prisma.prisma",
    "ms-vscode.vscode-typescript-next",
    "christian-kohler.path-intellisense",
    "formulahendry.auto-rename-tag",
    "streetsidesoftware.code-spell-checker",
    "eamodio.gitlens",
    "mhutchie.git-graph",
    "vivaxy.vscode-conventional-commits",
    "ms-azuretools.vscode-docker",
    "humao.rest-client",
    "rangav.vscode-thunder-client",
    "ms-vscode-remote.remote-containers",
    "GitHub.copilot"
  ]
}
```

### Prettier config

Place at `.prettierrc` in the repo root:

```json
{
  "semi": false,
  "singleQuote": true,
  "trailingComma": "es5",
  "printWidth": 100,
  "tabWidth": 2,
  "bracketSpacing": true,
  "arrowParens": "avoid"
}
```

> **Note:** The project currently has no Prettier config. These settings match the existing code style (2-space indent, single quotes observed in most files). Verify with the team before committing.

---

## 5. vim / neovim

### vim — `~/.vimrc` additions

```vim
" ── General ──────────────────────────────────────────────────────────────────
set number relativenumber
set expandtab tabstop=2 shiftwidth=2 softtabstop=2
set autoindent smartindent
set nowrap
set colorcolumn=100
set signcolumn=yes
set updatetime=300
set hidden                  " allow unsaved buffers in background
set clipboard=unnamedplus   " system clipboard

" ── File type detection ───────────────────────────────────────────────────────
autocmd BufNewFile,BufRead *.tsx,*.ts set filetype=typescript
autocmd BufNewFile,BufRead *.prisma   set filetype=prisma

" ── Trailing whitespace ───────────────────────────────────────────────────────
highlight TrailingWhitespace ctermbg=red guibg=red
match TrailingWhitespace /\s\+$/
autocmd BufWritePre * :%s/\s\+$//e

" ── Plugin manager (vim-plug) ─────────────────────────────────────────────────
" Install: curl -fLo ~/.vim/autoload/plug.vim --create-dirs \
"   https://raw.githubusercontent.com/junegunn/vim-plug/master/plug.vim
call plug#begin('~/.vim/plugged')
  Plug 'neoclide/coc.nvim', {'branch': 'release'}   " LSP / autocomplete
  Plug 'leafgarland/typescript-vim'                  " TypeScript syntax
  Plug 'peitalin/vim-jsx-typescript'                 " TSX syntax
  Plug 'tpope/vim-fugitive'                          " Git integration
  Plug 'tpope/vim-commentary'                        " gc to comment
  Plug 'airblade/vim-gitgutter'                      " Git diff in gutter
  Plug 'junegunn/fzf', { 'do': { -> fzf#install() } }
  Plug 'junegunn/fzf.vim'                            " Fuzzy file finder
  Plug 'preservim/nerdtree'                          " File tree
  Plug 'vim-airline/vim-airline'                     " Status line
call plug#end()

" ── coc.nvim extensions ───────────────────────────────────────────────────────
" Run: :CocInstall coc-tsserver coc-eslint coc-prettier coc-json coc-css

" ── Key mappings ──────────────────────────────────────────────────────────────
let mapleader = " "
nnoremap <leader>ff :Files<CR>
nnoremap <leader>fg :Rg<CR>
nnoremap <leader>fb :Buffers<CR>
nnoremap <leader>e  :NERDTreeToggle<CR>
nnoremap <leader>gs :Git status<CR>
nnoremap <leader>gd :Git diff<CR>
```

### neovim — `~/.config/nvim/init.lua` additions

```lua
-- ── Options ───────────────────────────────────────────────────────────────────
vim.opt.number         = true
vim.opt.relativenumber = true
vim.opt.expandtab      = true
vim.opt.tabstop        = 2
vim.opt.shiftwidth     = 2
vim.opt.softtabstop    = 2
vim.opt.colorcolumn    = "100"
vim.opt.signcolumn     = "yes"
vim.opt.updatetime     = 300
vim.opt.hidden         = true
vim.opt.clipboard      = "unnamedplus"
vim.opt.termguicolors  = true

-- ── Plugin manager (lazy.nvim) ────────────────────────────────────────────────
-- Install: https://github.com/folke/lazy.nvim
local lazypath = vim.fn.stdpath("data") .. "/lazy/lazy.nvim"
if not vim.loop.fs_stat(lazypath) then
  vim.fn.system({ "git", "clone", "--filter=blob:none",
    "https://github.com/folke/lazy.nvim.git", lazypath })
end
vim.opt.rtp:prepend(lazypath)

require("lazy").setup({
  -- LSP
  { "neovim/nvim-lspconfig" },
  { "williamboman/mason.nvim", config = true },
  { "williamboman/mason-lspconfig.nvim" },
  -- Autocomplete
  { "hrsh7th/nvim-cmp" },
  { "hrsh7th/cmp-nvim-lsp" },
  { "L3MON4D3/LuaSnip" },
  -- TypeScript / TSX
  { "jose-elias-alvarez/typescript.nvim" },
  -- Prisma syntax
  { "pantharshit00/vim-prisma" },
  -- Formatting / linting
  { "jose-elias-alvarez/null-ls.nvim" },
  -- Fuzzy finder
  { "nvim-telescope/telescope.nvim", dependencies = { "nvim-lua/plenary.nvim" } },
  -- File tree
  { "nvim-tree/nvim-tree.lua" },
  -- Git
  { "tpope/vim-fugitive" },
  { "lewis6991/gitsigns.nvim", config = true },
  -- Status line
  { "nvim-lualine/lualine.nvim" },
  -- Treesitter
  { "nvim-treesitter/nvim-treesitter", build = ":TSUpdate",
    config = function()
      require("nvim-treesitter.configs").setup({
        ensure_installed = { "typescript", "tsx", "javascript", "json", "css", "html", "lua" },
        highlight = { enable = true },
      })
    end
  },
})

-- ── LSP: tsserver ─────────────────────────────────────────────────────────────
require("mason").setup()
require("mason-lspconfig").setup({ ensure_installed = { "ts_ls", "eslint", "prismals" } })
require("lspconfig").ts_ls.setup({})
require("lspconfig").eslint.setup({})
require("lspconfig").prismals.setup({})

-- ── Key mappings ──────────────────────────────────────────────────────────────
vim.g.mapleader = " "
local map = vim.keymap.set
map("n", "<leader>ff", "<cmd>Telescope find_files<cr>")
map("n", "<leader>fg", "<cmd>Telescope live_grep<cr>")
map("n", "<leader>fb", "<cmd>Telescope buffers<cr>")
map("n", "<leader>e",  "<cmd>NvimTreeToggle<cr>")
map("n", "<leader>gs", "<cmd>Git status<cr>")
map("n", "<leader>gd", "<cmd>Git diff<cr>")
```

---

## 6. Ona devcontainer integration

To bake shell configs and tools into the dev environment so every team member gets them automatically, update `.devcontainer/Dockerfile`:

```dockerfile
FROM mcr.microsoft.com/devcontainers/base:ubuntu-24.04

# ── System tools ──────────────────────────────────────────────────────────────
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install --no-install-recommends \
       zsh \
       fish \
       vim \
       neovim \
       fzf \
       ripgrep \
       jq \
       curl \
       git \
    && rm -rf /var/lib/apt/lists/*

# ── Oh My Zsh ─────────────────────────────────────────────────────────────────
RUN sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" "" --unattended

# ── zsh plugins ───────────────────────────────────────────────────────────────
RUN git clone https://github.com/zsh-users/zsh-autosuggestions \
      ${ZSH_CUSTOM:-/root/.oh-my-zsh/custom}/plugins/zsh-autosuggestions \
 && git clone https://github.com/zsh-users/zsh-syntax-highlighting \
      ${ZSH_CUSTOM:-/root/.oh-my-zsh/custom}/plugins/zsh-syntax-highlighting

# ── NVM ───────────────────────────────────────────────────────────────────────
ENV NVM_DIR=/root/.nvm
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash \
 && . "$NVM_DIR/nvm.sh" && nvm install --lts && nvm use --lts

# ── Supabase CLI ──────────────────────────────────────────────────────────────
RUN curl -fsSL https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64.tar.gz \
    | tar -xz -C /usr/local/bin

# ── Copy project dotfiles ─────────────────────────────────────────────────────
# Uncomment after placing the snippets above into .devcontainer/dotfiles/
# COPY dotfiles/.zshrc.d/dot-copilot.zsh /root/.zshrc.d/dot-copilot.zsh
# COPY dotfiles/.vimrc /root/.vimrc

# ── Default shell ─────────────────────────────────────────────────────────────
RUN chsh -s /usr/bin/zsh root
```

### devcontainer.json additions

```json
{
  "name": "Ona",
  "build": {
    "context": ".",
    "dockerfile": "Dockerfile"
  },
  "customizations": {
    "vscode": {
      "extensions": [
        "esbenp.prettier-vscode",
        "dbaeumer.vscode-eslint",
        "bradlc.vscode-tailwindcss",
        "Prisma.prisma",
        "eamodio.gitlens",
        "vivaxy.vscode-conventional-commits",
        "ms-azuretools.vscode-docker"
      ],
      "settings": {
        "terminal.integrated.defaultProfile.linux": "zsh",
        "editor.formatOnSave": true,
        "editor.defaultFormatter": "esbenp.prettier-vscode",
        "typescript.tsdk": "node_modules/typescript/lib"
      }
    }
  },
  "postCreateCommand": "cd /workspaces/DOT-Copilot && npm install && cd cursor-projects/DOT-Copilot/backend && npm install && cd ../frontend && npm install"
}
```

> **Portability note:** All shell aliases use `$DOT_ROOT` / `$DOT_BACKEND` env vars so they work regardless of where the workspace is cloned. The devcontainer `postCreateCommand` installs all three dependency trees automatically on first launch.

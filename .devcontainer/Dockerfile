FROM mcr.microsoft.com/devcontainers/base:ubuntu-24.04

# ── System packages ───────────────────────────────────────────────────────────
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install --no-install-recommends \
       zsh \
       vim \
       curl \
       git \
       jq \
       fzf \
       ripgrep \
       unzip \
       ca-certificates \
       gnupg \
    && rm -rf /var/lib/apt/lists/*

# ── Node.js 22 LTS (via NodeSource — pinned major for reproducibility) ────────
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# ── NVM (for runtime version switching in interactive shells) ─────────────────
# Node.js is already available system-wide via NodeSource above.
# NVM is installed for developers who need to switch versions interactively.
ENV NVM_DIR=/root/.nvm
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

# Ensure NVM is sourced in both bash and zsh non-interactive shells
RUN echo 'export NVM_DIR="/root/.nvm"' >> /root/.bashrc \
    && echo '[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"' >> /root/.bashrc

# ── Oh My Zsh ─────────────────────────────────────────────────────────────────
RUN sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" "" --unattended

# ── zsh plugins ───────────────────────────────────────────────────────────────
RUN git clone --depth=1 https://github.com/zsh-users/zsh-autosuggestions \
      /root/.oh-my-zsh/custom/plugins/zsh-autosuggestions \
 && git clone --depth=1 https://github.com/zsh-users/zsh-syntax-highlighting \
      /root/.oh-my-zsh/custom/plugins/zsh-syntax-highlighting

# Enable plugins and NVM in .zshrc
RUN sed -i 's/plugins=(git)/plugins=(git node npm docker docker-compose zsh-autosuggestions zsh-syntax-highlighting)/' /root/.zshrc \
    && echo 'export NVM_DIR="/root/.nvm"' >> /root/.zshrc \
    && echo '[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"' >> /root/.zshrc

# ── Supabase CLI (pinned version) ─────────────────────────────────────────────
ARG SUPABASE_CLI_VERSION=2.23.4
RUN curl -fsSL "https://github.com/supabase/cli/releases/download/v${SUPABASE_CLI_VERSION}/supabase_linux_amd64.tar.gz" \
       | tar -xz -C /usr/local/bin \
    && chmod +x /usr/local/bin/supabase

# ── Default shell ─────────────────────────────────────────────────────────────
RUN chsh -s /usr/bin/zsh root

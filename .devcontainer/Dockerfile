FROM mcr.microsoft.com/devcontainers/base:ubuntu-24.04

# ── System packages ───────────────────────────────────────────────────────────
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install --no-install-recommends \
       zsh \
       vim \
       curl \
       wget \
       git \
       jq \
       fzf \
       ripgrep \
       unzip \
       ca-certificates \
       gnupg \
    && rm -rf /var/lib/apt/lists/*

# ── Node.js LTS (via NodeSource) ──────────────────────────────────────────────
RUN curl -fsSL https://deb.nodesource.com/setup_lts.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# ── NVM (for runtime version switching) ───────────────────────────────────────
ENV NVM_DIR=/root/.nvm
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash \
    && . "$NVM_DIR/nvm.sh" \
    && nvm install --lts \
    && nvm alias default lts/*

# ── Oh My Zsh ─────────────────────────────────────────────────────────────────
RUN sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" "" --unattended

# ── zsh plugins ───────────────────────────────────────────────────────────────
RUN git clone https://github.com/zsh-users/zsh-autosuggestions \
      ${ZSH_CUSTOM:-/root/.oh-my-zsh/custom}/plugins/zsh-autosuggestions \
 && git clone https://github.com/zsh-users/zsh-syntax-highlighting \
      ${ZSH_CUSTOM:-/root/.oh-my-zsh/custom}/plugins/zsh-syntax-highlighting

# Enable plugins in .zshrc
RUN sed -i 's/plugins=(git)/plugins=(git node npm docker docker-compose zsh-autosuggestions zsh-syntax-highlighting)/' /root/.zshrc

# ── Supabase CLI ──────────────────────────────────────────────────────────────
RUN curl -fsSL "https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64.tar.gz" \
       | tar -xz -C /usr/local/bin \
    && chmod +x /usr/local/bin/supabase

# ── Default shell ─────────────────────────────────────────────────────────────
RUN chsh -s /usr/bin/zsh root

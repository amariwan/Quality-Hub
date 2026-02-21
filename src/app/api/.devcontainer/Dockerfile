FROM debian:bookworm-slim

ARG USER=developer
ARG DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    sudo git zsh curl wget ca-certificates postgresql-client \
  && rm -rf /var/lib/apt/lists/*

RUN useradd -m -s /usr/bin/zsh ${USER} \
  && echo "${USER} ALL=(ALL) NOPASSWD: ALL" >/etc/sudoers.d/${USER} \
  && chmod 0440 /etc/sudoers.d/${USER}

USER ${USER}
ENV HOME=/home/${USER}
ENV ZSH=${HOME}/.oh-my-zsh
ENV ZSH_CUSTOM=${ZSH}/custom
ENV PATH="${HOME}/.local/bin:${PATH}"

WORKDIR ${HOME}

ARG SPACESHIP_REMOTE=https://github.com/spaceship-prompt/spaceship-prompt.git

RUN set -eux; \
  export RUNZSH=no CHSH=no; \
  sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" || true; \
  mkdir -p ${ZSH_CUSTOM}; \
  git clone https://github.com/zsh-users/zsh-autosuggestions ${ZSH_CUSTOM}/plugins/zsh-autosuggestions || true; \
  git clone https://github.com/zsh-users/zsh-syntax-highlighting.git ${ZSH_CUSTOM}/plugins/zsh-syntax-highlighting || true; \
  touch ${HOME}/.zshrc; \
  sed -i.bak 's/plugins=(\(.*\))/plugins=(\1 zsh-autosuggestions zsh-syntax-highlighting)/' ${HOME}/.zshrc || true; \
  git clone ${SPACESHIP_REMOTE} ${ZSH_CUSTOM}/themes/spaceship-prompt --depth=1 || true; \
  ln -sf ${ZSH_CUSTOM}/themes/spaceship-prompt/spaceship.zsh-theme ${ZSH_CUSTOM}/themes/spaceship.zsh-theme || true; \
  sed -i 's|ZSH_THEME="robbyrussell"|ZSH_THEME="spaceship"|g' ${HOME}/.zshrc || true; \
  curl -LsSf https://astral.sh/uv/install.sh | sh; \
  echo 'eval "$(uv generate-shell-completion zsh)"' >> ${HOME}/.zshrc; \
  echo 'eval "$(uvx --generate-shell-completion zsh)"' >> ${HOME}/.zshrc

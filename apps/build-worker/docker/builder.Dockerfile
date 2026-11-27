FROM node:22-alpine

RUN apk add --no-cache git

# Serve yarn and pnpm through Corepack so the version pinned in a repo's "packageManager" field is used.
# The image's bundled yarn v1 shims are removed first because they collide with Corepack's.
RUN rm -f /usr/local/bin/yarn /usr/local/bin/yarnpkg && corepack enable

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0

RUN addgroup -S builder && adduser -S builder -G builder

RUN mkdir -p /workspace && chown -R builder:builder /workspace

WORKDIR /workspace

USER builder

CMD ["/bin/sh"]

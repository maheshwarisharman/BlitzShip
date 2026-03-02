FROM node:22-alpine

RUN apk add --no-cache git


RUN addgroup -S builder && adduser -S builder -G builder

RUN mkdir -p /workspace && chown -R builder:builder /workspace

WORKDIR /workspace

USER builder

CMD ["/bin/sh"]

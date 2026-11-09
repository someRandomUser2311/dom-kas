# Build context: the repository root (the image bundles course-content/).
FROM rust:1-slim-bookworm AS build
WORKDIR /src
# Cache dependencies separately from the sources.
COPY backend/Cargo.toml backend/Cargo.lock ./
RUN mkdir src && echo 'fn main() {}' > src/main.rs && cargo build --release --locked && rm -rf src
COPY backend/src ./src
RUN touch src/main.rs && cargo build --release --locked

FROM debian:bookworm-slim
RUN useradd --system --uid 10001 --home /app kq && mkdir -p /data /app && chown kq /data
COPY --from=build /src/target/release/kq-server /usr/local/bin/kq-server
COPY course-content /app/course-content
COPY backend/labs /app/labs
ENV CONTENT_DIR=/app/course-content \
    LABS_DIR=/app/labs \
    DB_PATH=/data/kq.db \
    BIND=0.0.0.0:8080
USER kq
VOLUME /data
EXPOSE 8080
CMD ["kq-server"]

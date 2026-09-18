# Music Pipeline Stack

Navidrome + MeTube + Music Tag Web + a tiny publisher UI for a staged music workflow.

## Flow

```text
MeTube downloads -> postprocess-worker clears metadata -> staging
Music Tag Web edits staging metadata
publisher-ui approves selected ready files -> library
Navidrome scans library only
```

## Directories

```text
MEDIA_ROOT/
  downloads-raw/
  staging/
  library/
  failed/

CONFIG_ROOT/
  navidrome/
  metube/
  music-tag-web/
```

## Services

- `navidrome`: reads `library` only.
- `metube`: writes to `downloads-raw`.
- `music-tag-web`: edits files in `staging`.
- `postprocess-worker`: remuxes audio with `ffmpeg -map_metadata -1` and moves cleaned files to `staging`.
- `publisher-ui`: lists `staging` files and moves selected tagged files into `library`.

Music Tag Web mounts `staging` at both `/app/media` and `/media`.
The app defaults to `/app/media`, but some browser state can point at `/media`; both paths are kept valid.

## GitHub Container Registry

The included GitHub Action builds this repository into:

```text
ghcr.io/<owner>/<repo>:latest
ghcr.io/<owner>/<repo>:<commit-sha>
```

The compose file uses the repository image directly:

```text
ghcr.io/heymrkang/music-pipeline-stack:latest
```

## Coolify

Use this repository as a Docker Compose resource, or paste `docker-compose.yml` into a Coolify compose resource.

No required environment variables are needed for the default dev-server deployment.

The compose file uses fixed host bind paths for the dev server external HDD:

```text
/mnt/storage/music-pipeline/media
/mnt/storage/music-pipeline/config
```

These paths are intentionally hardcoded in `docker-compose.yml`.
Coolify rejects `${...}` variable substitution inside Docker bind-mount sources for security reasons, so paths such as `${MEDIA_ROOT}/staging` fail during deployment parsing.

If you deploy this stack on another server, edit every `/mnt/storage/music-pipeline/...` bind source in `docker-compose.yml` before deploying. Do not try to move those paths into Coolify environment variables unless Coolify changes that parser behavior.

The dev-server deployment exposes these domains through Coolify Traefik labels in `docker-compose.yml`:

- Navidrome: `https://music.12190529.xyz` -> internal port `4533`
- MeTube: `https://metube.12190529.xyz` -> internal port `8081`
- Music Tag Web: `https://tag.12190529.xyz` -> internal port `8001`
- Publisher UI: `https://publish.12190529.xyz` -> internal port `8080`

Those labels are hardcoded for the dev server. If you deploy elsewhere, change the domain labels and keep each public service attached to the external `coolify` Docker network.

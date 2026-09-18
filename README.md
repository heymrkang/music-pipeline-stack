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

## GitHub Container Registry

The included GitHub Action builds this repository into:

```text
ghcr.io/<owner>/<repo>:latest
ghcr.io/<owner>/<repo>:<commit-sha>
```

Set `TOOLS_IMAGE` in Coolify to that image.

## Coolify

Use this repository as a Docker Compose resource, or paste `docker-compose.yml` into a Coolify compose resource.

Required environment:

```text
TOOLS_IMAGE=ghcr.io/<owner>/<repo>:latest
MEDIA_ROOT=/srv/music-pipeline/media
CONFIG_ROOT=/srv/music-pipeline/config
TZ=Asia/Seoul
```

Expose these internal ports with Coolify/Traefik or Cloudflare Tunnel:

- Navidrome: `4533`
- MeTube: `8081`
- Music Tag Web: `8001`
- Publisher UI: `8080`

Put MeTube, Music Tag Web, and Publisher UI behind Cloudflare Access.

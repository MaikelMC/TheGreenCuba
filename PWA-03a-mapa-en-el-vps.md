# PWA, fase 3a: el mapa de Cuba en el VPS

Estos pasos los haces tú en el VPS, por SSH. Al terminar tendrás las teselas vectoriales de toda Cuba servidas desde `https://prueba-laverde.kynari.dev/tiles/`, con el mismo formato que el demo.

Usa la cuenta `kynari` con `sudo` cuando haga falta.

## 1. Generar el mapa de Cuba

Usamos **Planetiler**, que convierte los datos de OpenStreetMap de Cuba en un archivo PMTiles con el mismo formato (OpenMapTiles) que el estilo que elegiste en el demo.

```
sudo mkdir -p /srv/mapa
sudo chown kynari:kynari /srv/mapa
cd /srv/mapa

docker run --rm -e JAVA_TOOL_OPTIONS="-Xmx3g" -v /srv/mapa:/data \
  ghcr.io/onthegomap/planetiler:latest \
  --download --area=cuba --output=/data/cuba.pmtiles
```

- **La primera vez descarga** los datos de Cuba y algunos archivos de base (costas, océanos). En total, alrededor de 1 GB, y tarda entre 10 y 30 minutos.
- **Al terminar** tendrás `/srv/mapa/cuba.pmtiles`. Míralo con `ls -lh /srv/mapa`: debería pesar del orden de cientos de MB.
- **Si falla por memoria,** baja `-Xmx3g` a `-Xmx2g`.

## 2. Servir las teselas

**go-pmtiles** lee el archivo y sirve cada tesela con una dirección normal, `/tiles/cuba/{z}/{x}/{y}.mvt`:

```
docker run -d --name laverde-tiles --restart unless-stopped \
  -p 127.0.0.1:8081:8080 \
  -v /srv/mapa:/data \
  protomaps/go-pmtiles serve /data \
  --public-url=https://prueba-laverde.kynari.dev/tiles
```

Compruébalo desde el propio VPS:

```
curl -s http://127.0.0.1:8081/cuba.json | head -c 400
```

Debe responder un JSON con `"tiles"`, `"minzoom"` y `"maxzoom"`.

## 3. Abrir `/tiles/` en Nginx

Edita el archivo de La Verde:

```
sudo nano /etc/nginx/sites-available/laverde
```

Sustituye el bloque comentado `# location /tiles/ { ... }` que dejamos preparado por este, **antes** de `location / {`:

```nginx
    # Teselas del mapa de Cuba (go-pmtiles en el puerto 8081)
    location /tiles/ {
        proxy_pass http://127.0.0.1:8081/;
        proxy_cache laverde_cache;
        proxy_cache_valid 200 30d;
        proxy_cache_valid 404 1m;
        proxy_hide_header Cache-Control;
        add_header Cache-Control "public, max-age=2592000" always;
        add_header X-Cache $upstream_cache_status always;
    }
```

Aplica los cambios:

```
sudo nginx -t && sudo systemctl reload nginx
```

## 4. Comprobar

```
curl -s https://prueba-laverde.kynari.dev/tiles/cuba.json | head -c 400
curl -sI https://prueba-laverde.kynari.dev/tiles/cuba/14/4880/7230.mvt | grep -i "http/\|content-type\|x-cache"
```

- **El primero** devuelve el JSON del mapa.
- **El segundo** da `200` y `X-Cache: MISS` la primera vez, y `HIT` si lo repites.

Si la tesela de ejemplo da 204 o 404, prueba otra cercana. Lo importante es que el JSON responda.

## 5. Actualizar el mapa cada mes

OpenStreetMap cambia con el tiempo. Para regenerar el mapa una vez al mes, crea `/srv/mapa/actualizar.sh`:

```
#!/bin/sh
set -e
cd /srv/mapa
docker run --rm -e JAVA_TOOL_OPTIONS="-Xmx3g" -v /srv/mapa:/data \
  ghcr.io/onthegomap/planetiler:latest \
  --download --area=cuba --output=/data/cuba-nuevo.pmtiles --force
mv /srv/mapa/cuba-nuevo.pmtiles /srv/mapa/cuba.pmtiles
docker restart laverde-tiles
rm -rf /var/cache/nginx/laverde/*
```

Y prográmalo:

```
chmod +x /srv/mapa/actualizar.sh
crontab -e
```

Añade esta línea (el día 1 de cada mes a las 4:00):

```
0 4 1 * * /srv/mapa/actualizar.sh >> /srv/mapa/actualizar.log 2>&1
```

Si al usar `crontab` de tu usuario no puede borrar la caché de Nginx, usa `sudo crontab -e`.

## Cuando termines

Pásale a Claude Code el archivo `PWA-03b-maplibre-en-la-app.md`, junto con lo que respondió `curl -s https://prueba-laverde.kynari.dev/tiles/cuba.json` (los zooms mínimo y máximo y la lista de capas).

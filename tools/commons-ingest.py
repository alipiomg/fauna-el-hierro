# -*- coding: utf-8 -*-
"""Ingesta de fotografia desde Wikimedia Commons con filtro de licencia
   y captura de atribucion. Equivale a `wp hierro ingest` de la seccion 6.1
   del spec, ejecutado en local y volcado a data URI."""
import json, re, io, sys, time, base64, urllib.parse, urllib.request
from PIL import Image

UA = "FaunaElHierroGuide/1.0 (https://asasa.es/hierro/; alipiomg@gmail.com)"
API = "https://commons.wikimedia.org/w/api.php"

# Seccion 5.4 del spec: la web es actividad comercial -> NonCommercial NO es utilizable.
OK_LIC = ("cc0", "publicdomain", "pd-", "cc-by-1.0", "cc-by-2.0", "cc-by-2.5",
          "cc-by-3.0", "cc-by-4.0", "cc-by-sa-1.0", "cc-by-sa-2.0", "cc-by-sa-2.5",
          "cc-by-sa-3.0", "cc-by-sa-4.0", "cc-sa-1.0")
BAD_LIC = ("-nc", "-nd", "noncommercial", "nonderiv", "fair use", "nonfree")

def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    return urllib.request.urlopen(req, timeout=40).read()

def strip(html):
    return re.sub(r"<[^>]*>", "", html or "").strip()

def license_ok(meta):
    lic = (meta.get("License", {}).get("value") or "").lower()
    short = (meta.get("LicenseShortName", {}).get("value") or "").lower()
    blob = lic + " " + short
    if any(b in blob for b in BAD_LIC):
        return False
    return any(g in blob for g in OK_LIC)

def search(term, width=460, limit=12):
    q = {"action": "query", "generator": "search",
         "gsrsearch": '"%s"' % term, "gsrnamespace": "6", "gsrlimit": str(limit),
         "prop": "imageinfo", "iiprop": "url|extmetadata|mime",
         "iiurlwidth": str(width), "format": "json"}
    data = json.loads(get(API + "?" + urllib.parse.urlencode(q)))
    pages = (data.get("query", {}) or {}).get("pages", {}) or {}
    want = term.lower()
    out = []
    for p in pages.values():
        ii = (p.get("imageinfo") or [{}])[0]
        meta = ii.get("extmetadata", {}) or {}
        if not ii.get("thumburl"):
            continue
        if (ii.get("mime") or "") not in ("image/jpeg", "image/png", "image/webp"):
            continue
        if not license_ok(meta):
            continue
        # Coincidencia exacta con el nombre cientifico: nunca una especie por otra.
        blob = " ".join([p.get("title", ""),
                         strip(meta.get("ImageDescription", {}).get("value", "")),
                         strip(meta.get("Categories", {}).get("value", "")),
                         strip(meta.get("ObjectName", {}).get("value", ""))]).lower()
        if want not in blob:
            continue
        score = 0
        if want in p.get("title", "").lower(): score += 10
        if want in blob: score += 5
        if "canar" in blob or "hierro" in blob or "macaron" in blob: score += 4
        out.append({
            "score": score,
            "thumb": ii["thumburl"],
            "page": ii.get("descriptionurl", ""),
            "author": strip(meta.get("Artist", {}).get("value", "")) or "Autor no indicado",
            "license": strip(meta.get("LicenseShortName", {}).get("value", "")) or "Ver Commons",
            "licurl": (meta.get("LicenseUrl", {}).get("value") or ""),
        })
    out.sort(key=lambda x: -x["score"])
    return out

def to_webp(raw, width=400, quality=70):
    im = Image.open(io.BytesIO(raw))
    if im.mode in ("RGBA", "LA", "P"):
        bg = Image.new("RGB", im.size, (10, 32, 41))
        im = im.convert("RGBA")
        bg.paste(im, mask=im.split()[-1])
        im = bg
    else:
        im = im.convert("RGB")
    w, h = im.size
    if w > width:
        im = im.resize((width, max(1, round(h * width / w))), Image.LANCZOS)
    # Recorte a 4:3 centrado: sirve tanto a la tarjeta 16:10 como al cuadrado
    tw, th = im.size
    target = tw * 3 // 4
    if th > target:
        top = (th - target) // 3
        im = im.crop((0, top, tw, top + target))
    buf = io.BytesIO()
    im.save(buf, "WEBP", quality=quality, method=5)
    return buf.getvalue()

def main():
    targets = json.load(open(sys.argv[1], encoding="utf-8"))
    out, miss, total = {}, [], 0
    for n, t in enumerate(targets, 1):
        key, term = t["key"], t["term"]
        try:
            hits = search(term, width=max(460, t.get("w", 400)))
        except Exception as e:
            print("  ERR api %s: %s" % (term, e), flush=True); hits = []
        got = False
        for h in hits[:3]:
            try:
                data = to_webp(get(h["thumb"]), t.get("w", 400))
            except Exception:
                continue
            out[key] = {"d": "data:image/webp;base64," + base64.b64encode(data).decode(),
                        "a": h["author"][:90], "l": h["license"], "u": h["page"], "lu": h["licurl"]}
            total += len(data); got = True
            print("  [%3d/%d] %-34s %5d KB  %s" % (n, len(targets), term[:34], len(data) // 1024, h["license"]), flush=True)
            break
        if not got:
            miss.append(term)
            print("  [%3d/%d] %-34s  SIN FOTO CON LICENCIA VALIDA" % (n, len(targets), term[:34]), flush=True)
        time.sleep(0.35)
    json.dump(out, open(sys.argv[2], "w", encoding="utf-8"))
    print("\nRESUMEN: %d con foto / %d total | %.1f MB webp | ~%.1f MB en base64"
          % (len(out), len(targets), total / 1048576.0, total * 4 / 3 / 1048576.0), flush=True)
    print("SIN FOTO (%d): %s" % (len(miss), ", ".join(miss)), flush=True)

main()

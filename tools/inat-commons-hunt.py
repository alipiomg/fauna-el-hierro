# -*- coding: utf-8 -*-
"""Busca fotografia con licencia comercial para las especies pendientes,
   probando todas las variantes nomenclaturales en iNaturalist y Commons."""
import json, re, io, os, time, urllib.request, urllib.parse
from PIL import Image

UA = {"User-Agent": "FaunaElHierroGuide/1.0 (https://asasa.es/hierro/; alipiomg@gmail.com)"}
OK_INAT = ("cc0", "cc-by", "cc-by-sa")
OK_COM  = ("cc0","publicdomain","pd-","cc-by-1.0","cc-by-2.0","cc-by-2.5","cc-by-3.0","cc-by-4.0",
           "cc-by-sa-1.0","cc-by-sa-2.0","cc-by-sa-2.5","cc-by-sa-3.0","cc-by-sa-4.0")
BAD = ("-nc", "-nd", "noncommercial", "nonderiv")

def fetch(u, raw=False):
    try:
        d = urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=40).read()
        return d if raw else json.loads(d)
    except Exception:
        return None

def strip(h): return re.sub(r"<[^>]*>", "", h or "").strip()

def inat(name):
    out = []
    t = fetch("https://api.inaturalist.org/v1/taxa?q=%s&per_page=5" % urllib.parse.quote(name))
    if not t: return out
    for rec in t.get("results", []):
        if (rec.get("name") or "").lower() != name.lower(): continue
        tid = rec["id"]
        # 1) foto por defecto del taxon
        dp = rec.get("default_photo") or {}
        if dp.get("license_code") in OK_INAT and dp.get("url"):
            out.append({"src": "iNaturalist (taxón)", "img": dp["url"].replace("square", "large"),
                        "a": strip(dp.get("attribution", "")), "l": (dp.get("license_code") or "").upper(),
                        "u": "https://www.inaturalist.org/taxa/%d" % tid, "name": name})
        # 2) observaciones de calidad de investigacion
        o = fetch("https://api.inaturalist.org/v1/observations?taxon_id=%d&quality_grade=research"
                  "&photo_license=cc0%%2Ccc-by%%2Ccc-by-sa&per_page=8&order_by=votes" % tid)
        for ob in (o or {}).get("results", []):
            for ph in ob.get("photos", [])[:1]:
                if (ph.get("license_code") or "") not in OK_INAT: continue
                out.append({"src": "iNaturalist (obs.)", "img": ph["url"].replace("square", "large"),
                            "a": strip(ph.get("attribution", "")), "l": (ph.get("license_code") or "").upper(),
                            "u": "https://www.inaturalist.org/observations/%d" % ob["id"],
                            "name": name, "place": (ob.get("place_guess") or "")[:40]})
        time.sleep(0.4)
    return out

def commons(name, relaxed=False):
    out = []
    q = {"action":"query","generator":"search","gsrsearch":'"%s"' % name,"gsrnamespace":"6",
         "gsrlimit":"14","prop":"imageinfo","iiprop":"url|extmetadata|mime","iiurlwidth":"600","format":"json"}
    d = fetch("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(q))
    for p in ((d or {}).get("query", {}) or {}).get("pages", {}).values():
        ii = (p.get("imageinfo") or [{}])[0]; meta = ii.get("extmetadata", {}) or {}
        if not ii.get("thumburl") or ii.get("mime") not in ("image/jpeg","image/png","image/webp"): continue
        lic = ((meta.get("License",{}).get("value") or "") + " " +
               (meta.get("LicenseShortName",{}).get("value") or "")).lower()
        if any(b in lic for b in BAD) or not any(g in lic for g in OK_COM): continue
        blob = " ".join([p.get("title",""), strip(meta.get("ImageDescription",{}).get("value","")),
                         strip(meta.get("Categories",{}).get("value",""))]).lower()
        if not relaxed and name.lower() not in blob: continue
        out.append({"src":"Commons","img":ii["thumburl"],
                    "a":strip(meta.get("Artist",{}).get("value","")) or "Autor no indicado",
                    "l":strip(meta.get("LicenseShortName",{}).get("value","")) or "?",
                    "u":ii.get("descriptionurl",""),"name":name,
                    "title":p.get("title","")[5:60]})
    time.sleep(0.3)
    return out

TARGETS = json.load(open("pending.json", encoding="utf-8"))
os.makedirs("cand", exist_ok=True)
report = {}
for t in TARGETS:
    key, cands = t["key"], []
    for nm in t["names"]:
        cands += inat(nm)
        cands += commons(nm)
    seen, uniq = set(), []
    for c in cands:
        if c["img"] in seen: continue
        seen.add(c["img"]); uniq.append(c)
    print("\n== %s (%s)" % (t["label"], key))
    keep = []
    for i, c in enumerate(uniq[:4]):
        raw = fetch(c["img"], raw=True)
        if not raw: continue
        try:
            im = Image.open(io.BytesIO(raw)).convert("RGB")
        except Exception:
            continue
        fn = "cand/%s_%d.jpg" % (key, len(keep))
        im.thumbnail((420, 420), Image.LANCZOS); im.save(fn, quality=88)
        c["file"] = fn; keep.append(c)
        print("   [%d] %-19s %-13s %-30s %s" % (len(keep)-1, c["src"], c["l"], c["a"][:30], c.get("place", c.get("title",""))[:34]))
        time.sleep(0.25)
    if not keep: print("   sin candidatos con licencia valida")
    report[key] = keep
json.dump(report, open("candidates.json","w",encoding="utf-8"), ensure_ascii=False)
print("\ntotal especies con candidato: %d/%d" % (sum(1 for v in report.values() if v), len(TARGETS)))

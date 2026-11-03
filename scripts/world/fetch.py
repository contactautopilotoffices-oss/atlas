"""Andheri East 3D world: fetch the open data the model is built from.

  python scripts/world/fetch.py OUT_DIR

Overture Maps (release 2026-10-21) read straight from its public S3 bucket
with pyarrow, keeping only the row groups whose bounding boxes touch the
Andheri East box, plus the Copernicus GLO-30 surface model tile for
N19 E072, cropped to the same box. No API key is needed for either.
Writes building, segment, water, land_use, infrastructure .parquet files,
dsm.npy and dsm_t.json (the crop's affine transform).
"""
import os, sys, time, json, urllib.request
import pyarrow.fs as pafs, pyarrow.parquet as pq, pyarrow as pa, pyarrow.compute as pc
from concurrent.futures import ThreadPoolExecutor
REL="release/2026-10-21.0"
BB=(72.838,19.094,72.896,19.128)
s3=pafs.S3FileSystem(anonymous=True, region="us-west-2")
def rgs(path):
    f=pq.ParquetFile(path, filesystem=s3); md=f.metadata; hits=[]
    names=[md.schema.column(i).path for i in range(md.num_columns)]
    ix={n:i for i,n in enumerate(names)}
    for r in range(md.num_row_groups):
        g=md.row_group(r); st=lambda n: g.column(ix[n]).statistics
        try:
            if st("bbox.xmin").min<BB[2] and st("bbox.xmax").max>BB[0] and st("bbox.ymin").min<BB[3] and st("bbox.ymax").max>BB[1]: hits.append(r)
        except Exception as e: hits.append(r)
    return path,hits
def get(theme,typ,cols,out):
    t=time.time()
    files=[x.path for x in s3.get_file_info(pafs.FileSelector(f"overturemaps-us-west-2/{REL}/theme={theme}/type={typ}/")) if x.path.endswith(".parquet")]
    with ThreadPoolExecutor(32) as ex: res=list(ex.map(rgs,files))
    res=[(p,h) for p,h in res if h]; print(typ,len(files),"files;",sum(len(h) for _,h in res),"row groups hit",flush=True)
    def read(ph):
        p,h=ph; tb=pq.ParquetFile(p,filesystem=s3).read_row_groups(h,columns=cols)
        b=tb.column("bbox").combine_chunks()
        m=pc.and_(pc.and_(pc.less(b.field("xmin"),BB[2]),pc.greater(b.field("xmax"),BB[0])),pc.and_(pc.less(b.field("ymin"),BB[3]),pc.greater(b.field("ymax"),BB[1])))
        return tb.filter(m)
    with ThreadPoolExecutor(16) as ex: parts=list(ex.map(read,res))
    tb=pa.concat_tables(parts); pq.write_table(tb,out); print(typ,tb.num_rows,"rows",round(time.time()-t),"s",flush=True)
SP={"building":("buildings",["id","geometry","height","num_floors","class","subtype","names","bbox","roof_shape","facade_color","roof_color"]),
 "segment":("transportation",["id","geometry","class","subtype","names","bbox"]),
 "water":("base",["id","geometry","class","subtype","bbox"]),"land_use":("base",["id","geometry","class","subtype","bbox"]),
 "land_cover":("base",["id","geometry","subtype","bbox"]),"infrastructure":("base",["id","geometry","class","subtype","names","bbox"])}
OUTD = sys.argv[1]; os.makedirs(OUTD, exist_ok=True)
for w in SP:
    th, cols = SP[w]; get(th, w, cols, os.path.join(OUTD, f"{w}.parquet"))
# the surface model: one 1-degree tile, cropped to the box
import numpy as np, rasterio
from rasterio.windows import from_bounds
tif = os.path.join(OUTD, "dsm.tif")
if not os.path.exists(tif):
    urllib.request.urlretrieve("https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N19_00_E072_00_DEM/Copernicus_DSM_COG_10_N19_00_E072_00_DEM.tif", tif)
with rasterio.open(tif) as r:
    win = from_bounds(BB[0], BB[1], BB[2], BB[3], r.transform)
    np.save(os.path.join(OUTD, "dsm.npy"), r.read(1, window=win))
    json.dump(list(r.window_transform(win))[:6], open(os.path.join(OUTD, "dsm_t.json"), "w"))
print("dsm cropped")

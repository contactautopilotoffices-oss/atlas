"""Headless adapter around the PURCHASED Concept Studio OSM addon.
Review before executing. No global installation or preference saving.
Example:
 Blender --background --factory-startup --python headless_import_recipe.py -- \
   --addon-path /path/to/licensed-addon --site 723-avenue --lat 19.109713 --lon 72.884422 --radius 600 --output /private/tmp/atlas-concept/723
Only OSM + SRTM. Optional imagery is intentionally not downloaded here.
"""
import argparse
import inspect
import json
import pathlib
import sys
import threading
import types

import addon_utils
import bpy

parser = argparse.ArgumentParser()
parser.add_argument('--addon-path', required=True, help='Directory containing the licensed concept_studio_osm package')
parser.add_argument('--cache', help='Optional DEM cache directory')
parser.add_argument('--site', required=True)
parser.add_argument('--lat', type=float, required=True)
parser.add_argument('--lon', type=float, required=True)
parser.add_argument('--radius', type=float, default=600)
parser.add_argument('--output', required=True)
args = parser.parse_args(sys.argv[sys.argv.index('--')+1:])
addon_root = pathlib.Path(args.addon_path)
sys.path.insert(0,str(addon_root))
addon_utils.enable('concept_studio_osm', default_set=True, persistent=False)
# default_set creates the in-memory AddonPreferences record required by prefs.get.
# No save_userpref call; nothing is installed or saved to the user's profile.
from concept_studio_osm import prefs
from concept_studio_osm.core import blender_utils as bu, dem, osm
from concept_studio_osm.ops import op_osm, op_terrain

out = pathlib.Path(args.output)
out.mkdir(parents=True,exist_ok=True)
cache=pathlib.Path(args.cache) if args.cache else out.parent/'_cache'
cache.mkdir(exist_ok=True)
p = prefs.get(bpy.context)
p.cache_dir = str(cache)
# OSM/terrain operators are independent of the Google/Earth source enum.
# Do not select the retired 'free' enum: 3.5.4 maps it to Google Earth web.
p.data_mode = 'google_key'
p.google_api_key = ''
# All objects are in a new --factory-startup scene, not the user's open file.
bu.clear_collection(bu.ROOT_COLLECTION)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
s = bpy.context.scene.concept_studio_osm
s.area_mode='RADIUS'
s.center_lat=args.lat
s.center_lon=args.lon
s.radius_km=args.radius/1000
s.address=args.site
s.recenter_on_pin=False
s.ground_mode='MANUAL'
s.terrain_spacing=30
s.terrain_skirt=8
s.drape_to_terrain=True
s.osm_buildings=True
s.osm_roads=True
s.osm_rail=True
s.osm_water=True
s.osm_green=True
s.osm_trees=False
s.osm_sidewalks=False
s.osm_street_furniture=False
s.osm_bushes=False
s.facade_mode='SOLID'
s.separate_objects=False
s.clip_roads=True
s.imagery_source='S2'

# Sample native DEM once; retain double precision geographic origin.
sampler=dem.Elevation(cache_dir=str(cache/'dem'))
origin_height=sampler.sample(args.lat,args.lon)
if origin_height is None:
    raise RuntimeError('No SRTM elevation at project origin; refusing fabricated terrain.')
s.ground_height=origin_height
bpy.context.scene.concept_studio_georef.set_origin(args.lat,args.lon,origin_height)

class SynchronousRunner:
    """Use original operator methods, avoiding its UI timer/modal machinery."""
    def __init__(self, operator_class):
        self.operator_class=operator_class
        self.cancel_event=threading.Event()
        self.error=None
        self.error_message=None
    def report(self, level, message):
        print(','.join(level),message,flush=True)
    def __getattr__(self,name):
        value=inspect.getattr_static(self.operator_class,name)
        if isinstance(value,staticmethod):
            return value.__func__
        if isinstance(value,classmethod):
            return getattr(self.operator_class,name)
        if inspect.isfunction(value):
            return types.MethodType(value,self)
        return value

terrain=SynchronousRunner(op_terrain.CONCEPT_STUDIO_OSM_OT_import_terrain)
assert terrain.prepare(bpy.context) is True
terrain.work()
if terrain.error or terrain.no_data or not terrain.grid:
    raise RuntimeError(terrain.error or 'No terrain returned')
assert terrain.finish(bpy.context)=={'FINISHED'}

vector=SynchronousRunner(op_osm.CONCEPT_STUDIO_OSM_OT_import_osm)
assert vector.prepare(bpy.context) is True
source_meta={}
cached=out/'source-osm.json'
if cached.exists():
    vector.result=json.loads(cached.read_text())
    source_meta=json.loads((out/'source-osm-metadata.json').read_text()) if (out/'source-osm-metadata.json').exists() else {}
    endpoint=('local Geofabrik PBF extract: '+pathlib.Path(source_meta['source_file']).name) if str(source_meta.get('source_file','')).endswith('.osm.pbf') else 'local cached OSM extract'
else:
    vector.result,endpoint=osm.fetch_first(vector.query,vector.endpoint,timeout=60,hedge_after=10)
vector.terrain_grid=terrain.grid
assert vector.finish(bpy.context)=={'FINISHED'}
(out/'source-osm.json').write_text(json.dumps(vector.result))
# Native OSM ways can extend far beyond the requested bbox. Crop the presentation
# meshes after native construction; retain the complete original source extract.
import bmesh
from mathutils import Vector
for obj in list(bpy.context.scene.objects):
    if obj.type!='MESH':continue
    bm=bmesh.new();bm.from_mesh(obj.data)
    for axis,sign in [(0,1),(0,-1),(1,1),(1,-1)]:
        point=Vector((0,0,0));normal=Vector((0,0,0));point[axis]=sign*args.radius;normal[axis]=sign
        bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=.0001,plane_co=obj.matrix_world.inverted() @ point,plane_no=obj.matrix_world.to_3x3().transposed() @ normal,clear_outer=True,clear_inner=False)
    bm.to_mesh(obj.data);bm.free();obj.data.update()
    if obj.name=='Terrain':
        for mat in obj.data.materials:
            if mat and mat.use_nodes:
                for node in mat.node_tree.nodes:
                    if node.type=='BSDF_PRINCIPLED':node.inputs['Base Color'].default_value=(.48,.44,.35,1)


missing_height=0
for tags,ring,holes in osm.iter_polygons(vector.result):
    if osm.is_building(tags) and not any(tags.get(k) for k in ('height','building:levels')):
        missing_height+=1
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
metadata={
    'site':args.site,'tool':'Concept Studio OSM','tool_version':'3.5.4',
    'origin':{'lat':args.lat,'lon':args.lon,'height':origin_height},
    'radius_m':args.radius,'bbox':list(vector.bbox),
    'local_frame':'Blender metres: X east, Y north, Z up; exported GLB: X east, Y up, Z south',
    'north_offset_degrees':0,'utm_zone':43,'utm_epsg':32643,'utm_note':'Mumbai location zone; geometry is ENU, not UTM coordinates','mesh_objects':len(meshes),
    'vertices':sum(len(o.data.vertices) for o in meshes),
    'polygons':sum(len(o.data.polygons) for o in meshes),
    'sources':['OpenStreetMap via '+endpoint,'NASA SRTM via AWS Terrain Tiles'],
    'attribution':['© OpenStreetMap contributors (ODbL)',dem.ATTRIBUTION],
    'imagery':'None. No Google or Esri requests.',
    'presentation_crop':f'{args.radius:g} m half-width around the pin; complete source ways retained separately; terrain skirt is presentation only.',
    'source_extract':source_meta if cached.exists() else {},
    'assumptions':{'unheighted_buildings':missing_height,
       'fallback_building_height_m':s.default_height,
       'height_per_level_m':s.level_height,
       'note':'Context massing only. Unspecified heights and road widths use addon defaults; not survey or CAD geometry.'},
}
(out/'metadata.json').write_text(json.dumps(metadata,indent=2))
bpy.context.scene['atlas_context_metadata']=json.dumps(metadata)
bpy.ops.wm.save_as_mainfile(filepath=str(out/'context.blend'))
bpy.ops.export_scene.gltf(filepath=str(out/'context.glb'),export_format='GLB',
                          use_selection=False,export_cameras=False,export_lights=False,
                          export_extras=True)
print(json.dumps(metadata),flush=True)

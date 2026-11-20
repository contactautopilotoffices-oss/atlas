"""Rebuild silent, web-sized property cuts. Original MOV files are untouched."""
import json,subprocess,os
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont,ImageOps
ROOT=Path(__file__).resolve().parent
SRC=ROOT.parent/'Andheri Property Visits '
OUT=ROOT.parent/'media/flipkart-andheri-east/visits'
WORK=ROOT/'work'
OUT.mkdir(parents=True,exist_ok=True);WORK.mkdir(exist_ok=True)
PLAN=json.loads((ROOT/'edit-plan.json').read_text())
FONT='/System/Library/Fonts/Supplemental/Arial.ttf'
def run(args):subprocess.run([os.environ.get('FFMPEG','ffmpeg'),'-hide_banner','-loglevel','error','-y']+args,check=True)
report={}
for slug,prop in PLAN.items():
 segments=[]
 for i,shot in enumerate(prop['shots']):
  tag=WORK/f'{slug}-{i}.png'; dst=WORK/f'{slug}-{i}.mp4'
  im=Image.new('RGBA',(720,960));d=ImageDraw.Draw(im)
  d.rectangle((0,820,720,960),fill=(22,20,18,205))
  d.text((34,844),prop['name'],font=ImageFont.truetype(FONT,29),fill='#ffffff')
  d.text((34,891),shot['label'],font=ImageFont.truetype(FONT,21),fill='#f3e7db')
  im.save(tag)
  dur=shot['duration']
  vf=f'[0:v]fps=30,scale=720:960:force_original_aspect_ratio=decrease,pad=720:960:(ow-iw)/2:(oh-ih)/2,zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p,setsar=1[v];[v][1:v]overlay=0:0,fade=t=in:st=0:d=0.15,fade=t=out:st={dur-.15}:d=0.15,format=yuv420p[out]'
  run(['-ss',str(shot['start']),'-i',str(SRC/shot['file']),'-loop','1','-i',str(tag),'-filter_complex',vf,'-map','[out]','-t',str(dur),'-an','-color_primaries','bt709','-color_trc','bt709','-colorspace','bt709','-c:v','libx264','-preset','fast','-crf','22','-maxrate','2800k','-bufsize','5600k','-movflags','+faststart',str(dst)])
  segments.append(dst)
  print('Cut',slug,i,flush=True)
 # Normalize the rendered brand outro to match the source cuts.
 outro=WORK/'outro.mp4'
 if not outro.exists():
  run(['-i',str(ROOT/'renders/outro.mp4'),'-vf','fps=30,scale=720:960,setsar=1,format=yuv420p','-an','-color_primaries','bt709','-color_trc','bt709','-colorspace','bt709','-c:v','libx264','-preset','fast','-crf','22','-maxrate','2800k','-bufsize','5600k',str(outro)])
 segments.append(outro)
 listing=WORK/f'{slug}.txt';listing.write_text('\n'.join("file '"+str(x)+"'" for x in segments))
 final=OUT/f'{slug}-walkthrough.mp4'
 run(['-f','concat','-safe','0','-i',str(listing),'-c','copy','-an','-movflags','+faststart',str(final)])
 run(['-ss','3','-i',str(final),'-frames:v','1','-q:v','3',str(OUT/f'{slug}-poster.jpg')])
 probe=json.loads(subprocess.check_output(['ffprobe','-v','quiet','-show_streams','-show_format','-of','json',str(final)]))
 assert not any(x['codec_type']=='audio' for x in probe['streams'])
 assert final.stat().st_size<20_000_000,(slug,'over 20 MB')
 report[slug]={'file':final.name,'bytes':final.stat().st_size,'duration':float(probe['format']['duration']),'audioStreams':0,'codec':probe['streams'][0]['codec_name'],'shots':prop['shots']}
 print('Finished',slug,round(final.stat().st_size/1e6,2),'MB',flush=True)
for filename,title in [('Frontal Elevation .JPG','frontal-elevation'),('TopView.JPG','top-view')]:
 im=ImageOps.exif_transpose(Image.open(SRC/'723 Avenue '/filename)).convert('RGB');im.thumbnail((1800,1800));im.save(OUT/f'723-avenue-{title}.jpg',quality=85,optimize=True)
(ROOT/'verification.json').write_text(json.dumps(report,indent=2)+'\n')

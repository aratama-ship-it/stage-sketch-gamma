from pathlib import Path
import math
BASE = Path(__file__).resolve().parents[1]
R = BASE / 'gamma-dev/jog-transition-prototype/reference'
scale=(1/.45)*2.54/100

def ident(): return [[1.,0.,0.],[0.,1.,0.],[0.,0.,1.]]
def mm(a,b): return [[sum(a[i][k]*b[k][j] for k in range(3)) for j in range(3)] for i in range(3)]
def mv(a,b): return [sum(a[i][k]*b[k] for k in range(3)) for i in range(3)]
def tr(a): return list(map(list,zip(*a)))
def plus(a,b): return [x+y for x,y in zip(a,b)]
def rot(axis,a):
 a=math.radians(a);c=math.cos(a);s=math.sin(a)
 return {'x':[[1,0,0],[0,c,-s],[0,s,c]],'y':[[c,0,s],[0,1,0],[-s,0,c]],'z':[[c,-s,0],[s,c,0],[0,0,1]]}[axis]
# ASF XYZ is applied left to right; column-vector matrices pre-multiply.
def euler(axes,angles):
 m=ident()
 for ax,angle in zip(axes,angles): m=mm(rot(ax,angle),m)
 return m
bones={}
lines=(R/'35.asf').read_text().splitlines()
inbone=False; b={}; inbonedata=False
for line in lines:
 s=line.strip()
 if s==':bonedata': inbonedata=True;continue
 if s==':hierarchy': inbonedata=False
 if s=='begin' and inbonedata: inbone=True;b={}
 elif s=='end' and inbone:
  bones[b['name']]=b;inbone=False
 elif inbone:
  v=s.split()
  if not v: continue
  if v[0]=='name': b['name']=v[1]
  if v[0]=='direction': b['direction']=list(map(float,v[1:4]))
  if v[0]=='length': b['length']=float(v[1])*scale
  if v[0]=='axis': b['axis']=euler(v[4].lower(),map(float,v[1:4]))
  if v[0]=='dof': b['dof']=[x[1] for x in v[1:]]
hierarchy={}
i=lines.index(':hierarchy')+1
for line in lines[i:]:
 v=line.strip().split()
 if v and v[0] not in ('begin','end'): hierarchy[v[0]]=v[1:]

def read_amc(filename):
 frames=[];current=None
 for line in (R/filename).read_text().splitlines():
  v=line.split()
  if not v: continue
  if len(v)==1 and v[0].isdigit():
   if current: frames.append(current)
   current={};continue
  if current is not None:current[v[0]]=list(map(float,v[1:]))
 if current: frames.append(current)
 return frames

def fk(frame):
 root=frame['root']; pos={'root':[v*scale for v in root[:3]]};ori={'root':euler('xyz',root[3:])}
 def descend(parent):
  for name in hierarchy.get(parent,[]):
   b=bones[name]; c=b['axis'];vals=frame.get(name,[]);m=euler(b.get('dof',''),vals)
   ori[name]=mm(ori[parent],mm(c,mm(m,tr(c))))
   pos[name]=plus(pos[parent],mv(ori[name],[x*b['length'] for x in b['direction']]))
   descend(name)
 descend('root');return pos
import json
frames=read_amc('35_23.amc')
keys=['head','neck','shL','shR','elL','elR','wrL','wrR','hipL','hipR','knL','knR','anL','anR','toL','toR']
source=['head','lowerneck','lclavicle','rclavicle','lhumerus','rhumerus','lradius','rradius','lhipjoint','rhipjoint','lfemur','rfemur','ltibia','rtibia','ltoes','rtoes']
rows=[]
for i in range(48,137,2):
    j=fk(frames[i]);root=j['root']
    rows.append([[round(-((j[k][0]-root[0])/1.75),4),round(j[k][1]/1.75,4),round((j[k][2]-root[2])/1.75,4)] for k in source])
rows[0]=[[round((a+b)/2,4) for a,b in zip(x,y)] for x,y in zip(rows[0],rows[-1])]
rows[-1]=[list(x) for x in rows[0]]
head='''/* CMU Motion Capture Database, subject 35 trial 23 (run/jog, 120 fps).
   Extracted frames 49-137 (1-based), every second frame; one two-step cycle.
   Positions in a local frame, normalized by measured ~1.75 m stature.
   x is mirrored into Stage Sketch left/right convention. See gamma-dev/jog-transition-prototype/README.md. */
(function(root){
  'use strict';
  root.STAGE_JOG_REFERENCE = Object.freeze({
    joints: '''+json.dumps(keys,separators=(',',':'))+''',
    frames: '''+json.dumps(rows,separators=(',',':'))+'''
  });
})(typeof window === 'undefined' ? globalThis : window);
'''
(BASE / 'stage-jog-reference.js').write_text(head)
print('wrote',len(rows),'frames',len(head),'bytes')

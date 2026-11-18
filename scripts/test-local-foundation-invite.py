#!/usr/bin/env python3
"""Real local GoTrue invite smoke test. Only a disposable named Docker project.
Run AFTER SQL acceptance; this installs application SQL in the project's empty
postgres DB used by GoTrue. Never accepts external URLs or credentials.
"""
import base64, hashlib, hmac, json, subprocess, sys, time
from pathlib import Path
root=Path(__file__).resolve().parents[1]
project=sys.argv[1]; output=Path(sys.argv[2]); output.mkdir(parents=True,exist_ok=True)
if not project.startswith('dot-foundation-replay-'): raise SystemExit('Refusing non-disposable project')
db='supabase_db_'+project; auth='supabase_auth_'+project

def sql(source):
 r=subprocess.run(['docker','exec','-i',db,'psql','-X','-q','-At','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-f','-'],input=source,capture_output=True,text=True)
 if r.returncode: raise RuntimeError(r.stderr)
 return r.stdout.strip()
if sql("SELECT to_regclass('public.profiles') IS NULL;")!='t': raise SystemExit('Refusing nonempty Auth project')
for p in sorted((root/'supabase/migrations').glob('*.sql')):
 sql('BEGIN;'+p.read_text()+'COMMIT;')
info=json.loads(subprocess.check_output(['docker','inspect',auth]))[0]
env=dict(x.split('=',1) for x in info['Config']['Env'] if '=' in x)
network=next(iter(info['NetworkSettings']['Networks']))
mail=env['GOTRUE_SMTP_HOST']
if mail!='supabase_inbucket_'+project: raise SystemExit('Unexpected SMTP target')
subprocess.run(['docker','run','-d','--name',mail,'--network',network,'--label','com.supabase.cli.project='+project,'public.ecr.aws/supabase/mailpit:v1.31.3'],check=True,stdout=subprocess.DEVNULL)
# Credentials stay in memory and go to curl over stdin, never command arguments.
def b64(x):return base64.urlsafe_b64encode(x).rstrip(b'=')
header=b64(b'{"alg":"HS256","typ":"JWT"}')
claims=b64(json.dumps({'role':'service_role','iss':'supabase','exp':int(time.time())+600}).encode())
payload=header+b'.'+claims
token=(payload+b'.'+b64(hmac.new(env['GOTRUE_JWT_SECRET'].encode(),payload,hashlib.sha256).digest())).decode()

def invite(email):
 body=json.dumps({'email':email,'data':{'full_name':'Local fixture','role':'DRIVER'}})
 config='url = "http://'+auth+':9999/invite"\nrequest = "POST"\nheader = "Authorization: Bearer '+token+'"\nheader = "Content-Type: application/json"\ndata = '+json.dumps(body)+'\n'
 r=subprocess.run(['docker','exec','-i',db,'curl','-sS','--max-time','30','-w','\n%{http_code}','--config','-'],input=config,capture_output=True,text=True)
 if r.returncode: raise RuntimeError('Local HTTP invocation failed')
 raw,status=r.stdout.rsplit('\n',1)
 data=json.loads(raw)
 return int(status),data
fleet='30000000-0000-0000-0000-000000000001'
email='real-invite@example.invalid'
sql(f"INSERT INTO public.fleets(id,company_name) VALUES ('{fleet}','Local real invite'); SET ROLE service_role; INSERT INTO public.fleet_invitations(email,fleet_id,role) VALUES ('{email}','{fleet}','ADMIN');")
status,data=invite(email)
row=sql(f"SELECT json_build_object('role',p.role,'fleet_matches',p.fleet_id='{fleet}','invited_at_present',a.invited_at IS NOT NULL) FROM public.profiles p JOIN auth.users a ON a.id=p.id WHERE p.email='{email}';")
remaining=sql(f"SELECT count(*) FROM public.fleet_invitations WHERE email='{email}';")
result={'first_invite_http':status,'profile':json.loads(row) if row else None,'remaining_reservations':int(remaining)}
# Persist the first outcome even if the repeat-invite probe fails.
(output/'real-invite.json').write_text(json.dumps(result,indent=2)+'\n')
# Existing invited user: verify whether Auth reuses it without triggering insert.
sql(f"SET ROLE service_role; INSERT INTO public.fleet_invitations(email,fleet_id,role) VALUES ('{email}','{fleet}','ADMIN') ON CONFLICT (email) DO NOTHING;")
again,_=invite(email)
result['repeat_invite_http']=again
result['repeat_reservation_count']=int(sql(f"SELECT count(*) FROM public.fleet_invitations WHERE email='{email}';"))
result['pass']=status in (200,201) and result['profile']=={'role':'ADMIN','fleet_matches':True,'invited_at_present':True} and result['remaining_reservations']==0
(output/'real-invite.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result))
raise SystemExit(0 if result['pass'] else 1)

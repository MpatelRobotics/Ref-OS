"""Build the public staff PDF from the bundled guide and current connector workflow."""
import json, subprocess, re, base64, io
from PIL import Image as PILImage
from pathlib import Path
from xml.sax.saxutils import escape
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Image, KeepTogether
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.enums import TA_LEFT

ROOT=Path(__file__).resolve().parents[1]
raw=subprocess.check_output(['node','--input-type=module','-e',"import {GUIDE_ARTICLES} from './src/guide/articles.js';process.stdout.write(JSON.stringify(GUIDE_ARTICLES))"],cwd=ROOT)
ART={a['id']:a for a in json.loads(raw)}
fonts=Path('C:/Windows/Fonts')
if fonts.exists():
 pdfmetrics.registerFont(TTFont('Body',str(fonts/'arial.ttf')))
 pdfmetrics.registerFont(TTFont('Strong',str(fonts/'arialbd.ttf')))
else:
 import reportlab
 fonts=Path(reportlab.__file__).parent/'fonts'
 pdfmetrics.registerFont(TTFont('Body',str(fonts/'Vera.ttf')))
 pdfmetrics.registerFont(TTFont('Strong',str(fonts/'VeraBd.ttf')))
pdfmetrics.registerFontFamily('Body',normal='Body',bold='Strong')
navy=HexColor('#151a31'); muted=HexColor('#536079'); blue=HexColor('#4059d4')
styles={
 'title':ParagraphStyle('title',fontName='Strong',fontSize=30,leading=35,textColor=navy,spaceAfter=16),
 'h1':ParagraphStyle('h1',fontName='Strong',fontSize=22,leading=27,textColor=navy,spaceAfter=17),
 'h2':ParagraphStyle('h2',fontName='Strong',fontSize=13,leading=17,textColor=navy,spaceBefore=13,spaceAfter=7,keepWithNext=True),
 'body':ParagraphStyle('body',fontName='Body',fontSize=10,leading=14,textColor=navy,spaceAfter=7),
 'step':ParagraphStyle('step',fontName='Body',fontSize=10,leading=14,textColor=navy,leftIndent=20,firstLineIndent=-20,spaceAfter=6),
 'note':ParagraphStyle('note',fontName='Body',fontSize=9,leading=13,textColor=muted,spaceBefore=5,spaceAfter=10,borderColor=HexColor('#c6cdec'),borderWidth=.6,borderPadding=8,backColor=HexColor('#f2f5fb')),
 'small':ParagraphStyle('small',fontName='Body',fontSize=9,leading=13,textColor=muted,spaceAfter=8),
}
def clean(t):
 return t.replace('→',' > ').replace('’',"'").replace('‘',"'").replace('“','"').replace('”','"').replace('–','-').replace('—','-').replace('‑','-').replace('…','...').replace(' · ',' / ')
def para(t,style='body'):
 return Paragraph(escape(clean(t)),styles[style])
story=[]
def article(id):
 a=ART[id]
 story.append(para(a['title'],'h2'))
 story.append(para(a['summary']))
 for n,step in enumerate(a['steps'],1):story.append(para(f'{n}.  {step}','step'))
 story.append(para(a['seen'],'small'))
 story.append(para(a['important'],'note'))
def section(n,title):
 story.append(PageBreak());story.append(para(f'{n}. {title}','h1'))
def block(title,body):story.extend([para(title,'h2'),para(body)])
def footer(c,doc):
 c.setStrokeColor(HexColor('#dce2ed'));c.line(48,748,564,748)
 c.setFont('Strong',9);c.setFillColor(navy);c.drawString(48,759,'REF-OS  /  EVENT INSTRUCTION GUIDE')
 c.setFont('Body',8);c.setFillColor(muted);c.drawString(48,29,'Updated November 26, 2026  |  ref-os.fyi');c.drawRightString(564,29,str(doc.page))
# Cover and navigation reference.
svg=(ROOT/'public/refos-logo.svg').read_text(encoding='utf-8')
m=re.search(r'data:image/[^;]+;base64,([^"\s]+)',svg)
if m:
 logo=PILImage.open(io.BytesIO(base64.b64decode(m.group(1))));logo.thumbnail((256,256));buf=io.BytesIO();logo.save(buf,format='PNG');buf.seek(0)
 story.extend([Image(buf,72,72,hAlign='LEFT'),Spacer(1,20)])
story.extend([para('Your event. Connected.','small'),para('Event instruction guide','title'),para('A practical guide for referees, inspectors, emcees, Judge Advisors and event Admins.'),para('Open https://www.ref-os.fyi/ to get started. This guide contains general instructions; obtain your event-specific access code from event leadership.','note')])
contents=['Getting started and public schedules','Event setup, divisions and branding','VEX Events and Tournament Manager sync','Matches and IQ finals','Violations, rules and field incidents','Robot pictures and configuration reminders','Nominations and judging interviews','Exports and backups','Connection and offline preparation','Help, feedback and logout']
story.append(para('Find your task','h2'))
for i,title in enumerate(contents,1):story.append(para(f'{i}.  {title}  /  page {[2,3,4,6,7,8,9,10,11,12][i-1]}','step'))
story.append(Spacer(1,8));story.append(para('Use the searchable User Guide in the main sidebar or Features & Help for more role-specific instructions. The official game manual and Tournament Manager remain the sources for competition rules and official results.','small'))
section(1,contents[0]);article('start');article('public-schedule')
section(2,contents[1]);article('setup');article('settings')
section(3,contents[2]);article('vex-live-sync');article('tm')
story.append(PageBreak());story.append(para('3. Sync - live TM connector','h1'))
block('Choose the connector device','Use Ref-OS Connect on Windows or the supported native connector on Android. The connector device must reach both the TM server and Ref-OS Cloud. Other volunteers can use the website without access to the TM API key or network.')
for i,t in enumerate([
'In Event Command Center > Event Setup & Management > Microsoft Store, find Ref-OS Connect for Windows. Open it and select your REF-OS website and event.',
'Ask the TM operator to enable the Local TM API in Tools > Options > Web Publishing and provide the server address, port and event API key.',
'Open the TM connection setup, enter the address and key, and choose Connect to TM. Select the TM division and check the matching REF-OS destination.',
'Choose Review TM data. Select the intended TM session if asked, review the preview and choose Start TM syncing.',
'For two divisions on one TM server, use Sync both TM divisions. Load TM divisions, map each to a different REF-OS division, review both and start both divisions.',
'Keep the connector running and monitor its status. Check the event, division and League session on another volunteer device.'
],1):story.append(para(f'{i}.  {t}','step'))
story.append(para('VEX sync reads published internet data; the TM connector reads the local event server. A normal browser alone is not a native TM connector. Do not share the TM API key with the volunteer crew.','note'))
block('Custom names and sync','Configure division and field display names in Event Setup & Settings. Descriptive synced division names take priority; generic names keep the saved custom name. Imported schedules determine available match fields. Check mappings before syncing; numeric division IDs do not need to match.')
section(4,contents[3]);article('matches');article('iq-workflows')
section(5,contents[4]);article('violation');article('field')
block('Rules and the official manual','Open Rules to search rule codes and descriptions. Follow Official VEX game manuals to manuals.vex.com for the full criteria, exceptions and rulings. Quick descriptions and automated counts are aids, not official decisions.')
section(6,contents[5]);article('photos');article('robot-configurations')
section(7,contents[6]);article('judging');article('interviews')
section(8,contents[7]);article('violation-export');article('backup')
block('Nomination and event reports','Use Export nominations for the supported award forms and Export Event Report for the operational summary. Verify the selected event, division and League session, and review downloaded files before sharing with authorized staff.')
section(9,contents[8]);article('connection');article('offline')
block('League sessions and local venue mode','Confirm the working League session before importing or logging data. Match numbers can repeat in different sessions. Cloud and Local Venue Server data are separate; export venue data before leaving venue mode. Switching modes does not automatically merge records.')
section(10,contents[9]);article('trouble');article('lock')
block('Support','Use About & Contact on the main page: refos.app@gmail.com, Discord mpatel_ref, or Instagram @refos.fyi. For urgent event operations, contact event leadership directly.')
out=ROOT/'public/Ref-OS-Event-Instruction-Guide.pdf'
SimpleDocTemplate(str(out),pagesize=(612,792),leftMargin=48,rightMargin=48,topMargin=61,bottomMargin=48,title='REF-OS Event Instruction Guide',author='REF-OS').build(story,onFirstPage=footer,onLaterPages=footer)
import pymupdf
with pymupdf.open(out) as doc: doc.save(str(out)+'.tmp',garbage=4,deflate=True)
Path(str(out)+'.tmp').replace(out)
print(out)

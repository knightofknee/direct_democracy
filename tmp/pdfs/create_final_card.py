from pathlib import Path
import math, subprocess
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor
from reportlab.graphics.barcode import qrencoder
from PIL import Image, ImageDraw, ImageFont
from pypdf import PdfReader

ROOT = Path('/Users/briancarlisle/repos/direct-democracy')
OUT = ROOT / 'output/pdf/direct-democracy-business-card'
OUT.mkdir(parents=True, exist_ok=True)
FONTROOT = Path('/Users/briancarlisle/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/libreoffice-headless/libreoffice/LibreOfficeDev.app/Contents/Resources/fonts/truetype')
SYSTEM = Path('/System/Library/Fonts/Supplemental')
for name, path in [('Rubik',FONTROOT/'Rubik-Regular.ttf'),('Bold',FONTROOT/'Rubik-Bold.ttf'),('DIN',SYSTEM/'DIN Condensed Bold.ttf')]:
    pdfmetrics.registerFont(TTFont(name,str(path)))

BLUE='#41B6E6'; RED='#C8102E'; INK='#101820'; WHITE='#FFFFFF'
W,H=270,162
URL='https://www.waldgrave.com/directdemocracy'
qr=qrencoder.QRCode(None,qrencoder.QRErrorCorrectLevel.M)
qr.addData(URL); qr.make()
N=len(qr.modules)
pdf=OUT/'direct-democracy-chicago-print.pdf'
c=canvas.Canvas(str(pdf),pagesize=(W,H),pageCompression=1)
c.setTitle('direct democracy: Chicago | business card')
c.setAuthor('The Waldgrave')

def rect(x,y,w,h,color):
    c.setFillColor(HexColor(color)); c.rect(x,144-y-h,w,h,stroke=0,fill=1)

def text(s,x,y,size=10,font='Rubik',color=INK):
    c.setFillColor(HexColor(color)); c.setFont(font,size)
    c.drawString(x,144-y-size*.8,s)

def star(x,y,r,color=RED):
    # Exact points from the flag SVG hosted by design.chicago.gov.
    # Original first star is centered at (150,240), with 60-unit radius.
    points=[(0,-60),(11,-19),(52,-30),(22,0),(52,30),(11,19),
            (0,60),(-11,19),(-52,30),(-22,0),(-52,-30),(-11,-19)]
    p=c.beginPath()
    for i,(px,py) in enumerate(points):
        (p.moveTo if i==0 else p.lineTo)(x+px*r/60,144-y-py*r/60)
    p.close();c.setFillColor(HexColor(color));c.drawPath(p,stroke=0,fill=1)

def stars(x,y,r,gap,color=RED):
    for i in range(4):star(x+i*gap,y,r,color)

def begin(bg=WHITE):
    c.setTrimBox((9,9,261,153)); c.setBleedBox((0,0,270,162))
    c.saveState();c.translate(9,9);rect(-9,-9,270,162,bg)

def end():c.restoreState();c.showPage()

def code(x,y,size=92):
    rect(x,y,size,size,WHITE)
    m=size/(N+8)
    c.setFillColor(HexColor('#000000'))
    p=c.beginPath()
    for row in range(N):
        for col in range(N):
            if qr.modules[row][col]:
                p.rect(x+(col+4)*m,144-y-(row+5)*m,m,m)
    c.drawPath(p,fill=1,stroke=0)

def footer(color=INK):
    text('waldgrave.com/directdemocracy',13,108,8.3,'Bold',color)
    text('The Waldgrave · waldgrave.com',13,118,7.2,'Rubik',color)
    text('We make free or at cost software.',13,127,7.2,'Rubik',color)

# A: a tightly composed, typographic take on the Chicago flag.
begin()
rect(-9,-9,270,20,BLUE)
text('direct',13,19,30,'Bold')
text('democracy:',13,48,30,'Bold')
text('Chicago',13,78,30,'Bold',RED)
stars(160,94,8,22)
rect(-9,110,270,43,BLUE)
text('Election information,',13,115,9,'Rubik')
text('ward participation and more!',13,125,9,'Rubik')
end()
begin()
rect(-9,-9,270,15,BLUE)
text('Your city.',13,19,21,'Bold')
text('Your say.',13,42,21,'Bold')
text('Scan to take part.',13,76,10,'Rubik')
stars(19,96,5,15)
code(147,12,92)
footer()
end()


c.save()
poppler='/Users/briancarlisle/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/override/pdftoppm'
subprocess.run([poppler,'-r','600','-png',str(pdf),str(OUT/'render')],check=True,capture_output=True)
for i,side in enumerate(['front','back']):
    im=Image.open(OUT/f'render-{i+1}.png').convert('RGB').crop((75,75,2175,1275))
    im.save(OUT/f'{side}.png',dpi=(600,600))
    (OUT/f'render-{i+1}.png').unlink()
sheet=Image.new('RGB',(1660,570),'#EAE8E3')
d=ImageDraw.Draw(sheet)
f=ImageFont.truetype(str(FONTROOT/'Rubik-Regular.ttf'),20)
for i,side in enumerate(['front','back']):
    x=60+i*800
    d.text((x,36),side.upper(),font=f,fill=INK)
    im=Image.open(OUT/f'{side}.png').resize((740,423),Image.Resampling.LANCZOS)
    sheet.paste(im,(x,80))
sheet.save(OUT/'front-and-back-preview.png')
print(pdf)

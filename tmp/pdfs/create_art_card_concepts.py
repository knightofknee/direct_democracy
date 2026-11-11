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
OUT = ROOT / 'output/pdf/art-card-concepts'
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
pdf=OUT/'art-card-concepts.pdf'
c=canvas.Canvas(str(pdf),pagesize=(W,H),pageCompression=1)
c.setTitle('direct democracy: Chicago | artwork concepts G H I')
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


pdfmetrics.registerFont(TTFont('SerifItalic',str(SYSTEM/'Georgia Italic.ttf')))
from reportlab.lib.utils import ImageReader

def artwork(letter):
    p=OUT/f'{letter}-art.png'
    im=Image.open(p)
    w,h=im.size
    scale=max(270/w,162/h)
    ww,hh=w*scale,h*scale
    c.drawImage(ImageReader(im),-9+(270-ww)/2,-9+(162-hh)/2,width=ww,height=hh)
    print(letter,'source',w,h,'effective dpi',round(72/scale))

def back(accent=RED):
    begin()
    text('direct democracy:',14,13,11.8,'Bold')
    text('Chicago',14,27,17,'SerifItalic',accent)
    text('Election information,',14,53,9.2)
    text('ward participation',14,65,9.2)
    text('and more!',14,77,9.2)
    text('Scan to take part.',14,94,9.5,'Bold',accent)
    code(147,12,92)
    text('waldgrave.com/directdemocracy',14,109,8.3,'Bold')
    text('The Waldgrave · waldgrave.com',14,119,7.2)
    text('We make free or at cost software.',14,128,6.8)
    end()

for letter in ['g','h','i']:
    begin()
    artwork(letter)
    color=WHITE if letter=='h' else INK
    text('direct democracy:',15,54 if letter=='i' else 15,10,'Rubik',color)
    text('Chicago',14,68 if letter=='i' else 29,24,'SerifItalic' if letter in ['g','h'] else 'Bold',color)
    end()
    back()
c.save()
poppler='/Users/briancarlisle/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/override/pdftoppm'
subprocess.run([poppler,'-r','600','-png',str(pdf),str(OUT/'render')],check=True,capture_output=True)
for i in range(6):
    im=Image.open(OUT/f'render-{i+1}.png').convert('RGB').crop((75,75,2175,1275))
    im.save(OUT/f'{"ghi"[i//2]}-{"front" if i%2==0 else "back"}.png',dpi=(600,600))
    (OUT/f'render-{i+1}.png').unlink()
sheet=Image.new('RGB',(1660,1726),'#EAE8E3')
d=ImageDraw.Draw(sheet)
ft=lambda n,b=False:ImageFont.truetype(str(FONTROOT/('Rubik-Bold.ttf' if b else 'Rubik-Regular.ttf')),n)
d.text((60,38),'direct democracy: Chicago',font=ft(36,True),fill=INK)
d.text((60,92),'ARTWORK CONCEPTS  /  FRONT + BACK',font=ft(17),fill='#59616A')
names=['G  /  City cat','H  /  Blue hour','I  /  Moving star']
for row in range(3):
    y=160+row*505
    d.text((60,y),names[row],font=ft(25,True),fill=INK)
    for col,side in enumerate(['front','back']):
        x=60+col*800
        im=Image.open(OUT/f'{"ghi"[row]}-{side}.png').resize((740,423),Image.Resampling.LANCZOS)
        sheet.paste(im,(x,y+46))
sheet.save(OUT/'art-concepts-preview.png')
print(pdf)

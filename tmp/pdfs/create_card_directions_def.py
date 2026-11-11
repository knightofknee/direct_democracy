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
OUT = ROOT / 'output/pdf/business-card-directions-def'
OUT.mkdir(parents=True, exist_ok=True)
FONTROOT = Path('/Users/briancarlisle/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/libreoffice-headless/libreoffice/LibreOfficeDev.app/Contents/Resources/fonts/truetype')
SYSTEM = Path('/System/Library/Fonts/Supplemental')
for name, path in [('Rubik',FONTROOT/'Rubik-Regular.ttf'),('Bold',FONTROOT/'Rubik-Bold.ttf'),('DIN',SYSTEM/'DIN Condensed Bold.ttf')]:
    pdfmetrics.registerFont(TTFont(name,str(path)))

BLUE='#41B6E6'; RED='#C8102E'; INK='#0F1B2A'; WHITE='#FFFFFF'
W,H=270,162
URL='https://www.waldgrave.com/directdemocracy'
qr=qrencoder.QRCode(None,qrencoder.QRErrorCorrectLevel.M)
qr.addData(URL); qr.make()
N=len(qr.modules)
pdf=OUT/'design-directions.pdf'
c=canvas.Canvas(str(pdf),pagesize=(W,H),pageCompression=1)
c.setTitle('direct democracy: Chicago | three card directions')
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


PALE='#B3DDF2'
def centered(s,y,size,font='Rubik',color=INK):
    text(s,(252-pdfmetrics.stringWidth(s,font,size))/2,y,size,font,color)

# D: a clean flag frame, with the flag illustration's pale blue.
begin()
rect(-9,-9,270,19,PALE)
rect(-9,136,270,17,PALE)
text('direct',17,18,29,'Bold')
text('democracy:',17,46,29,'Bold')
text('Chicago',17,76,29,'Bold',RED)
stars(157,91,9,23)
text('Election information,',17,112,9,'Rubik')
text('ward participation and more!',17,123,9,'Rubik')
end()
begin()
rect(-9,-9,270,15,PALE)
text('Your city.',13,21,21,'Bold')
text('Your say.',13,44,21,'Bold')
text('Scan to take part.',13,77,9.5,'Rubik')
stars(20,96,5.5,17)
code(147,12,92)
footer()
end()

# E: a centered lockup under a four-star flag masthead.
begin()
rect(-9,9,270,6,BLUE)
stars(66,30,10,40)
rect(-9,45,270,6,BLUE)
centered('direct democracy:',62,21,'Bold')
centered('Chicago',84,27,'Bold',RED)
centered('Election information,',115,8.5)
centered('ward participation and more!',125,8.5)
end()
begin()
rect(-9,0,270,6,BLUE)
code(12,11,92)
text('Your city.',121,24,20,'Bold')
text('Your say.',121,47,20,'Bold')
text('Scan to take part.',122,79,9,'Rubik')
footer()
end()

# F: four stars form a narrow pale-blue spine beside the title.
begin()
rect(-9,-9,61,162,PALE)
for yy in [29,57,85,113]:star(26,yy,10)
text('direct',69,20,26,'Rubik')
text('democracy:',69,47,26,'Bold')
text('Chicago',69,79,26,'Bold',RED)
text('Election information,',69,114,8.2,'Rubik')
text('ward participation and more!',69,124,8.2,'Rubik')
end()
begin()
rect(-9,-9,151,115,PALE)
text('Your city.',13,24,21,'Bold')
text('Your say.',13,47,21,'Bold')
text('Scan to take part.',13,79,9.5,'Rubik')
code(147,12,92)
footer()
end()
c.save()
poppler='/Users/briancarlisle/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/override/pdftoppm'
subprocess.run([poppler,'-r','600','-png',str(pdf),str(OUT/'render')],check=True,capture_output=True)
for i in range(6):
    im=Image.open(OUT/f'render-{i+1}.png').convert('RGB')
    im=im.crop((75,75,2175,1275))
    im.save(OUT/f'{"def"[i//2]}-{"front" if i%2==0 else "back"}.png',dpi=(600,600))
    (OUT/f'render-{i+1}.png').unlink()

# The contact sheet is a review artifact, not print artwork.
sheet=Image.new('RGB',(1660,1716),'#EAE8E3')
d=ImageDraw.Draw(sheet)
ft=lambda size,bold=False:ImageFont.truetype(str(FONTROOT/('Rubik-Bold.ttf' if bold else 'Rubik-Regular.ttf')),size)
d.text((60,40),'direct democracy: Chicago',font=ft(37,True),fill=INK)
d.text((60,94),'THREE CARD DIRECTIONS  /  FRONT + BACK',font=ft(17),fill='#59616A')
names=['D  /  The flag frame','E  /  Four-star masthead','F  /  The star column']
for row in range(3):
    y=160+row*505
    d.text((60,y),names[row],font=ft(25,True),fill=INK)
    for col,side in enumerate(['front','back']):
        x=60+col*800
        im=Image.open(OUT/f'{"def"[row]}-{side}.png')
        im=im.resize((740,423),Image.Resampling.LANCZOS)
        d.rectangle((x+5,y+51,x+745,y+474),fill='#D5D3CF')
        sheet.paste(im,(x,y+46))
sheet.save(OUT/'directions-def.png')
reader=PdfReader(pdf)
for i,p in enumerate(reader.pages):
    assert list(p.mediabox)==[0,0,270,162]
    assert list(p.trimbox)==[9,9,261,153]
    assert URL not in (p.extract_text() or '')
print(f'Created {pdf}; six trim previews and contact sheet. QR: {N} modules + 4-module quiet zone; data square {92*N/(N+8)/72:.3f} inches.')

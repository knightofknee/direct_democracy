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
OUT = ROOT / 'output/pdf/business-card-directions'
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
    p=c.beginPath()
    for i in range(12):
        a=math.pi/2+i*math.pi/6
        radius=r if i%2==0 else r*.268
        px=x+radius*math.cos(a); py=144-y+radius*math.sin(a)
        (p.moveTo if i==0 else p.lineTo)(px,py)
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
rect(-9,0,270,11,BLUE)
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

# B: one outsized star gives the blue face a screen-printed poster feel.
begin(BLUE)
star(237,48,69,RED)
text('direct',13,13,39,'DIN')
text('democracy:',13,49,39,'DIN')
text('Chicago',13,88,27,'Bold')
text('Election information,',13,115,9,'Rubik')
text('ward participation and more!',13,125,9,'Rubik')
end()
begin()
rect(-9,-9,151,115,BLUE)
text('Chicago',13,16,25,'DIN')
text('starts',13,41,25,'DIN')
text('with you.',13,66,25,'DIN')
text('Scan to take part.',13,94,8.5,'Rubik')
code(147,12,92)
footer()
end()

# C: red and white type, arranged as a compact art poster.
begin(RED)
text('direct',13,12,31,'Bold',WHITE)
text('democracy:',13,42,31,'Bold',WHITE)
rect(-9,77,270,34,WHITE)
text('Chicago',13,78,32,'Bold',RED)
stars(167,94,8,21)
text('Election information,',13,115,9,'Rubik',WHITE)
text('ward participation and more!',13,125,9,'Rubik',WHITE)
rect(233,-9,28,42,BLUE)
end()
begin()
rect(-9,-9,151,115,RED)
text('Make',13,17,25,'Bold',WHITE)
text('yourself',13,43,25,'Bold',WHITE)
text('heard.',13,69,25,'Bold',WHITE)
text('Scan to take part.',13,95,8.5,'Rubik',WHITE)
code(147,12,92)
rect(147,104,92,2,BLUE)
footer()
end()
c.save()

poppler='/Users/briancarlisle/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/override/pdftoppm'
subprocess.run([poppler,'-r','600','-png',str(pdf),str(OUT/'render')],check=True,capture_output=True)
for i in range(6):
    im=Image.open(OUT/f'render-{i+1}.png').convert('RGB')
    im=im.crop((75,75,2175,1275))
    im.save(OUT/f'{"abc"[i//2]}-{"front" if i%2==0 else "back"}.png',dpi=(600,600))
    (OUT/f'render-{i+1}.png').unlink()

# The contact sheet is a review artifact, not print artwork.
sheet=Image.new('RGB',(1660,1716),'#EAE8E3')
d=ImageDraw.Draw(sheet)
ft=lambda size,bold=False:ImageFont.truetype(str(FONTROOT/('Rubik-Bold.ttf' if bold else 'Rubik-Regular.ttf')),size)
d.text((60,40),'direct democracy: Chicago',font=ft(37,True),fill=INK)
d.text((60,94),'THREE CARD DIRECTIONS  /  FRONT + BACK',font=ft(17),fill='#59616A')
names=['A  /  Chicago, distilled','B  /  The neighborhood poster','C  /  Red letter']
for row in range(3):
    y=160+row*505
    d.text((60,y),names[row],font=ft(25,True),fill=INK)
    for col,side in enumerate(['front','back']):
        x=60+col*800
        im=Image.open(OUT/f'{"abc"[row]}-{side}.png')
        im=im.resize((740,423),Image.Resampling.LANCZOS)
        d.rectangle((x+5,y+51,x+745,y+474),fill='#D5D3CF')
        sheet.paste(im,(x,y+46))
sheet.save(OUT/'three-directions.png')
reader=PdfReader(pdf)
for i,p in enumerate(reader.pages):
    assert list(p.mediabox)==[0,0,270,162]
    assert list(p.trimbox)==[9,9,261,153]
    assert URL not in (p.extract_text() or '')
print(f'Created {pdf}; six trim previews and contact sheet. QR: {N} modules + 4-module quiet zone; data square {92*N/(N+8)/72:.3f} inches.')

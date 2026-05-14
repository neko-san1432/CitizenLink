import pypdf
import re

reader = pypdf.PdfReader(r'C:\Users\Neko-san\Downloads\Manuscript.docx.pdf')
text = '\n'.join([page.extract_text() for page in reader.pages])

matches = re.findall(r'.{0,300}True\s*Valid\s*Cluster.{0,300}', text, re.IGNORECASE | re.DOTALL)

with open(r'C:\Users\Neko-san\Documents\projects\DRIMS\scratch2.txt', 'w', encoding='utf-8') as f:
    f.write('\n===\n'.join(matches))

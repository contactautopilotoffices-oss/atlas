"""Read supplied workbook as data; preserve all source cells without executing them."""
import json
import pathlib
import xml.etree.ElementTree as ET
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent
SOURCE = pathlib.Path('/Users/lohit/Downloads/JindalX options.xlsx')
NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
with zipfile.ZipFile(SOURCE) as archive:
    strings = [''.join(x.itertext()) for x in ET.fromstring(archive.read('xl/sharedStrings.xml')).findall('m:si', NS)]
    cells = {}
    for cell in ET.fromstring(archive.read('xl/worksheets/sheet1.xml')).findall('.//m:sheetData/m:row/m:c', NS):
        value = cell.find('m:v', NS)
        cells[cell.attrib['r']] = strings[int(value.text)] if cell.attrib.get('t') == 's' else (value.text if value is not None else '')
records = [{cells.get('A'+str(row), ''): cells.get(column+str(row), '') for row in range(1, 17)} for column in 'BCDE']
(ROOT / 'source-options.json').write_text(json.dumps({'source': SOURCE.name, 'sheet': 'Sheet1', 'options': records}, indent=2))

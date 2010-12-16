from ConfigParser import ConfigParser

cp = ConfigParser()
cp.read('calligraphy.ini')

s1 = '<div style="background-color:%(col)s"><img style="width:40px;height:40px" src="tiles/rkterrain-finalopt/%(fn)s" />%(name)s</div>'
s2 = '<div style="background-color:%(col)s"><div style="width:40px;height:40px">%(name)s</div></div>'

for sect in cp.sections():
    d = {}
    d['col'] = cp.get(sect, 'backgroundrgb')
    if d['col'] == 'None':
        d['col'] = '#808080'
    fn = cp.get(sect, 'iconfilename')
    d['name'] = sect
    if fn:
        d['fn'] = fn
        print s1 % d
    else:
        print s2 % d

      

from ConfigParser import ConfigParser

cp = ConfigParser()
cp.read('tileset.ini')

for sect in cp.sections():
    col = = cp.get(sect, 'backgroundrgb')
    if d['col'] == 'null':
        d['col'] = None
    fn = cp.get(sect, 'iconfilename')
    d['name'] = sect
    if fn:
        d['fn'] = fn
        print s1 % d
    else:
        print s2 % d

      
for line in s.splitlines():
    splits = line.split()
    print splits[0],
    if splits[1] == 'null':
        print None
    else:
        print '#%06x' % (int(splits[1])+0x1000000,)

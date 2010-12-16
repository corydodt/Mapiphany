from ConfigParser import ConfigParser

cp = ConfigParser()
cp.read('tileset.ini')

for sect in cp.sections():
    col = cp.get(sect, 'backgroundrgb')
    if col == 'null':
        col = None
    else:
        col = '#%06x' % (int(col) + 0x1000000,)
    print sect, col


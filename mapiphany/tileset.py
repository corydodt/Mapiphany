"""
Manage tilesets and load the default tileset
"""
import sys
from ConfigParser import ConfigParser

from twisted.python.filepath import FilePath


class TileSet(FilePath):
    """
    A path which loads up a bunch of tilesets
    """
    def __init__(self, path):
        FilePath.__init__(self, path)
        self.ini = ConfigParser()
        self.ini.read(self.child('tileset.ini').path)
        self.name = self.path.split('/')[-1]

        # the default tileset comes from the parent directory and is built by
        # merging all the children
        if self.ini.has_section('default'):
            self.mergeChildren()
        else:
            for sect in self.ini.sections():
                self.ini.set(sect, 'set', self.name)

    def mergeChildren(self):
        """
        Find all child tilesets and merge their configuration into self
        """
        ini = self.ini
        order = ini.get('default', 'tilesetOrder').strip().split('\n')
        for _ts in reversed(order):
            ts = TileSet(self.child(_ts).path)
            for sect in ts.ini.sections():
                if not ini.has_section(sect):
                    ini.add_section(sect)

                # prevent overwriting a non-blank icon with blank
                if ini.has_option(sect, 'iconfilename') and not ts.ini.get(sect, 'iconfilename'):
                    continue

                for k, v in ts.ini.items(sect):
                    ini.set(sect, k, v)

    def __iter__(self):
        for sect in self.ini.sections():
            if sect == 'default':
                continue
            d = dict(self.ini.items(sect))
            yield sect, d


defaultSet = TileSet('tiles')


def run(argv=None):
    if argv is None:
        argv = sys.argv

    import simplejson
    jsFile = open('tileset.js', 'w')
    jsFile.write('var gTileset = ')

    cssFile = open('tileset.css', 'w')

    tileset = {}
    categories = {}
    for name, tile in defaultSet:
        tileset[name] = tile
        categories.setdefault(tile['category'], []).append(name)
        color = tile['backgroundrgb'].lower();
        cssFile.write('.%s { fill: %s; background-color: %s; }\n' % (
            name, color, color))
    simplejson.dump(tileset, jsFile, sort_keys=True, indent=4 * ' ')
    jsFile.write(';\nvar gTilesetCategories = ')
    categories = dict(map(lambda x: (x[0], sorted(x[1])), categories.items()))
    simplejson.dump(categories, jsFile, sort_keys=True, indent=4 * ' ')
    jsFile.write(';\n')


if __name__ == '__main__':
    run()

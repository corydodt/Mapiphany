"""
Twistd plugin to run Mapiphany.
"""

from zope.interface import implements

from twisted.python import usage
from twisted.plugin import IPlugin
from twisted.application.service import IServiceMaker
from twisted.application.internet import TCPServer

class Options(usage.Options):
    optParameters = [['port', 'p', '7000', 'Port to run on'],
                     ]


class MapiphanyServerMaker(object):
    """
    Framework boilerplate class: This is used by twistd to get the service
    class.

    Basically exists to hold the IServiceMaker interface so twistd can find
    the right makeService method to call.
    """
    implements(IServiceMaker, IPlugin)
    tapname = "mapiphany"
    description = "Mapiphany"
    options = Options

    def makeService(self, options):
        """
        Construct the mapiphany
        """
        from mapiphany.webserver import WebSite
        site = WebSite()
        ws = TCPServer(int(options['port']), site)
        ws.site = site
        return ws

# Now construct an object which *provides* the relevant interfaces

# The name of this variable is irrelevant, as long as there is *some*
# name bound to a provider of IPlugin and IServiceMaker.

serviceMaker = MapiphanyServerMaker()

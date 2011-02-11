
start:
	hg serve --daemon --port 28096 --pid-file hgserve.pid -E hgserve.log

stop:
	kill `cat hgserve.pid`


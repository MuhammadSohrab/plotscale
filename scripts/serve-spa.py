from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys


class SpaHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        requested = (Path(self.directory) / self.path.lstrip("/")).resolve()
        root = Path(self.directory).resolve()
        if (
            self.path != "/"
            and not requested.is_file()
            and root in requested.parents
        ):
            self.path = "/index.html"
        return super().do_GET()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5173
    dist = Path(__file__).resolve().parents[1] / "dist"
    handler = lambda *args, **kwargs: SpaHandler(*args, directory=dist, **kwargs)
    server = ThreadingHTTPServer(("127.0.0.1", port), handler)
    print(f"PlotScale preview: http://127.0.0.1:{port}")
    server.serve_forever()

import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Serverless API endpoint to convert binary DWG files into standard vector DXF text
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed. Use POST." });
  }

  try {
    let buffer: Buffer | null = null;

    if (Buffer.isBuffer(req.body)) {
      buffer = req.body;
    } else if (typeof req.body === "string") {
      // Base64 encoded payload
      buffer = Buffer.from(req.body, "base64");
    } else if (req.body && req.body.data) {
      if (Array.isArray(req.body.data)) {
        buffer = Buffer.from(req.body.data);
      } else if (typeof req.body.data === "string") {
        buffer = Buffer.from(req.body.data, "base64");
      }
    }

    if (!buffer || buffer.length < 12) {
      return res.status(400).json({ ok: false, error: "Invalid DWG file payload received." });
    }

    const header = buffer.subarray(0, 6).toString("ascii");
    const validHeaders = ["AC1014", "AC1015", "AC1018", "AC1021", "AC1024", "AC1027", "AC1032"];
    const isKnownDwg = validHeaders.some((h) => header.startsWith(h));

    if (!isKnownDwg && !header.startsWith("AC") && !header.startsWith("MC")) {
      return res.status(400).json({ ok: false, error: "Uploaded file is not a valid AutoCAD DWG drawing." });
    }

    // 1. Try LibreDWG parser (decodes all versions from R13 to AutoCAD 2024)
    try {
      const pkg = await import("@mlightcad/libredwg-web");
      const LibreDwg = pkg.LibreDwg;
      if (LibreDwg && typeof LibreDwg.create === "function") {
        const libredwg = await LibreDwg.create();
        const dwg = libredwg.dwg_read_data(new Uint8Array(buffer), pkg.Dwg_File_Type.DWG);
        if (dwg) {
          const db = libredwg.convert(dwg);
          libredwg.dwg_free(dwg);
          if (db && db.entities && db.entities.length > 0) {
            // Convert entities to DXF text format
            const dxfParts: string[] = ["0\nSECTION\n2\nENTITIES"];
            for (const ent of db.entities) {
              if (ent.type === "LINE" && ent.startPoint && ent.endPoint) {
                dxfParts.push(`0\nLINE\n8\n${ent.layer || "0"}\n10\n${ent.startPoint.x}\n20\n${ent.startPoint.y}\n11\n${ent.endPoint.x}\n21\n${ent.endPoint.y}`);
              } else if ((ent.type === "LWPOLYLINE" || ent.type === "POLYLINE") && ent.vertices && ent.vertices.length >= 2) {
                const isClosed = ent.isClosed === true || ent.flag === 1;
                dxfParts.push(`0\nLWPOLYLINE\n8\n${ent.layer || "0"}\n90\n${ent.vertices.length}\n70\n${isClosed ? 1 : 0}`);
                for (const v of ent.vertices) {
                  dxfParts.push(`10\n${v.x}\n20\n${v.y}`);
                }
              } else if (ent.type === "CIRCLE" && ent.center && ent.radius) {
                dxfParts.push(`0\nCIRCLE\n8\n${ent.layer || "0"}\n10\n${ent.center.x}\n20\n${ent.center.y}\n40\n${ent.radius}`);
              } else if (ent.type === "ARC" && ent.center && ent.radius) {
                dxfParts.push(`0\nARC\n8\n${ent.layer || "0"}\n10\n${ent.center.x}\n20\n${ent.center.y}\n40\n${ent.radius}\n50\n${ent.startAngle || 0}\n51\n${ent.endAngle || 360}`);
              } else if ((ent.type === "TEXT" || ent.type === "MTEXT") && ent.text) {
                const pt = ent.startPoint || ent.insertionPoint || { x: 0, y: 0 };
                dxfParts.push(`0\nTEXT\n8\n${ent.layer || "0"}\n10\n${pt.x}\n20\n${pt.y}\n40\n${ent.textHeight || 10}\n1\n${ent.text}`);
              }
            }
            dxfParts.push("0\nENDSEC\n0\nEOF");
            const dxf = dxfParts.join("\n");

            return res.status(200).json({
              ok: true,
              format: "DXF",
              dxf,
              version: header,
            });
          }
        }
      }
    } catch (libreErr) {
      console.warn("LibreDWG conversion error in serverless function:", libreErr);
    }

    // 2. Try libdxfrw WebAssembly / Node wrapper
    try {
      const createModule = (await import("@mlightcad/libdxfrw-web/dist/libdxfrw.js")).default;
      const libdxfrw = await createModule();
      const database = new libdxfrw.DRW_Database();
      const fileHandler = new libdxfrw.DRW_FileHandler();
      fileHandler.database = database;

      const uint8 = new Uint8Array(buffer);
      const imported = fileHandler.fileImport(uint8, database, false, false);

      if (imported) {
        const dxf = fileHandler.fileExport(libdxfrw.DRW_Version.AC1021, false, database, false);
        database.delete();
        fileHandler.delete();

        if (typeof dxf === "string" && dxf.length > 50) {
          return res.status(200).json({
            ok: true,
            format: "DXF",
            dxf,
            version: header,
          });
        }
      } else {
        database.delete();
        fileHandler.delete();
      }
    } catch (wasmErr) {
      console.warn("WASM conversion error in serverless function:", wasmErr);
    }

    // If direct C++ parser couldn't decode proprietary stream, return friendly status
    return res.status(422).json({
      ok: false,
      version: header,
      error: `AutoCAD Binary DWG (${header}) requires direct DXF export for 100% precision. AutoCAD me 'Save As' -> 'AutoCAD DXF' (DXFOUT) karke .dxf file upload karein.`,
    });
  } catch (err: any) {
    console.error("Serverless CAD conversion error:", err);
    return res.status(500).json({
      ok: false,
      error: err?.message || "Internal CAD converter error",
    });
  }
}

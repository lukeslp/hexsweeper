#!/usr/bin/env swift

import AppKit
import CoreGraphics

// Ten deliberately unrelated identity directions. These are concept studies,
// not production assets; each is opaque, front-facing, and safe to inspect at
// 32 px before one direction is refined into the final launcher/icon system.

let size: CGFloat = 1024
let out = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
    .appendingPathComponent("icon-variants/concepts", isDirectory: true)
try FileManager.default.createDirectory(at: out, withIntermediateDirectories: true)

extension NSColor {
    convenience init(hex: UInt32) {
        self.init(calibratedRed: CGFloat((hex >> 16) & 255) / 255,
                  green: CGFloat((hex >> 8) & 255) / 255,
                  blue: CGFloat(hex & 255) / 255, alpha: 1)
    }
}

let ink = NSColor(hex: 0x0B0D10)
let paper = NSColor(hex: 0xF3F1EA)
let blue = NSColor(hex: 0x79C7FF)
let violet = NSColor(hex: 0xA995FF)
let gold = NSColor(hex: 0xFFD166)
let mint = NSColor(hex: 0x7DE2C1)
let coral = NSColor(hex: 0xFF8175)

func hex(_ c: CGPoint, _ r: CGFloat, rotation: CGFloat = .pi / 6) -> CGPath {
    let path = CGMutablePath()
    for i in 0..<6 {
        let a = rotation + CGFloat(i) * .pi / 3
        let p = CGPoint(x: c.x + cos(a) * r, y: c.y + sin(a) * r)
        i == 0 ? path.move(to: p) : path.addLine(to: p)
    }
    path.closeSubpath()
    return path
}

func rounded(_ rect: CGRect, _ radius: CGFloat) -> CGPath {
    CGPath(roundedRect: rect, cornerWidth: radius, cornerHeight: radius, transform: nil)
}

func fill(_ context: CGContext, _ path: CGPath, _ color: NSColor) {
    context.addPath(path); context.setFillColor(color.cgColor); context.fillPath()
}

func stroke(_ context: CGContext, _ path: CGPath, _ color: NSColor, _ width: CGFloat) {
    context.addPath(path); context.setStrokeColor(color.cgColor); context.setLineWidth(width)
    context.setLineJoin(.round); context.setLineCap(.round); context.strokePath()
}

func background(_ context: CGContext, _ top: NSColor, _ bottom: NSColor) {
    let gradient = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(),
                              colors: [top.cgColor, bottom.cgColor] as CFArray,
                              locations: [0, 1])!
    context.drawLinearGradient(gradient, start: CGPoint(x: size / 2, y: size),
                               end: CGPoint(x: size / 2, y: 0), options: [])
}

func render(_ name: String, _ draw: (CGContext) -> Void) throws {
    let context = CGContext(data: nil, width: Int(size), height: Int(size),
                            bitsPerComponent: 8, bytesPerRow: 0,
                            space: CGColorSpaceCreateDeviceRGB(),
                            bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
    draw(context)
    let image = context.makeImage()!
    let png = NSBitmapImageRep(cgImage: image).representation(using: .png, properties: [:])!
    let url = out.appendingPathComponent("hexsweeper-concept-\(name)-1024.png")
    try png.write(to: url); print(url.path)
}

// 01: one mine cell, with six quiet neighbors — the literal game primitive.
try render("01-mine-cell") { c in
    background(c, NSColor(hex: 0x273B63), NSColor(hex: 0x101827))
    let center = CGPoint(x: 512, y: 512)
    for i in 0..<6 {
        let a = CGFloat(i) * .pi / 3
        fill(c, hex(CGPoint(x: center.x + cos(a) * 218, y: center.y + sin(a) * 218), 112), paper)
    }
    fill(c, hex(center, 150), ink)
    stroke(c, hex(center, 150), paper, 18)
    fill(c, hex(center, 58), coral)
}

// 02: three sweeping hex chevrons — a compact reading of “sweep”.
try render("02-sweep-chevron") { c in
    background(c, NSColor(hex: 0x1B1B2F), NSColor(hex: 0x0B0D10))
    for (i, color) in [paper, blue, violet].enumerated() {
        let x = CGFloat(306 + i * 150)
        let path = CGMutablePath(); path.move(to: CGPoint(x: x - 92, y: 512))
        path.addLine(to: CGPoint(x: x + 12, y: 616)); path.addLine(to: CGPoint(x: x + 116, y: 512))
        path.addLine(to: CGPoint(x: x + 12, y: 408)); path.closeSubpath()
        stroke(c, path, color, 42)
    }
}

// 03: six-cell bloom, an abstract version of the launcher’s flower.
try render("03-hex-bloom") { c in
    background(c, NSColor(hex: 0x26352D), NSColor(hex: 0x0B1614))
    let center = CGPoint(x: 512, y: 512)
    for i in 0..<6 {
        let a = CGFloat(i) * .pi / 3
        let p = CGPoint(x: center.x + cos(a) * 158, y: center.y + sin(a) * 158)
        fill(c, hex(p, 136), i.isMultiple(of: 2) ? paper : mint)
        stroke(c, hex(p, 136), ink, 15)
    }
    fill(c, hex(center, 136), ink)
    stroke(c, hex(center, 136), paper, 15)
}

// 04: a single negative-space S carved through a board.
try render("04-negative-s") { c in
    background(c, NSColor(hex: 0x402D55), NSColor(hex: 0x171022))
    let path = CGMutablePath(); path.move(to: CGPoint(x: 730, y: 725))
    path.addCurve(to: CGPoint(x: 300, y: 650), control1: CGPoint(x: 590, y: 780), control2: CGPoint(x: 370, y: 740))
    path.addCurve(to: CGPoint(x: 724, y: 372), control1: CGPoint(x: 264, y: 560), control2: CGPoint(x: 630, y: 505))
    path.addCurve(to: CGPoint(x: 302, y: 300), control1: CGPoint(x: 770, y: 240), control2: CGPoint(x: 430, y: 220))
    stroke(c, path, violet, 96); stroke(c, path, paper, 38)
    for p in [CGPoint(x: 248, y: 282), CGPoint(x: 772, y: 742)] { fill(c, hex(p, 52), ink); stroke(c, hex(p, 52), paper, 14) }
}

// 05: a framed board window with one revealed cell — bounded mode distilled.
try render("05-board-window") { c in
    background(c, NSColor(hex: 0xF2F0E9), NSColor(hex: 0xD5D9E2))
    fill(c, rounded(CGRect(x: 156, y: 156, width: 712, height: 712), 84), ink)
    stroke(c, rounded(CGRect(x: 156, y: 156, width: 712, height: 712), 84), paper, 20)
    for col in -2...2 { for row in -2...2 {
        let p = CGPoint(x: 512 + CGFloat(col) * 130, y: 512 + CGFloat(row) * 112 + (col.isMultiple(of: 2) ? 0 : 56))
        if hypot(p.x - 512, p.y - 512) < 290 { stroke(c, hex(p, 68), paper, 10) }
    }}
    fill(c, hex(CGPoint(x: 512, y: 512), 68), gold)
}

// 06: orbiting ring around a central hex — sphere without drawing a sphere.
try render("06-orbit-ring") { c in
    background(c, NSColor(hex: 0x253C4A), NSColor(hex: 0x0A141B))
    let center = CGPoint(x: 512, y: 512)
    stroke(c, CGPath(ellipseIn: CGRect(x: 218, y: 320, width: 588, height: 384), transform: nil), blue, 38)
    fill(c, hex(center, 156), paper); stroke(c, hex(center, 156), ink, 18)
    fill(c, hex(CGPoint(x: 512, y: 512), 54), ink)
    for a in [CGFloat(0.15), CGFloat(2.25), CGFloat(4.35)] {
        let p = CGPoint(x: center.x + cos(a) * 290, y: center.y + sin(a) * 190)
        fill(c, hex(p, 45), gold)
    }
}

// 07: split hex — topological choice as a stark two-tone mark.
try render("07-split-hex") { c in
    background(c, NSColor(hex: 0xE8E6DE), NSColor(hex: 0xC9D1DC))
    let p = hex(CGPoint(x: 512, y: 512), 342)
    fill(c, p, paper)
    c.saveGState(); c.addPath(p); c.clip()
    c.setFillColor(ink.cgColor); c.fill(CGRect(x: 512, y: 120, width: 400, height: 784)); c.restoreGState()
    stroke(c, p, ink, 24)
    fill(c, hex(CGPoint(x: 420, y: 512), 64), coral); fill(c, hex(CGPoint(x: 604, y: 512), 64), blue)
}

// 08: three connected hex nodes — the three game modes as a single system.
try render("08-three-nodes") { c in
    background(c, NSColor(hex: 0x102D2C), NSColor(hex: 0x071211))
    let nodes = [CGPoint(x: 342, y: 512), CGPoint(x: 600, y: 670), CGPoint(x: 600, y: 354)]
    let center = CGPoint(x: 512, y: 512)
    for p in nodes { stroke(c, { let x = CGMutablePath(); x.move(to: center); x.addLine(to: p); return x }(), mint, 28) }
    for (i, p) in nodes.enumerated() { fill(c, hex(p, 126), i == 0 ? paper : (i == 1 ? gold : coral)); stroke(c, hex(p, 126), ink, 18) }
    fill(c, hex(center, 66), ink)
}

// 09: stepped mine trail — gameplay progression represented as a diagonal.
try render("09-stepped-trail") { c in
    background(c, NSColor(hex: 0x3E3021), NSColor(hex: 0x17110B))
    for i in 0..<5 {
        let p = CGPoint(x: 278 + CGFloat(i) * 116, y: 314 + CGFloat(i) * 98)
        let r = CGFloat(114 - i * 10)
        fill(c, hex(p, r), i == 4 ? gold : paper); stroke(c, hex(p, r), ink, 17)
    }
    stroke(c, { let x = CGMutablePath(); x.move(to: CGPoint(x: 215, y: 250)); x.addLine(to: CGPoint(x: 805, y: 780)); return x }(), coral, 18)
}

// 10: layered prism — a hex board seen as a stack of playable planes.
try render("10-layered-prism") { c in
    background(c, NSColor(hex: 0x25223D), NSColor(hex: 0x0D0B17))
    let center = CGPoint(x: 512, y: 512)
    for (i, color) in [(0, violet), (1, blue), (2, paper)] {
        let p = CGPoint(x: center.x + CGFloat(i) * 54, y: center.y + CGFloat(i) * -54)
        let path = hex(p, 264 - CGFloat(i) * 26)
        fill(c, path, color); stroke(c, path, ink, 20)
    }
    fill(c, hex(CGPoint(x: 512, y: 512), 76), ink)
}

// Board-inspired studies ---------------------------------------------------

let relief = NSColor(hex: 0x8A8D92)
let mineRed = NSColor(hex: 0xFF1717)

func boardCells(center: CGPoint, sphereRadius: CGFloat, cellRadius: CGFloat) -> [(CGPoint, Int, Int)] {
    let xStep = cellRadius * 1.48
    let yStep = cellRadius * 1.70
    var result: [(CGPoint, Int, Int)] = []
    for q in -4...4 { for r in -4...4 {
        let x = CGFloat(q) * xStep
        let y = CGFloat(r) * yStep + (q.isMultiple(of: 2) ? 0 : yStep / 2)
        if hypot(x, y) < sphereRadius + cellRadius * 0.6 {
            result.append((CGPoint(x: center.x + x, y: center.y + y), q, r))
        }
    }}
    return result
}

func drawBoardSphere(
    _ c: CGContext,
    center: CGPoint,
    radius: CGFloat,
    cellRadius: CGFloat,
    lightOutside: Bool,
    frontier: (CGFloat, CGFloat) -> Bool,
    mines: Set<String>,
    islands: Set<String>,
    accent: NSColor = mineRed
) {
    let field = CGPath(ellipseIn: CGRect(x: center.x - radius, y: center.y - radius,
                                         width: radius * 2, height: radius * 2), transform: nil)
    c.saveGState(); c.addPath(field); c.clip()
    c.setFillColor((lightOutside ? paper : ink).cgColor)
    c.fill(CGRect(x: 0, y: 0, width: size, height: size))
    for (p, q, r) in boardCells(center: center, sphereRadius: radius, cellRadius: cellRadius) {
        let nx = (p.x - center.x) / radius
        let ny = (p.y - center.y) / radius
        let key = "\(q),\(r)"
        let isMine = mines.contains(key)
        let isIsland = islands.contains(key)
        let isDark = frontier(nx, ny)
        let cellColor: NSColor = isMine ? accent : (isIsland ? paper : (isDark ? ink : paper))
        let path = hex(p, cellRadius, rotation: .pi / 6)
        // A restrained offset edge gives the same raised-cell cue as the
        // screenshots without carrying over their unreadable numbers.
        c.saveGState(); c.translateBy(x: 8, y: -10)
        stroke(c, path, relief, isMine ? 10 : 13); c.restoreGState()
        fill(c, path, cellColor)
        stroke(c, path, isMine ? ink : (isDark ? relief : (lightOutside ? ink : paper)), 9)
    }
    c.restoreGState()
    stroke(c, field, lightOutside ? ink : paper, 17)
}

// 11: the screenshot’s most legible idea — a red mine cluster straddling a
// black/white reveal frontier.
try render("11-sphere-frontier") { c in
    background(c, ink, NSColor(hex: 0x1C222A))
    drawBoardSphere(c, center: CGPoint(x: 512, y: 512), radius: 386, cellRadius: 66,
                    lightOutside: false,
                    frontier: { x, y in x + 0.22 * sin(y * 3.0) > 0.04 },
                    mines: ["0,0", "1,0", "0,1"], islands: [])
}

// 12: a red three-cell mine trail on a dark, nearly spherical field.
try render("12-sphere-red-trail") { c in
    background(c, NSColor(hex: 0x20252C), ink)
    drawBoardSphere(c, center: CGPoint(x: 512, y: 512), radius: 378, cellRadius: 69,
                    lightOutside: false,
                    frontier: { x, y in x + y * 0.18 > 0.22 },
                    mines: ["-1,1", "0,1", "1,1"], islands: ["0,-2"])
}

// 13: one bright isolated cell in the black interior, like the white cells
// in the supplied close-ups.
try render("13-sphere-white-island") { c in
    background(c, NSColor(hex: 0x101317), ink)
    drawBoardSphere(c, center: CGPoint(x: 512, y: 512), radius: 390, cellRadius: 67,
                    lightOutside: false,
                    frontier: { x, y in x < -0.40 + 0.18 * sin(y * 2.0) },
                    mines: ["1,0"], islands: ["0,0", "0,-1"])
}

// 14: the inverse material treatment — dark cells cut into a white globe,
// with a single red mine acting as the focal interruption.
try render("14-sphere-inverse-mine") { c in
    background(c, NSColor(hex: 0xF7F5EF), NSColor(hex: 0xD2D6DB))
    drawBoardSphere(c, center: CGPoint(x: 512, y: 512), radius: 388, cellRadius: 66,
                    lightOutside: true,
                    frontier: { x, y in x > 0.13 + 0.20 * sin(y * 2.3) },
                    mines: ["0,0"], islands: [])
}

// 15: an off-centre crop, echoing the browser screenshots where the sphere
// runs beyond the frame and the board frontier becomes the composition.
try render("15-sphere-crop") { c in
    background(c, ink, NSColor(hex: 0x222930))
    drawBoardSphere(c, center: CGPoint(x: 416, y: 512), radius: 450, cellRadius: 69,
                    lightOutside: false,
                    frontier: { x, y in x > -0.04 + 0.19 * y },
                    mines: ["1,0", "1,1"], islands: ["0,-2"])
}

// 16: sparse ring geometry, preserving the spherical rim while discarding
// the middle so the mark stays legible at icon size.
try render("16-sphere-rim") { c in
    background(c, NSColor(hex: 0xF5F3EC), NSColor(hex: 0xD8DCE2))
    drawBoardSphere(c, center: CGPoint(x: 512, y: 512), radius: 386, cellRadius: 84,
                    lightOutside: true,
                    frontier: { x, y in hypot(x, y) > 0.52 },
                    mines: ["0,0", "1,0"], islands: ["0,0"])
}

// 17: stepped boundary, intentionally graphic rather than organic.
try render("17-sphere-stair") { c in
    background(c, ink, NSColor(hex: 0x1F242B))
    drawBoardSphere(c, center: CGPoint(x: 512, y: 512), radius: 390, cellRadius: 65,
                    lightOutside: false,
                    frontier: { x, y in x + 0.55 * y > 0.10 },
                    mines: ["-1,1", "0,1", "1,0"], islands: ["-1,-2"])
}

// 18: red mine cluster as a hole in an otherwise white/black diagonal board.
try render("18-sphere-red-hole") { c in
    background(c, NSColor(hex: 0xEDEBE4), NSColor(hex: 0xC8CDD5))
    drawBoardSphere(c, center: CGPoint(x: 512, y: 512), radius: 386, cellRadius: 67,
                    lightOutside: true,
                    frontier: { x, y in x + y * 0.30 < -0.08 },
                    mines: ["0,0", "1,0", "0,-1"], islands: ["-1,1"])
}

// 19: a quiet central mine, surrounded by a pronounced raised frontier.
try render("19-sphere-relief") { c in
    background(c, NSColor(hex: 0x252A32), ink)
    drawBoardSphere(c, center: CGPoint(x: 512, y: 512), radius: 380, cellRadius: 70,
                    lightOutside: false,
                    frontier: { x, y in x < 0.0 + 0.12 * sin(y * 3.4) },
                    mines: ["0,0"], islands: ["-2,0", "-1,0"])
}

// 20: the most reduced board study — six red/white cells around a dark core.
try render("20-sphere-core") { c in
    background(c, NSColor(hex: 0x11171E), ink)
    drawBoardSphere(c, center: CGPoint(x: 512, y: 512), radius: 372, cellRadius: 102,
                    lightOutside: false,
                    frontier: { x, y in x > 0.0 + y * 0.15 },
                    mines: ["0,0", "1,0"], islands: ["-1,0", "0,-1"])
}

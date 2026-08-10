#!/usr/bin/env swift

import AppKit
import CoreGraphics

// Deterministic Hexsweeper identity studies. These are deliberately drawn,
// not screenshot-derived: the same geometry can be reused by the web launcher.

let canvas: CGFloat = 1024
let outputDirectory = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
    .appendingPathComponent("icon-variants", isDirectory: true)

try FileManager.default.createDirectory(
    at: outputDirectory,
    withIntermediateDirectories: true
)

extension NSColor {
    convenience init(hex: UInt32) {
        self.init(
            calibratedRed: CGFloat((hex >> 16) & 0xff) / 255,
            green: CGFloat((hex >> 8) & 0xff) / 255,
            blue: CGFloat(hex & 0xff) / 255,
            alpha: 1
        )
    }
}

let ink = NSColor(hex: 0x0B0D10)
let paper = NSColor(hex: 0xF3F1EA)
let mid = NSColor(hex: 0x8D9399)

func hexPath(center: CGPoint, radius: CGFloat, inset: CGFloat = 0) -> CGPath {
    let path = CGMutablePath()
    let r = radius - inset
    for index in 0..<6 {
        let angle = CGFloat(index) * .pi / 3
        let point = CGPoint(
            x: center.x + cos(angle) * r,
            y: center.y + sin(angle) * r
        )
        index == 0 ? path.move(to: point) : path.addLine(to: point)
    }
    path.closeSubpath()
    return path
}

func sphereCells(center origin: CGPoint, radius: CGFloat, cellRadius: CGFloat) -> [(CGPoint, Int, Int)] {
    let xStep = cellRadius * 1.5
    let yStep = cellRadius * sqrt(3)
    var cells: [(CGPoint, Int, Int)] = []
    for column in -5...5 {
        for row in -5...5 {
            let x = CGFloat(column) * xStep
            let y = CGFloat(row) * yStep + (column.isMultiple(of: 2) ? 0 : yStep / 2)
            if hypot(x, y) < radius + cellRadius * 0.72 {
                cells.append((CGPoint(x: origin.x + x, y: origin.y + y), column, row))
            }
        }
    }
    return cells
}

func drawBackground(_ context: CGContext, top: NSColor, bottom: NSColor) {
    let colors = [top.cgColor, bottom.cgColor] as CFArray
    let gradient = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: colors, locations: [0, 1])!
    context.drawLinearGradient(
        gradient,
        start: CGPoint(x: canvas / 2, y: canvas),
        end: CGPoint(x: canvas / 2, y: 0),
        options: []
    )
}

func render(name: String, draw: (CGContext) -> Void) throws {
    guard let bitmap = CGContext(
        data: nil,
        width: Int(canvas),
        height: Int(canvas),
        bitsPerComponent: 8,
        bytesPerRow: 0,
        space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue
    ) else { fatalError("Unable to create icon context") }

    draw(bitmap)
    guard let cgImage = bitmap.makeImage() else { fatalError("Unable to render icon") }
    let representation = NSBitmapImageRep(cgImage: cgImage)
    guard let png = representation.representation(using: .png, properties: [:]) else {
        fatalError("Unable to encode icon")
    }
    let url = outputDirectory.appendingPathComponent("hexsweeper-\(name)-1024.png")
    try png.write(to: url)
    print(url.path)
}

func drawTiledSphere(
    _ context: CGContext,
    backgroundTop: NSColor,
    backgroundBottom: NSColor,
    base: NSColor,
    seam: NSColor,
    center: CGPoint = CGPoint(x: canvas / 2, y: canvas / 2),
    radius: CGFloat = 390,
    cellRadius: CGFloat = 86,
    fill: (CGPoint, Int, Int) -> NSColor,
    accent: ((CGContext) -> Void)? = nil,
    overlay: ((CGContext) -> Void)? = nil
) {
    drawBackground(context, top: backgroundTop, bottom: backgroundBottom)

    let sphere = CGPath(ellipseIn: CGRect(
        x: center.x - radius,
        y: center.y - radius,
        width: radius * 2,
        height: radius * 2
    ), transform: nil)

    context.saveGState()
    context.addPath(sphere)
    context.clip()
    context.setFillColor(base.cgColor)
    context.fill(CGRect(x: 0, y: 0, width: canvas, height: canvas))

    for (cellCenter, column, row) in sphereCells(center: center, radius: radius, cellRadius: cellRadius) {
        let path = hexPath(center: cellCenter, radius: cellRadius, inset: 2)
        context.addPath(path)
        context.setFillColor(fill(cellCenter, column, row).cgColor)
        context.fillPath()
        context.addPath(path)
        context.setStrokeColor(seam.cgColor)
        context.setLineWidth(13)
        context.setLineJoin(.round)
        context.strokePath()
    }
    accent?(context)
    context.restoreGState()

    context.addPath(sphere)
    context.setStrokeColor(seam.cgColor)
    context.setLineWidth(18)
    context.strokePath()
    overlay?(context)
}

func outlinedHex(_ context: CGContext, center: CGPoint, radius: CGFloat, color: NSColor) {
    context.addPath(hexPath(center: center, radius: radius, inset: 5))
    context.setStrokeColor(color.cgColor)
    context.setLineWidth(14)
    context.setLineJoin(.round)
    context.strokePath()
}

// A1 — the cleanest aperture: one decisive boundary and one surviving cell.
try render(name: "a1-clean-aperture") { context in
    drawTiledSphere(
        context,
        backgroundTop: NSColor(hex: 0x1A1E25),
        backgroundBottom: ink,
        base: paper,
        seam: ink,
        fill: { center, _, _ in
            let x = (center.x - canvas / 2) / 390
            let y = (center.y - canvas / 2) / 390
            let frontier = 0.06 + 0.24 * sin(y * 2.7) - 0.11 * y
            return x > frontier ? ink : paper
        },
        accent: { context in
            outlinedHex(context, center: CGPoint(x: 642, y: 508), radius: 55, color: paper)
        }
    )
}

// A2 — closer to the screenshots: several diminishing cells remain legible
// inside the swept area and imply a board receding around the sphere.
try render(name: "a2-trailing-aperture") { context in
    drawTiledSphere(
        context,
        backgroundTop: NSColor(hex: 0x1A1E25),
        backgroundBottom: ink,
        base: paper,
        seam: ink,
        fill: { center, _, _ in
            let x = (center.x - canvas / 2) / 390
            let y = (center.y - canvas / 2) / 390
            let frontier = 0.15 + 0.28 * sin(y * 2.5 + 0.25) - 0.08 * y
            return x > frontier ? ink : paper
        },
        accent: { context in
            outlinedHex(context, center: CGPoint(x: 635, y: 650), radius: 54, color: paper)
            outlinedHex(context, center: CGPoint(x: 704, y: 528), radius: 43, color: paper)
            outlinedHex(context, center: CGPoint(x: 681, y: 392), radius: 32, color: paper)
        }
    )
}

// A3 — a smaller, off-centre bite. More of the globe remains, while the dark
// shape still reads as an area the player has opened rather than a hemisphere.
try render(name: "a3-bite") { context in
    drawTiledSphere(
        context,
        backgroundTop: NSColor(hex: 0x1A1E25),
        backgroundBottom: ink,
        base: paper,
        seam: ink,
        fill: { center, _, _ in
            let x = (center.x - canvas / 2) / 390
            let y = (center.y - canvas / 2) / 390
            let inBite = pow((x - 0.42) / 0.66, 2) + pow((y + 0.02) / 0.84, 2) < 1
            return inBite ? ink : paper
        },
        accent: { context in
            outlinedHex(context, center: CGPoint(x: 646, y: 505), radius: 52, color: paper)
            outlinedHex(context, center: CGPoint(x: 720, y: 635), radius: 35, color: paper)
        }
    )
}

// B1 — the original vertical sweep, tightened so it reads as a deliberate
// cleared route instead of an empty half of the sphere.
try render(name: "b1-narrow-sweep") { context in
    drawTiledSphere(
        context,
        backgroundTop: NSColor(hex: 0xF7F4EC),
        backgroundBottom: NSColor(hex: 0xD9D6CF),
        base: ink,
        seam: paper,
        fill: { center, _, _ in
            let x = (center.x - canvas / 2) / 390
            let y = (center.y - canvas / 2) / 390
            let band = abs(x + 0.20 * sin(y * 3.0) + 0.06)
            return band < 0.23 ? paper : ink
        },
        accent: nil
    )
}

// B2 — diagonal motion gives the channel more energy without using literal
// depth or rotation; the globe itself remains front-facing.
try render(name: "b2-diagonal-sweep") { context in
    drawTiledSphere(
        context,
        backgroundTop: NSColor(hex: 0xF7F4EC),
        backgroundBottom: NSColor(hex: 0xD9D6CF),
        base: ink,
        seam: paper,
        fill: { center, _, _ in
            let x = (center.x - canvas / 2) / 390
            let y = (center.y - canvas / 2) / 390
            let band = abs(x - 0.36 * y + 0.14 * sin(y * 3.1))
            return band < 0.24 ? paper : ink
        },
        accent: nil
    )
}

// B3 — asymmetry drawn directly from the reference images: a broad opening
// starts at the top and narrows into a trail around the lower hemisphere.
try render(name: "b3-tapered-sweep") { context in
    drawTiledSphere(
        context,
        backgroundTop: NSColor(hex: 0xF7F4EC),
        backgroundBottom: NSColor(hex: 0xD9D6CF),
        base: ink,
        seam: paper,
        fill: { center, _, _ in
            let x = (center.x - canvas / 2) / 390
            let y = (center.y - canvas / 2) / 390
            let axis = x + 0.16 * sin(y * 2.8) + 0.04
            let width = 0.18 + 0.18 * max(0, y)
            return abs(axis) < width ? paper : ink
        },
        accent: { context in
            outlinedHex(context, center: CGPoint(x: 512, y: 506), radius: 48, color: ink)
        }
    )
}

func drawFuse(
    _ context: CGContext,
    points: [CGPoint],
    color: NSColor,
    underlay: NSColor? = nil,
    width: CGFloat = 28
) {
    guard let first = points.first else { return }
    let path = CGMutablePath()
    path.move(to: first)
    if points.count == 4 {
        path.addCurve(to: points[3], control1: points[1], control2: points[2])
    } else {
        for point in points.dropFirst() { path.addLine(to: point) }
    }
    context.setLineCap(.round)
    context.setLineJoin(.round)
    if let underlay {
        context.addPath(path)
        context.setStrokeColor(underlay.cgColor)
        context.setLineWidth(width + 18)
        context.strokePath()
    }
    context.addPath(path)
    context.setStrokeColor(color.cgColor)
    context.setLineWidth(width)
    context.strokePath()
}

func drawSpark(_ context: CGContext, center: CGPoint, color: NSColor) {
    let rays: [(CGFloat, CGFloat)] = [(-0.15, 70), (0.72, 62), (1.55, 56)]
    context.setStrokeColor(color.cgColor)
    context.setLineWidth(22)
    context.setLineCap(.round)
    for (angle, length) in rays {
        let start = CGPoint(x: center.x + cos(angle) * 23, y: center.y + sin(angle) * 23)
        let end = CGPoint(x: center.x + cos(angle) * length, y: center.y + sin(angle) * length)
        context.move(to: start)
        context.addLine(to: end)
        context.strokePath()
    }
}

// A1/Bomb 1 — the off-centre sphere is the bomb. A curved fuse leaves the
// dark aperture, so the explosive idea is visible without adding a badge.
try render(name: "a1-bomb-curved-fuse") { context in
    let origin = CGPoint(x: 438, y: 438)
    let sphereRadius: CGFloat = 352
    drawTiledSphere(
        context,
        backgroundTop: NSColor(hex: 0x1A1E25),
        backgroundBottom: ink,
        base: paper,
        seam: ink,
        center: origin,
        radius: sphereRadius,
        cellRadius: 78,
        fill: { cell, _, _ in
            let x = (cell.x - origin.x) / sphereRadius
            let y = (cell.y - origin.y) / sphereRadius
            let frontier = 0.06 + 0.22 * sin(y * 2.7) - 0.10 * y
            return x > frontier ? ink : paper
        },
        accent: { context in
            outlinedHex(context, center: CGPoint(x: 562, y: 434), radius: 49, color: paper)
        },
        overlay: { context in
            drawFuse(
                context,
                points: [CGPoint(x: 663, y: 699), CGPoint(x: 716, y: 783), CGPoint(x: 777, y: 759), CGPoint(x: 817, y: 832)],
                color: paper,
                underlay: ink,
                width: 27
            )
            drawSpark(context, center: CGPoint(x: 823, y: 843), color: paper)
        }
    )
}

// A1/Bomb 2 — the aperture contains a small bomb made from the same outlined
// cell language. The main circle moves left to give the fuse breathing room.
try render(name: "a1-bomb-in-aperture") { context in
    let origin = CGPoint(x: 447, y: 486)
    let sphereRadius: CGFloat = 354
    drawTiledSphere(
        context,
        backgroundTop: NSColor(hex: 0x1A1E25),
        backgroundBottom: ink,
        base: paper,
        seam: ink,
        center: origin,
        radius: sphereRadius,
        cellRadius: 78,
        fill: { cell, _, _ in
            let x = (cell.x - origin.x) / sphereRadius
            let y = (cell.y - origin.y) / sphereRadius
            let frontier = 0.02 + 0.25 * sin(y * 2.6) - 0.10 * y
            return x > frontier ? ink : paper
        },
        accent: { context in
            context.setFillColor(ink.cgColor)
            context.fillEllipse(in: CGRect(x: 548, y: 389, width: 138, height: 138))
            context.setStrokeColor(paper.cgColor)
            context.setLineWidth(15)
            context.strokeEllipse(in: CGRect(x: 548, y: 389, width: 138, height: 138))
            drawFuse(
                context,
                points: [CGPoint(x: 650, y: 501), CGPoint(x: 694, y: 546), CGPoint(x: 708, y: 581)],
                color: paper,
                width: 20
            )
            drawSpark(context, center: CGPoint(x: 713, y: 590), color: paper)
        }
    )
}

// A1/Bomb 3 — a raised hex cap, borrowed from the sphere screenshots, turns
// into the fuse. This is the least literal and most native to Hexsweeper.
try render(name: "a1-bomb-hex-cap") { context in
    let origin = CGPoint(x: 454, y: 421)
    let sphereRadius: CGFloat = 350
    drawTiledSphere(
        context,
        backgroundTop: NSColor(hex: 0x1A1E25),
        backgroundBottom: ink,
        base: paper,
        seam: ink,
        center: origin,
        radius: sphereRadius,
        cellRadius: 78,
        fill: { cell, _, _ in
            let x = (cell.x - origin.x) / sphereRadius
            let y = (cell.y - origin.y) / sphereRadius
            let frontier = 0.08 + 0.23 * sin(y * 2.7) - 0.12 * y
            return x > frontier ? ink : paper
        },
        accent: { context in
            outlinedHex(context, center: CGPoint(x: 575, y: 418), radius: 48, color: paper)
        },
        overlay: { context in
            let cap = CGPoint(x: 626, y: 692)
            context.addPath(hexPath(center: cap, radius: 48, inset: 2))
            context.setFillColor(paper.cgColor)
            context.fillPath()
            context.addPath(hexPath(center: cap, radius: 48, inset: 2))
            context.setStrokeColor(ink.cgColor)
            context.setLineWidth(16)
            context.strokePath()
            drawFuse(
                context,
                points: [CGPoint(x: 660, y: 726), CGPoint(x: 712, y: 774), CGPoint(x: 761, y: 782), CGPoint(x: 792, y: 835)],
                color: paper,
                underlay: ink,
                width: 25
            )
            drawSpark(context, center: CGPoint(x: 798, y: 846), color: paper)
        }
    )
}

func drawBombStudy(
    name: String,
    origin: CGPoint,
    sphereRadius: CGFloat,
    cellRadius: CGFloat,
    frontierBias: CGFloat,
    wave: CGFloat,
    phase: CGFloat,
    accentCenter: CGPoint,
    accentRadius: CGFloat,
    accentKind: Int,
    fuse: [CGPoint],
    fuseWidth: CGFloat,
    spark: Bool
) throws {
    try render(name: name) { context in
        drawTiledSphere(
            context,
            backgroundTop: NSColor(hex: 0x1A1E25),
            backgroundBottom: ink,
            base: paper,
            seam: ink,
            center: origin,
            radius: sphereRadius,
            cellRadius: cellRadius,
            fill: { cell, _, _ in
                let x = (cell.x - origin.x) / sphereRadius
                let y = (cell.y - origin.y) / sphereRadius
                let frontier = frontierBias + wave * sin(y * 2.7 + phase) - 0.10 * y
                return x > frontier ? ink : paper
            },
            accent: { context in
                if accentKind == 0 {
                    outlinedHex(context, center: accentCenter, radius: accentRadius, color: paper)
                } else if accentKind == 1 {
                    context.setFillColor(ink.cgColor)
                    context.fillEllipse(in: CGRect(
                        x: accentCenter.x - accentRadius,
                        y: accentCenter.y - accentRadius,
                        width: accentRadius * 2,
                        height: accentRadius * 2
                    ))
                    context.setStrokeColor(paper.cgColor)
                    context.setLineWidth(15)
                    context.strokeEllipse(in: CGRect(
                        x: accentCenter.x - accentRadius,
                        y: accentCenter.y - accentRadius,
                        width: accentRadius * 2,
                        height: accentRadius * 2
                    ))
                } else {
                    context.addPath(hexPath(center: accentCenter, radius: accentRadius, inset: 2))
                    context.setFillColor(paper.cgColor)
                    context.fillPath()
                    context.addPath(hexPath(center: accentCenter, radius: accentRadius, inset: 2))
                    context.setStrokeColor(ink.cgColor)
                    context.setLineWidth(16)
                    context.strokePath()
                }
            },
            overlay: { context in
                if !fuse.isEmpty {
                    drawFuse(context, points: fuse, color: paper, underlay: ink, width: fuseWidth)
                    if spark, let last = fuse.last {
                        drawSpark(context, center: last, color: paper)
                    }
                }
            }
        )
    }
}

// Eight more A1 studies. Each stays within the same monochrome, off-centre
// bomb/globe grammar while isolating one compositional variable.
try drawBombStudy(
    name: "a1-bomb-01-high-orbit", origin: CGPoint(x: 418, y: 492), sphereRadius: 350, cellRadius: 78,
    frontierBias: 0.02, wave: 0.21, phase: 0.2, accentCenter: CGPoint(x: 572, y: 492), accentRadius: 48,
    accentKind: 0, fuse: [CGPoint(x: 651, y: 738), CGPoint(x: 695, y: 786), CGPoint(x: 744, y: 807)], fuseWidth: 25, spark: true
)

try drawBombStudy(
    name: "a1-bomb-02-low-orbit", origin: CGPoint(x: 423, y: 382), sphereRadius: 345, cellRadius: 77,
    frontierBias: 0.10, wave: 0.25, phase: -0.25, accentCenter: CGPoint(x: 575, y: 404), accentRadius: 46,
    accentKind: 0, fuse: [CGPoint(x: 660, y: 654), CGPoint(x: 720, y: 735), CGPoint(x: 802, y: 770), CGPoint(x: 846, y: 844)], fuseWidth: 23, spark: true
)

try drawBombStudy(
    name: "a1-bomb-03-small-globe", origin: CGPoint(x: 414, y: 456), sphereRadius: 326, cellRadius: 72,
    frontierBias: 0.00, wave: 0.19, phase: 0.0, accentCenter: CGPoint(x: 565, y: 474), accentRadius: 44,
    accentKind: 1, fuse: [CGPoint(x: 638, y: 565), CGPoint(x: 686, y: 620), CGPoint(x: 728, y: 652)], fuseWidth: 18, spark: true
)

try drawBombStudy(
    name: "a1-bomb-04-wide-aperture", origin: CGPoint(x: 400, y: 454), sphereRadius: 368, cellRadius: 80,
    frontierBias: -0.08, wave: 0.27, phase: 0.45, accentCenter: CGPoint(x: 584, y: 476), accentRadius: 48,
    accentKind: 0, fuse: [CGPoint(x: 674, y: 706), CGPoint(x: 735, y: 770), CGPoint(x: 780, y: 781)], fuseWidth: 27, spark: false
)

try drawBombStudy(
    name: "a1-bomb-05-square-fuse", origin: CGPoint(x: 438, y: 430), sphereRadius: 350, cellRadius: 78,
    frontierBias: 0.04, wave: 0.23, phase: -0.15, accentCenter: CGPoint(x: 580, y: 454), accentRadius: 47,
    accentKind: 2, fuse: [CGPoint(x: 622, y: 703), CGPoint(x: 690, y: 758), CGPoint(x: 758, y: 758), CGPoint(x: 804, y: 822)], fuseWidth: 24, spark: true
)

try drawBombStudy(
    name: "a1-bomb-06-no-spark", origin: CGPoint(x: 432, y: 440), sphereRadius: 354, cellRadius: 79,
    frontierBias: 0.08, wave: 0.22, phase: 0.35, accentCenter: CGPoint(x: 583, y: 454), accentRadius: 50,
    accentKind: 0, fuse: [CGPoint(x: 671, y: 704), CGPoint(x: 730, y: 768), CGPoint(x: 815, y: 796)], fuseWidth: 28, spark: false
)

try drawBombStudy(
    name: "a1-bomb-07-ring-core", origin: CGPoint(x: 448, y: 468), sphereRadius: 350, cellRadius: 78,
    frontierBias: 0.05, wave: 0.24, phase: 0.1, accentCenter: CGPoint(x: 607, y: 494), accentRadius: 62,
    accentKind: 1, fuse: [CGPoint(x: 653, y: 544), CGPoint(x: 704, y: 588), CGPoint(x: 742, y: 608)], fuseWidth: 20, spark: true
)

try drawBombStudy(
    name: "a1-bomb-08-diagonal-cap", origin: CGPoint(x: 470, y: 402), sphereRadius: 348, cellRadius: 77,
    frontierBias: 0.12, wave: 0.22, phase: -0.4, accentCenter: CGPoint(x: 611, y: 430), accentRadius: 48,
    accentKind: 2, fuse: [CGPoint(x: 660, y: 697), CGPoint(x: 718, y: 741), CGPoint(x: 783, y: 734), CGPoint(x: 833, y: 783)], fuseWidth: 25, spark: true
)

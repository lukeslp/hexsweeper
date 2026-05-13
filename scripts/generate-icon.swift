#!/usr/bin/env swift
/**
 * File Purpose: Generate Hexodus iOS app icon variants (1024) and splash PNGs (2732) via AppKit.
 * Primary Functions: drawVariantA/B/C, write PNGs, optional --write-ios into Assets.xcassets.
 * Inputs/Outputs: Run from repo root: `swift scripts/generate-icon.swift` then `swift scripts/generate-icon.swift --write-ios`
 * App icons must rasterize to **1024×1024** pixels for the single-slot `AppIcon` catalog entry; splash PNGs use 2732 / 5464 / 8196 for 1× / 2× / 3× universal slots.
 */

import AppKit
import Foundation

let arg0 = CommandLine.arguments[0]
let scriptURL = URL(fileURLWithPath: arg0).standardizedFileURL
let repoRoot = scriptURL.deletingLastPathComponent().deletingLastPathComponent()
let variantsDir = repoRoot.appendingPathComponent("icon-variants", isDirectory: true)
let iconDest = repoRoot
  .appendingPathComponent("ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png")
let splashDir = repoRoot.appendingPathComponent("ios/App/App/Assets.xcassets/Splash.imageset")

func drawLinearGradient(
  context: CGContext,
  start: CGPoint,
  end: CGPoint,
  colors: [(CGFloat, NSColor)]
) {
  let space = CGColorSpaceCreateDeviceRGB()
  let locs = colors.map(\.0) as [CGFloat]
  let cgColors = colors.map { $0.1.cgColor } as CFArray
  guard let gradient = CGGradient(
    colorsSpace: space,
    colors: cgColors,
    locations: locs
  ) else { return }
  context.drawLinearGradient(gradient, start: start, end: end, options: [])
}

func flatHexPath(center: CGPoint, radius: CGFloat) -> NSBezierPath {
  let path = NSBezierPath()
  for k in 0..<6 {
    let a = CGFloat.pi / 6 + CGFloat(k) * 2 * CGFloat.pi / 6 - CGFloat.pi / 2
    let x = center.x + radius * cos(a)
    let y = center.y + radius * sin(a)
    if k == 0 { path.move(to: NSPoint(x: x, y: y)) }
    else { path.line(to: NSPoint(x: x, y: y)) }
  }
  path.close()
  return path
}

func renderImage(size: CGFloat, draw: (CGContext, CGFloat) -> Void) -> NSImage {
  let img = NSImage(size: NSSize(width: size, height: size))
  img.lockFocus()
  guard let ctx = NSGraphicsContext.current?.cgContext else {
    img.unlockFocus()
    return img
  }
  draw(ctx, size)
  img.unlockFocus()
  return img
}

/// Rasterize to exact pixel dimensions. `NSImage.lockFocus()` uses the display
/// backing scale, so TIFF export can be 2× the logical size — Xcode then
/// rejects a 1024×1024 `AppIcon` slot. Always pass explicit pixel width/height.
func savePNG(_ image: NSImage, url: URL, pixelWidth: Int, pixelHeight: Int) throws {
  try FileManager.default.createDirectory(
    at: url.deletingLastPathComponent(),
    withIntermediateDirectories: true
  )
  let w = pixelWidth
  let h = pixelHeight
  guard let rep = NSBitmapImageRep(
    bitmapDataPlanes: nil,
    pixelsWide: w,
    pixelsHigh: h,
    bitsPerSample: 8,
    samplesPerPixel: 4,
    hasAlpha: true,
    isPlanar: false,
    colorSpaceName: .deviceRGB,
    bytesPerRow: 4 * w,
    bitsPerPixel: 32
  ) else {
    throw NSError(domain: "hexodus.icon", code: 1)
  }
  NSGraphicsContext.saveGraphicsState()
  defer { NSGraphicsContext.restoreGraphicsState() }
  guard let ctx = NSGraphicsContext(bitmapImageRep: rep) else {
    throw NSError(domain: "hexodus.icon", code: 2)
  }
  NSGraphicsContext.current = ctx
  ctx.imageInterpolation = .high
  image.draw(
    in: NSRect(x: 0, y: 0, width: w, height: h),
    from: NSRect.zero,
    operation: .sourceOver,
    fraction: 1.0
  )
  guard let data = rep.representation(using: .png, properties: [:]) else {
    throw NSError(domain: "hexodus.icon", code: 3)
  }
  try data.write(to: url)
}

// Variant A — single hex + iris “eye” on dark teal gradient
func variantA(size: CGFloat) -> NSImage {
  renderImage(size: size) { ctx, s in
    let bgStart = NSPoint(x: 0, y: s)
    let bgEnd = NSPoint(x: s, y: 0)
    drawLinearGradient(
      context: ctx,
      start: bgStart,
      end: bgEnd,
      colors: [
        (0, NSColor(red: 0.04, green: 0.04, blue: 0.04, alpha: 1)),
        (1, NSColor(red: 0.04, green: 0.09, blue: 0.12, alpha: 1)),
      ]
    )
    let c = CGPoint(x: s / 2, y: s / 2)
    let hexR = s * 0.38
    let hexPath = flatHexPath(center: c, radius: hexR)
    ctx.saveGState()
    ctx.setStrokeColor(NSColor(red: 0.12, green: 0.85, blue: 0.55, alpha: 1).cgColor)
    ctx.setLineWidth(s * 0.022)
    ctx.addPath(hexPath.cgPath)
    ctx.strokePath()
    ctx.restoreGState()

    let irisR = s * 0.14
    let eyeRect = CGRect(
      x: c.x - irisR,
      y: c.y - irisR,
      width: irisR * 2,
      height: irisR * 2
    )
    ctx.saveGState()
    ctx.addEllipse(in: eyeRect)
    ctx.clip()
    let colors = [
      NSColor(red: 0.02, green: 0.25, blue: 0.14, alpha: 1).cgColor,
      NSColor(red: 0.15, green: 0.95, blue: 0.55, alpha: 1).cgColor,
      NSColor(red: 0.02, green: 0.12, blue: 0.08, alpha: 1).cgColor,
    ] as CFArray
    let locs: [CGFloat] = [0, 0.55, 1]
    let space = CGColorSpaceCreateDeviceRGB()
    if let g = CGGradient(colorsSpace: space, colors: colors, locations: locs) {
      ctx.drawRadialGradient(
        g,
        startCenter: c,
        startRadius: 0,
        endCenter: c,
        endRadius: irisR,
        options: []
      )
    }
    ctx.resetClip()
    ctx.restoreGState()

    let pupil = CGRect(x: c.x - s * 0.03, y: c.y - s * 0.03, width: s * 0.06, height: s * 0.06)
    ctx.setFillColor(NSColor.black.withAlphaComponent(0.85).cgColor)
    ctx.fillEllipse(in: pupil)
  }
}

// Variant B — three mini hex tiles (unknown / revealed / marked mood)
func variantB(size: CGFloat) -> NSImage {
  renderImage(size: size) { ctx, s in
    ctx.setFillColor(NSColor.black.withAlphaComponent(0.92).cgColor)
    ctx.fill(CGRect(x: 0, y: 0, width: s, height: s))
    let centers: [CGPoint] = [
      CGPoint(x: s * 0.32, y: s * 0.52),
      CGPoint(x: s * 0.52, y: s * 0.38),
      CGPoint(x: s * 0.72, y: s * 0.52),
    ]
    let colors: [NSColor] = [
      NSColor(red: 0.45, green: 0.55, blue: 0.65, alpha: 1),
      NSColor(red: 0.2, green: 0.85, blue: 0.55, alpha: 1),
      NSColor(red: 0.95, green: 0.35, blue: 0.45, alpha: 1),
    ]
    let r = s * 0.12
    for (i, c) in centers.enumerated() {
      let p = flatHexPath(center: c, radius: r)
      ctx.setStrokeColor(colors[i].cgColor)
      ctx.setLineWidth(s * 0.012)
      ctx.addPath(p.cgPath)
      ctx.strokePath()
    }
  }
}

// Variant C — glitch fracture across a hex outline
func variantC(size: CGFloat) -> NSImage {
  renderImage(size: size) { ctx, s in
    ctx.setFillColor(NSColor(red: 0.03, green: 0.03, blue: 0.04, alpha: 1).cgColor)
    ctx.fill(CGRect(x: 0, y: 0, width: s, height: s))
    let c = CGPoint(x: s / 2, y: s / 2)
    let hexR = s * 0.36
    let hexPath = flatHexPath(center: c, radius: hexR)
    ctx.setStrokeColor(NSColor(red: 0.2, green: 0.95, blue: 0.55, alpha: 0.95).cgColor)
    ctx.setLineWidth(s * 0.028)
    ctx.addPath(hexPath.cgPath)
    ctx.strokePath()

    ctx.setStrokeColor(NSColor.white.withAlphaComponent(0.35).cgColor)
    ctx.setLineWidth(s * 0.01)
    for i in 0..<5 {
      let y = s * 0.25 + CGFloat(i) * s * 0.12
      ctx.move(to: CGPoint(x: s * 0.18, y: y))
      ctx.addLine(to: CGPoint(x: s * 0.82, y: y + s * 0.04))
      ctx.strokePath()
    }
  }
}

func splashFromIcon(size: CGFloat) -> NSImage {
  renderImage(size: size) { ctx, s in
    ctx.setFillColor(NSColor(red: 0.04, green: 0.04, blue: 0.04, alpha: 1).cgColor)
    ctx.fill(CGRect(x: 0, y: 0, width: s, height: s))
    let c = CGPoint(x: s / 2, y: s / 2)
    let hexR = s * 0.22
    let hexPath = flatHexPath(center: c, radius: hexR)
    ctx.setStrokeColor(NSColor(red: 0.15, green: 0.85, blue: 0.5, alpha: 0.9).cgColor)
    ctx.setLineWidth(s * 0.012)
    ctx.addPath(hexPath.cgPath)
    ctx.strokePath()
  }
}

try FileManager.default.createDirectory(at: variantsDir, withIntermediateDirectories: true)

let a = variantA(size: 1024)
let b = variantB(size: 1024)
let c = variantC(size: 1024)

try savePNG(a, url: variantsDir.appendingPathComponent("hexodus-icon-variant-a.png"), pixelWidth: 1024, pixelHeight: 1024)
try savePNG(b, url: variantsDir.appendingPathComponent("hexodus-icon-variant-b.png"), pixelWidth: 1024, pixelHeight: 1024)
try savePNG(c, url: variantsDir.appendingPathComponent("hexodus-icon-variant-c.png"), pixelWidth: 1024, pixelHeight: 1024)

print("Wrote 1024 PNGs to \(variantsDir.path)")

if CommandLine.arguments.contains("--write-ios") {
  try savePNG(a, url: iconDest, pixelWidth: 1024, pixelHeight: 1024)
  let sp1 = splashFromIcon(size: 2732)
  let sp2 = splashFromIcon(size: 5464)
  let sp3 = splashFromIcon(size: 8196)
  try savePNG(
    sp1, url: splashDir.appendingPathComponent("splash-2732x2732-2.png"),
    pixelWidth: 2732, pixelHeight: 2732)
  try savePNG(
    sp2, url: splashDir.appendingPathComponent("splash-2732x2732-1.png"),
    pixelWidth: 5464, pixelHeight: 5464)
  try savePNG(
    sp3, url: splashDir.appendingPathComponent("splash-2732x2732.png"),
    pixelWidth: 8196, pixelHeight: 8196)
  print("Installed AppIcon + splash PNGs into ios/App/App/Assets.xcassets/")
}

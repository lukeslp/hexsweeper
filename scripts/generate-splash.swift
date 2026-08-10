#!/usr/bin/env swift

import AppKit
import CoreGraphics

// Build the launch-screen artwork from the supplied literal infinite-board
// capture. The source is cropped to a square around the board's active middle
// so LaunchScreen's scaleAspectFill keeps the gameplay texture on every device.

let repo = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let sourceURL = repo.appendingPathComponent("design/splash-board-source.png")
let splashSet = repo.appendingPathComponent("ios/App/App/Assets.xcassets/Splash.imageset")
let source = NSImage(contentsOf: sourceURL)!
var proposed = NSRect(x: 0, y: 0, width: source.size.width, height: source.size.height)
let sourceCG = source.cgImage(forProposedRect: &proposed, context: nil, hints: nil)!

let side = min(sourceCG.width, sourceCG.height)
let cropY = max(0, (sourceCG.height - side) / 2)
let crop = sourceCG.cropping(to: CGRect(x: 0, y: cropY, width: side, height: side))!

let slots: [(String, Int)] = [
    ("splash-2732x2732-2.png", 2732),
    ("splash-2732x2732-1.png", 5464),
    ("splash-2732x2732.png", 8196)
]

for (filename, size) in slots {
    let context = CGContext(
        data: nil,
        width: size,
        height: size,
        bitsPerComponent: 8,
        bytesPerRow: 0,
        space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue
    )!
    context.setFillColor(NSColor(hex: 0xF3F4F6).cgColor)
    context.fill(CGRect(x: 0, y: 0, width: size, height: size))
    context.interpolationQuality = .high
    context.draw(crop, in: CGRect(x: 0, y: 0, width: size, height: size))
    let rep = NSBitmapImageRep(cgImage: context.makeImage()!)
    try! rep.representation(using: .png, properties: [:])!
        .write(to: splashSet.appendingPathComponent(filename))
    print(splashSet.appendingPathComponent(filename).path)
}

extension NSColor {
    convenience init(hex: UInt32) {
        self.init(calibratedRed: CGFloat((hex >> 16) & 255) / 255,
                  green: CGFloat((hex >> 8) & 255) / 255,
                  blue: CGFloat(hex & 255) / 255, alpha: 1)
    }
}

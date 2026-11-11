import Foundation
import CoreImage
import AppKit

let expected = "https://www.waldgrave.com/directdemocracy"
for name in ["a", "b", "c"] {
    let url = URL(fileURLWithPath: "/Users/briancarlisle/repos/direct-democracy/output/pdf/business-card-directions/\(name)-back.png")
    let image = NSImage(contentsOf: url)!
    var rect = NSRect(origin: .zero, size: image.size)
    let cg = image.cgImage(forProposedRect: &rect, context: nil, hints: nil)!
    let detector = CIDetector(ofType: CIDetectorTypeQRCode, context: CIContext(options: [.useSoftwareRenderer: true]), options: [CIDetectorAccuracy: CIDetectorAccuracyHigh])!
    let values = detector.features(in: CIImage(cgImage: cg)).compactMap { ($0 as? CIQRCodeFeature)?.messageString }
    guard values == [expected] else { fatalError("QR verification failed: \(name): \(values)") }
    print("\(name): decoded \(expected)")
}

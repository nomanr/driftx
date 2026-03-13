import XCTest

final class DriftxCompanionUITests: XCTestCase {
    func testCompanionServer() throws {
        let port = UInt16(ProcessInfo.processInfo.environment["DRIFTX_PORT"] ?? "8300") ?? 8300
        let app = XCUIApplication(bundleIdentifier: "com.apple.springboard")

        let server = CompanionServer(port: port, app: app)
        server.start()

        let exp = expectation(description: "Server running")
        exp.isInverted = true
        wait(for: [exp], timeout: 86400)
    }
}

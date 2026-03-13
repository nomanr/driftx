import Foundation
import XCTest

enum InteractionEndpoint {
    static func register(on router: Router, app: XCUIApplication) {
        router.register(method: "POST", path: "/tap") { body in
            guard let json = parseJSONBody(body),
                  let x = json["x"] as? Double,
                  let y = json["y"] as? Double else {
                return (400, jsonResponse(["success": false, "error": "Missing x or y"]))
            }
            DispatchQueue.main.sync {
                let normalized = app.coordinate(withNormalizedOffset: CGVector(dx: 0, dy: 0))
                let point = normalized.withOffset(CGVector(dx: x, dy: y))
                point.tap()
            }
            return (200, jsonResponse(["success": true]))
        }

        router.register(method: "POST", path: "/longPress") { body in
            guard let json = parseJSONBody(body),
                  let x = json["x"] as? Double,
                  let y = json["y"] as? Double else {
                return (400, jsonResponse(["success": false, "error": "Missing x or y"]))
            }
            let duration = json["duration"] as? Double ?? 1.0
            DispatchQueue.main.sync {
                let normalized = app.coordinate(withNormalizedOffset: CGVector(dx: 0, dy: 0))
                let point = normalized.withOffset(CGVector(dx: x, dy: y))
                point.press(forDuration: duration)
            }
            return (200, jsonResponse(["success": true]))
        }

        router.register(method: "POST", path: "/swipe") { body in
            guard let json = parseJSONBody(body),
                  let fromX = json["fromX"] as? Double,
                  let fromY = json["fromY"] as? Double,
                  let toX = json["toX"] as? Double,
                  let toY = json["toY"] as? Double else {
                return (400, jsonResponse(["success": false, "error": "Missing fromX, fromY, toX, or toY"]))
            }
            let duration = json["duration"] as? Double ?? 0.3
            DispatchQueue.main.sync {
                let normalized = app.coordinate(withNormalizedOffset: CGVector(dx: 0, dy: 0))
                let start = normalized.withOffset(CGVector(dx: fromX, dy: fromY))
                let end = normalized.withOffset(CGVector(dx: toX, dy: toY))
                start.press(forDuration: duration, thenDragTo: end)
            }
            return (200, jsonResponse(["success": true]))
        }

        router.register(method: "POST", path: "/type") { body in
            guard let json = parseJSONBody(body),
                  let text = json["text"] as? String else {
                return (400, jsonResponse(["success": false, "error": "Missing text"]))
            }
            DispatchQueue.main.sync {
                app.typeText(text)
            }
            return (200, jsonResponse(["success": true]))
        }

        router.register(method: "POST", path: "/find") { body in
            guard let json = parseJSONBody(body),
                  let text = json["text"] as? String, !text.isEmpty else {
                return (400, jsonResponse(["success": false, "error": "Missing text"]))
            }

            let result: (Bool, [String: Any]) = DispatchQueue.main.sync {
                let queries: [XCUIElementQuery] = [
                    app.staticTexts,
                    app.buttons,
                    app.links,
                    app.otherElements,
                ]

                for query in queries {
                    let match = query[text]
                    if match.exists {
                        let frame = match.frame
                        return (true, [
                            "success": true,
                            "frame": [
                                "x": frame.origin.x,
                                "y": frame.origin.y,
                                "width": frame.size.width,
                                "height": frame.size.height,
                            ],
                        ])
                    }
                }

                for query in queries {
                    let predicate = NSPredicate(format: "label CONTAINS[c] %@", text)
                    let matches = query.matching(predicate)
                    if matches.count > 0 {
                        let match = matches.firstMatch
                        let frame = match.frame
                        return (true, [
                            "success": true,
                            "frame": [
                                "x": frame.origin.x,
                                "y": frame.origin.y,
                                "width": frame.size.width,
                                "height": frame.size.height,
                            ],
                        ])
                    }
                }

                return (false, ["success": false, "error": "Element not found: \(text)"])
            }

            return (result.0 ? 200 : 404, jsonResponse(result.1))
        }

        router.register(method: "POST", path: "/keyEvent") { body in
            guard let json = parseJSONBody(body),
                  let key = json["key"] as? String else {
                return (400, jsonResponse(["success": false, "error": "Missing key"]))
            }

            let button: XCUIDevice.Button?
            switch key.lowercased() {
            case "home":
                button = .home
            default:
                button = nil
            }

            guard let deviceButton = button else {
                return (400, jsonResponse(["success": false, "error": "Unknown key: \(key)"]))
            }

            DispatchQueue.main.sync {
                XCUIDevice.shared.press(deviceButton)
            }
            return (200, jsonResponse(["success": true]))
        }
    }
}

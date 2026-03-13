import Foundation
import XCTest

enum HierarchyEndpoint {
    private static let maxDepth = 30

    static func register(on router: Router, app: XCUIApplication) {
        router.register(method: "GET", path: "/hierarchy") { _ in
            do {
                let snapshot: XCUIElementSnapshot = try DispatchQueue.main.sync {
                    try app.snapshot()
                }
                let tree = walk(snapshot, depth: 0)
                let data = try JSONSerialization.data(withJSONObject: [tree], options: [])
                return (200, data)
            } catch {
                return (500, jsonResponse(["error": error.localizedDescription]))
            }
        }
    }

    private static func walk(_ snap: XCUIElementSnapshot, depth: Int) -> [String: Any] {
        var node: [String: Any] = [
            "elementType": elementTypeName(snap.elementType),
            "identifier": snap.identifier,
            "label": snap.label,
            "frame": [
                "x": snap.frame.origin.x,
                "y": snap.frame.origin.y,
                "width": snap.frame.size.width,
                "height": snap.frame.size.height
            ],
            "isEnabled": snap.isEnabled
        ]

        if let value = snap.value {
            node["value"] = "\(value)"
        }

        if depth < maxDepth {
            let children = snap.children.map { child in
                walk(child, depth: depth + 1)
            }
            node["children"] = children
        } else {
            node["children"] = [] as [[String: Any]]
        }

        return node
    }

    private static func elementTypeName(_ type: XCUIElement.ElementType) -> String {
        switch type {
        case .any: return "any"
        case .other: return "other"
        case .application: return "application"
        case .group: return "group"
        case .window: return "window"
        case .sheet: return "sheet"
        case .drawer: return "drawer"
        case .alert: return "alert"
        case .dialog: return "dialog"
        case .button: return "button"
        case .radioButton: return "radioButton"
        case .radioGroup: return "radioGroup"
        case .checkBox: return "checkBox"
        case .disclosureTriangle: return "disclosureTriangle"
        case .popUpButton: return "popUpButton"
        case .comboBox: return "comboBox"
        case .menuButton: return "menuButton"
        case .toolbarButton: return "toolbarButton"
        case .popover: return "popover"
        case .keyboard: return "keyboard"
        case .key: return "key"
        case .navigationBar: return "navigationBar"
        case .tabBar: return "tabBar"
        case .tabGroup: return "tabGroup"
        case .toolbar: return "toolbar"
        case .statusBar: return "statusBar"
        case .table: return "table"
        case .tableRow: return "tableRow"
        case .tableColumn: return "tableColumn"
        case .outline: return "outline"
        case .outlineRow: return "outlineRow"
        case .browser: return "browser"
        case .collectionView: return "collectionView"
        case .slider: return "slider"
        case .pageIndicator: return "pageIndicator"
        case .progressIndicator: return "progressIndicator"
        case .activityIndicator: return "activityIndicator"
        case .segmentedControl: return "segmentedControl"
        case .picker: return "picker"
        case .pickerWheel: return "pickerWheel"
        case .switch: return "switch"
        case .toggle: return "toggle"
        case .link: return "link"
        case .image: return "image"
        case .icon: return "icon"
        case .searchField: return "searchField"
        case .scrollView: return "scrollView"
        case .scrollBar: return "scrollBar"
        case .staticText: return "staticText"
        case .textField: return "textField"
        case .secureTextField: return "secureTextField"
        case .datePicker: return "datePicker"
        case .textView: return "textView"
        case .menu: return "menu"
        case .menuItem: return "menuItem"
        case .menuBar: return "menuBar"
        case .menuBarItem: return "menuBarItem"
        case .map: return "map"
        case .webView: return "webView"
        case .incrementArrow: return "incrementArrow"
        case .decrementArrow: return "decrementArrow"
        case .timeline: return "timeline"
        case .ratingIndicator: return "ratingIndicator"
        case .valueIndicator: return "valueIndicator"
        case .splitGroup: return "splitGroup"
        case .splitter: return "splitter"
        case .relevanceIndicator: return "relevanceIndicator"
        case .colorWell: return "colorWell"
        case .helpTag: return "helpTag"
        case .matte: return "matte"
        case .dockItem: return "dockItem"
        case .ruler: return "ruler"
        case .rulerMarker: return "rulerMarker"
        case .grid: return "grid"
        case .levelIndicator: return "levelIndicator"
        case .cell: return "cell"
        case .layoutArea: return "layoutArea"
        case .layoutItem: return "layoutItem"
        case .handle: return "handle"
        case .stepper: return "stepper"
        case .tab: return "tab"
        case .touchBar: return "touchBar"
        case .statusItem: return "statusItem"
        @unknown default: return "unknown(\(type.rawValue))"
        }
    }
}

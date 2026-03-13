import Foundation

typealias RouteHandler = (Data?) -> (Int, Data)

final class Router {
    private var routes: [String: RouteHandler] = [:]
    private let lock = NSLock()

    func register(method: String, path: String, handler: @escaping RouteHandler) {
        let key = routeKey(method: method, path: path)
        lock.lock()
        routes[key] = handler
        lock.unlock()
    }

    func handle(method: String, path: String, body: Data?) -> (Int, Data) {
        let key = routeKey(method: method, path: path)
        lock.lock()
        let handler = routes[key]
        lock.unlock()

        guard let handler = handler else {
            return (404, Router.jsonResponse(["error": "Not found"]))
        }
        return handler(body)
    }

    private func routeKey(method: String, path: String) -> String {
        "\(method.uppercased()) \(path)"
    }

    static func jsonResponse(_ dict: [String: Any]) -> Data {
        (try? JSONSerialization.data(withJSONObject: dict, options: [])) ?? Data("{}".utf8)
    }
}

func jsonResponse(_ dict: [String: Any]) -> Data {
    Router.jsonResponse(dict)
}

func parseJSONBody(_ body: Data?) -> [String: Any]? {
    guard let body = body,
          let obj = try? JSONSerialization.jsonObject(with: body) as? [String: Any] else {
        return nil
    }
    return obj
}

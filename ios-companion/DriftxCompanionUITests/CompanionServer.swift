import Foundation
import Network
import XCTest

final class CompanionServer {
    private let port: UInt16
    private var app: XCUIApplication
    private let router: Router
    private var listener: NWListener?
    private let queue = DispatchQueue(label: "com.driftx.companion.server", attributes: .concurrent)

    init(port: UInt16, app: XCUIApplication) {
        self.port = port
        self.app = app
        self.router = Router()
        router.register(method: "GET", path: "/status") { _ in
            return (200, Router.jsonResponse(["status": "ready"]))
        }
        router.register(method: "POST", path: "/configure") { [weak self] body in
            guard let self = self,
                  let json = parseJSONBody(body),
                  let bundleId = json["bundleId"] as? String, !bundleId.isEmpty else {
                return (400, Router.jsonResponse(["success": false, "error": "Missing bundleId"]))
            }
            DispatchQueue.main.sync {
                let newApp = XCUIApplication(bundleIdentifier: bundleId)
                newApp.activate()
                self.app = newApp
                InteractionEndpoint.register(on: self.router, app: newApp)
                HierarchyEndpoint.register(on: self.router, app: newApp)
            }
            return (200, Router.jsonResponse(["success": true, "bundleId": bundleId]))
        }
        InteractionEndpoint.register(on: router, app: app)
        HierarchyEndpoint.register(on: router, app: app)
    }

    func start() {
        let params = NWParameters.tcp
        params.allowLocalEndpointReuse = true

        guard let nwPort = NWEndpoint.Port(rawValue: port) else {
            fatalError("Invalid port: \(port)")
        }

        do {
            listener = try NWListener(using: params, on: nwPort)
        } catch {
            fatalError("Failed to create listener: \(error)")
        }

        listener?.stateUpdateHandler = { state in
            switch state {
            case .ready:
                print("[DriftxCompanion] Server listening on port \(self.port)")
            case .failed(let error):
                fatalError("[DriftxCompanion] Listener failed: \(error)")
            default:
                break
            }
        }

        listener?.newConnectionHandler = { [weak self] connection in
            self?.handleConnection(connection)
        }

        listener?.start(queue: queue)
    }

    func stop() {
        listener?.cancel()
        listener = nil
    }

    private func handleConnection(_ connection: NWConnection) {
        connection.start(queue: queue)
        receiveRequest(connection: connection, buffer: Data())
    }

    private func receiveRequest(connection: NWConnection, buffer: Data) {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 65536) { [weak self] content, _, isComplete, error in
            guard let self = self else { return }

            if let error = error {
                print("[DriftxCompanion] Receive error: \(error)")
                connection.cancel()
                return
            }

            var accumulated = buffer
            if let content = content {
                accumulated.append(content)
            }

            if let request = self.parseHTTPRequest(accumulated) {
                self.dispatch(request: request, connection: connection)
            } else if isComplete {
                connection.cancel()
            } else {
                self.receiveRequest(connection: connection, buffer: accumulated)
            }
        }
    }

    private struct HTTPRequest {
        let method: String
        let path: String
        let headers: [String: String]
        let body: Data?
    }

    private func parseHTTPRequest(_ data: Data) -> HTTPRequest? {
        guard let str = String(data: data, encoding: .utf8) else { return nil }
        guard let headerEnd = str.range(of: "\r\n\r\n") else { return nil }

        let headerSection = String(str[str.startIndex..<headerEnd.lowerBound])
        let lines = headerSection.components(separatedBy: "\r\n")
        guard let requestLine = lines.first else { return nil }

        let parts = requestLine.components(separatedBy: " ")
        guard parts.count >= 2 else { return nil }

        let method = parts[0]
        let path = parts[1]

        var headers: [String: String] = [:]
        for line in lines.dropFirst() {
            if let colonIndex = line.firstIndex(of: ":") {
                let key = String(line[line.startIndex..<colonIndex]).trimmingCharacters(in: .whitespaces).lowercased()
                let value = String(line[line.index(after: colonIndex)...]).trimmingCharacters(in: .whitespaces)
                headers[key] = value
            }
        }

        let bodyStart = str[headerEnd.upperBound...]
        let bodyData = Data(bodyStart.utf8)

        if let contentLengthStr = headers["content-length"], let contentLength = Int(contentLengthStr) {
            if bodyData.count < contentLength {
                return nil
            }
            return HTTPRequest(method: method, path: path, headers: headers, body: bodyData.prefix(contentLength))
        }

        return HTTPRequest(method: method, path: path, headers: headers, body: bodyData.isEmpty ? nil : bodyData)
    }

    private func dispatch(request: HTTPRequest, connection: NWConnection) {
        let (statusCode, responseBody) = router.handle(method: request.method, path: request.path, body: request.body)
        sendResponse(connection: connection, statusCode: statusCode, body: responseBody)
    }

    private func sendResponse(connection: NWConnection, statusCode: Int, body: Data) {
        let statusText: String
        switch statusCode {
        case 200: statusText = "OK"
        case 400: statusText = "Bad Request"
        case 404: statusText = "Not Found"
        case 500: statusText = "Internal Server Error"
        default: statusText = "Unknown"
        }

        var response = "HTTP/1.1 \(statusCode) \(statusText)\r\n"
        response += "Content-Type: application/json\r\n"
        response += "Content-Length: \(body.count)\r\n"
        response += "Connection: close\r\n"
        response += "\r\n"

        var responseData = Data(response.utf8)
        responseData.append(body)

        connection.send(content: responseData, completion: .contentProcessed { _ in
            connection.cancel()
        })
    }
}

import Capacitor
import Foundation

#if canImport(FoundationModels)
import FoundationModels
#endif

/// Capacitor bridge for Apple's on-device LLM (Foundation Models, iOS 26+).
///
/// Resolves `available: false` (rather than throwing) when the framework
/// or Apple Intelligence is missing — the JS caller falls back to a
/// static text pack or, in v1.1+, a cloud proxy.
///
/// Structured / free-form methods:
///   - `generate(prompt, ...)`               → free-form String
///   - `generateStreaming(prompt, streamId, ...)` → same String + `foundationModelsStreamChunk` events
///   - `generateIrisLine(prompt, ...)`       → @Generable IrisLine, JSON-encoded
///   - `generateFloorFlavor(prompt, ...)`    → @Generable FloorFlavor, JSON-encoded
///   - `generateTerminalTakeover(prompt, ...)` → @Generable TerminalTakeover, JSON-encoded
///
/// The Generable macro emits a schema the framework uses for
/// grammar-constrained decoding — the model literally cannot emit
/// fields of the wrong shape, missing keys, or strings violating
/// length/regex constraints. Eliminates the "model returned a paragraph
/// when I wanted 3 words" failure mode.

// MARK: - Generable schemas

#if canImport(FoundationModels)
@available(iOS 26.0, *)
@Generable
struct IrisLine: Codable {
    @Guide(description: "A single in-character line from the iris.exe antagonist. 6 to 14 words. Terse, contemptuous, glitchy. No quotation marks, no preamble, no name labels.")
    var line: String
}

@available(iOS 26.0, *)
@Generable
struct FloorFlavor: Codable {
    @Guide(description: "Evocative floor name, 1 to 3 words. Title case. No punctuation.")
    var name: String

    @Guide(description: "Single biome-flavor sentence, 6 to 18 words. Cyberpunk tone.")
    var description: String
}

@available(iOS 26.0, *)
@Generable
struct TerminalTakeover: Codable {
    @Guide(description: "One hostile iris.exe terminal line, max 14 words. No quotation marks, no labels, terse glitchy tone.")
    var line: String
}
#endif

@objc(FoundationModelsPlugin)
public class FoundationModelsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "FoundationModelsPlugin"
    public let jsName = "FoundationModels"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "generate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "generateStreaming", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "generateIrisLine", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "generateFloorFlavor", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "generateTerminalTakeover", returnType: CAPPluginReturnPromise),
    ]

    @objc func isAvailable(_ call: CAPPluginCall) {
        if #available(iOS 26.0, *) {
            #if canImport(FoundationModels)
            let model = SystemLanguageModel.default
            switch model.availability {
            case .available:
                call.resolve(["available": true])
            case .unavailable(let reason):
                call.resolve([
                    "available": false,
                    "reason": String(describing: reason),
                ])
            }
            #else
            call.resolve([
                "available": false,
                "reason": "FoundationModels framework not in SDK at compile time",
            ])
            #endif
        } else {
            call.resolve([
                "available": false,
                "reason": "iOS < 26.0",
            ])
        }
    }

    @objc func generate(_ call: CAPPluginCall) {
        guard let prompt = call.getString("prompt") else {
            call.reject("Missing required field: prompt")
            return
        }
        let systemPrompt = call.getString("systemPrompt")
        let temperature = call.getDouble("temperature") ?? 0.7
        let maxTokens = call.getInt("maxTokens") ?? 1024

        if #available(iOS 26.0, *) {
            #if canImport(FoundationModels)
            Task {
                do {
                    let model = SystemLanguageModel.default
                    guard case .available = model.availability else {
                        call.reject("FoundationModels unavailable on this device")
                        return
                    }

                    let session = Self.makeSession(systemPrompt: systemPrompt)
                    let options = GenerationOptions(
                        temperature: temperature,
                        maximumResponseTokens: maxTokens
                    )

                    // Hard-bound the Apple Intelligence call. Without this,
                    // a wedged framework (asset hydration, Apple Intelligence
                    // toggled mid-call, low-power throttle) leaves the JS
                    // side awaiting forever. The JS layer also bounds the
                    // round-trip independently — this is the second guard
                    // for the case where Capacitor's bridge swallows the
                    // rejection.
                    let text = try await Self.withTimeout(seconds: 15) {
                        let response = try await session.respond(to: prompt, options: options)
                        return response.content
                    }
                    call.resolve(["text": text])
                } catch is FoundationModelsTimeout {
                    call.reject("FoundationModels generation timed out after 15s")
                } catch {
                    call.reject("FoundationModels generation failed: \(error.localizedDescription)")
                }
            }
            #else
            call.reject("FoundationModels framework not in SDK at compile time")
            #endif
        } else {
            call.reject("iOS < 26.0; FoundationModels unavailable")
        }
    }

    /// Free-form generation with incremental JS notifications (`foundationModelsStreamChunk`).
    @objc func generateStreaming(_ call: CAPPluginCall) {
        guard let prompt = call.getString("prompt") else {
            call.reject("Missing required field: prompt")
            return
        }
        let streamId = call.getString("streamId") ?? UUID().uuidString
        let systemPrompt = call.getString("systemPrompt")
        let temperature = call.getDouble("temperature") ?? 0.7
        let maxTokens = call.getInt("maxTokens") ?? 1024

        if #available(iOS 26.0, *) {
            #if canImport(FoundationModels)
            Task {
                do {
                    let model = SystemLanguageModel.default
                    guard case .available = model.availability else {
                        call.reject("FoundationModels unavailable on this device")
                        return
                    }

                    let session = Self.makeSession(systemPrompt: systemPrompt)
                    let options = GenerationOptions(
                        temperature: temperature,
                        maximumResponseTokens: maxTokens
                    )

                    let finalText = try await Self.withTimeout(seconds: 15) {
                        var accumulated = ""
                        let stream = session.streamResponse(options: options) { prompt }
                        for try await piece in stream {
                            accumulated = piece
                            self.notifyListeners(
                                "foundationModelsStreamChunk",
                                data: [
                                    "streamId": streamId,
                                    "text": accumulated,
                                ]
                            )
                        }
                        return accumulated
                    }
                    call.resolve(["text": finalText])
                } catch is FoundationModelsTimeout {
                    call.reject("FoundationModels generation timed out after 15s")
                } catch {
                    call.reject("FoundationModels generation failed: \(error.localizedDescription)")
                }
            }
            #else
            call.reject("FoundationModels framework not in SDK at compile time")
            #endif
        } else {
            call.reject("iOS < 26.0; FoundationModels unavailable")
        }
    }

    /// Grammar-constrained iris.exe taunt generation via @Generable.
    /// Returns `{text: <JSON-encoded IrisLine>}` — JS parses the JSON to
    /// extract `.line`. Same return shape as `generate` so the bridge
    /// contract stays uniform across all three methods.
    @objc func generateIrisLine(_ call: CAPPluginCall) {
        if #available(iOS 26.0, *) {
            #if canImport(FoundationModels)
            generateStructured(call: call, type: IrisLine.self)
            #else
            call.reject("FoundationModels framework not in SDK at compile time")
            #endif
        } else {
            call.reject("iOS < 26.0; FoundationModels unavailable")
        }
    }

    /// Grammar-constrained floor name + biome line via @Generable.
    @objc func generateFloorFlavor(_ call: CAPPluginCall) {
        if #available(iOS 26.0, *) {
            #if canImport(FoundationModels)
            generateStructured(call: call, type: FloorFlavor.self)
            #else
            call.reject("FoundationModels framework not in SDK at compile time")
            #endif
        } else {
            call.reject("iOS < 26.0; FoundationModels unavailable")
        }
    }

    @objc func generateTerminalTakeover(_ call: CAPPluginCall) {
        if #available(iOS 26.0, *) {
            #if canImport(FoundationModels)
            generateStructured(call: call, type: TerminalTakeover.self)
            #else
            call.reject("FoundationModels framework not in SDK at compile time")
            #endif
        } else {
            call.reject("iOS < 26.0; FoundationModels unavailable")
        }
    }

    // MARK: - Shared structured-generation envelope

    #if canImport(FoundationModels)
    @available(iOS 26.0, *)
    private func generateStructured<T: Codable & Generable>(
        call: CAPPluginCall,
        type: T.Type
    ) {
        guard let prompt = call.getString("prompt") else {
            call.reject("Missing required field: prompt")
            return
        }
        let systemPrompt = call.getString("systemPrompt")
        let temperature = call.getDouble("temperature") ?? 0.7
        let maxTokens = call.getInt("maxTokens") ?? 256

        Task {
            do {
                let model = SystemLanguageModel.default
                guard case .available = model.availability else {
                    call.reject("FoundationModels unavailable on this device")
                    return
                }

                let session = Self.makeSession(systemPrompt: systemPrompt)
                let options = GenerationOptions(
                    temperature: temperature,
                    maximumResponseTokens: maxTokens
                )

                let result = try await Self.withTimeout(seconds: 15) {
                    let response = try await session.respond(
                        to: prompt,
                        generating: T.self,
                        options: options
                    )
                    return response.content
                }

                // Encode typed Swift value to JSON for the JS bridge.
                // Default JSONEncoder emits Optional nil as `null`; JS
                // parser treats null and missing keys identically.
                let jsonData = try JSONEncoder().encode(result)
                guard let jsonString = String(data: jsonData, encoding: .utf8) else {
                    call.reject("FoundationModels: failed to encode \(T.self) to JSON")
                    return
                }
                call.resolve(["text": jsonString])
            } catch is FoundationModelsTimeout {
                call.reject("FoundationModels generation timed out after 15s")
            } catch {
                call.reject("FoundationModels generation failed: \(error.localizedDescription)")
            }
        }
    }
    #endif

    #if canImport(FoundationModels)
    @available(iOS 26.0, *)
    private static func makeSession(systemPrompt: String?) -> LanguageModelSession {
        if let sp = systemPrompt, !sp.isEmpty {
            return LanguageModelSession(instructions: Instructions { sp })
        }
        return LanguageModelSession()
    }
    #endif

    /// Race an async throwing operation against a wall-clock deadline.
    /// First task to finish wins; the loser is cancelled. If the deadline
    /// task wins, the operation continues running (Swift can't preempt
    /// Apple's framework) but its eventual result is discarded — the
    /// promise to JS rejects on time.
    @available(iOS 16.0, *)
    private static func withTimeout<T: Sendable>(
        seconds: Double,
        operation: @escaping @Sendable () async throws -> T
    ) async throws -> T {
        try await withThrowingTaskGroup(of: T.self) { group in
            group.addTask { try await operation() }
            group.addTask {
                try await Task.sleep(for: .seconds(seconds))
                throw FoundationModelsTimeout()
            }
            guard let result = try await group.next() else {
                throw FoundationModelsTimeout()
            }
            group.cancelAll()
            return result
        }
    }
}

private struct FoundationModelsTimeout: Error {}

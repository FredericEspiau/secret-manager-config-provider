import type { Array } from "effect"
import { ConfigProvider, Effect, HashMap, Layer, pipe } from "effect"
import { GcpSecretManagerConfig } from "./config.js"
import { GcpSecretManager } from "./GcpSecretManager.js"
import { SecretMap } from "./secret-map.js"

type SecretInput = string | { nameInSecretManager: string; nameInConfig: string }

interface ConfigProviderInput {
  projectId: string
  secrets: Array.NonEmptyReadonlyArray<SecretInput>
}

const fromSecretManager = (input: ConfigProviderInput) =>
  Effect.gen(function*() {
    const gcpSecretManager = yield* GcpSecretManager

    const secretMapForConfigProvider = yield* pipe(
      Effect.forEach(
        input.secrets,
        (secretInput) =>
          Effect.gen(function*() {
            const nameInConfig = typeof secretInput === "string" ? secretInput : secretInput.nameInConfig
            const nameInSecretManager = typeof secretInput === "string" ? secretInput : secretInput.nameInSecretManager

            const secretResult = yield* Effect.option(gcpSecretManager.getSecret(nameInSecretManager))

            return [nameInConfig, secretResult] as const
          }),
        { concurrency: "unbounded" }
      ),
      Effect.map(HashMap.fromIterable),
      Effect.map(HashMap.compact),
      Effect.map(
        HashMap.reduce(yield* SecretMap, (map, value, key) => {
          map.set(key, value)
          return map
        })
      )
    )

    return ConfigProvider.fromMap(secretMapForConfigProvider)
  })

/**
 * Creates a Layer that provides configuration from GCP Secret Manager only.
 * Fails if secrets cannot be retrieved.
 */
export const layerGcp = (input: ConfigProviderInput) =>
  pipe(
    fromSecretManager(input),
    Effect.map(Layer.setConfigProvider),
    Layer.unwrapScoped,
    Layer.provide(GcpSecretManager.Default),
    Layer.provide(Layer.succeed(GcpSecretManagerConfig, GcpSecretManagerConfig.of({ projectId: input.projectId })))
  )

/**
 * Creates a Layer that provides configuration from GCP Secret Manager,
 * falling back to environment variables if a secret fails to load.
 */
export const layerGcpWithEnvFallback = (input: ConfigProviderInput) =>
  pipe(
    fromSecretManager(input),
    Effect.map(ConfigProvider.orElse(() => ConfigProvider.fromEnv())),
    Effect.map(Layer.setConfigProvider),
    Layer.unwrapScoped,
    Layer.provide(GcpSecretManager.Default),
    Layer.provide(Layer.succeed(GcpSecretManagerConfig, GcpSecretManagerConfig.of({ projectId: input.projectId })))
  )

/**
 * Creates a Layer that provides configuration from GCP Secret Manager,
 * falling back to a JSON object if a secret fails to load.
 */
export const layerGcpWithJsonFallback = ({ json, projectId, secrets }: ConfigProviderInput & { json: unknown }) =>
  pipe(
    fromSecretManager({ projectId, secrets }),
    Effect.map(ConfigProvider.orElse(() => ConfigProvider.fromJson(json))),
    Effect.map(Layer.setConfigProvider),
    Layer.unwrapScoped,
    Layer.provide(GcpSecretManager.Default),
    Layer.provide(Layer.succeed(GcpSecretManagerConfig, GcpSecretManagerConfig.of({ projectId })))
  )

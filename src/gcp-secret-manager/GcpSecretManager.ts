import { SecretManagerServiceClient } from "@google-cloud/secret-manager"
import { Effect, Option } from "effect"
import { GcpSecretManagerConfig } from "./config.js"

export class GcpSecretManager extends Effect.Service<GcpSecretManager>()("@inato/GcpSecretManager", {
  scoped: Effect.gen(function*() {
    // Get configuration from context
    const { projectId } = yield* GcpSecretManagerConfig

    // Acquire the GCP client with automatic cleanup
    const client = yield* Effect.acquireRelease(
      Effect.sync(() => new SecretManagerServiceClient()),
      (client) => Effect.promise(() => client.close())
    )

    // Define the getSecret function
    const getSecret = (name: string) =>
      Effect.tryPromise(() =>
        client.accessSecretVersion({
          name: `projects/${projectId}/secrets/${name}/versions/latest`
        })
      ).pipe(Effect.flatMap(([secret]) => Option.fromNullable(secret.payload?.data?.toString())))

    return { getSecret } as const
  })
}) {}

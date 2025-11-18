import { Context } from "effect"

export interface GcpSecretManagerConfigShape {
  readonly projectId: string
}

export class GcpSecretManagerConfig extends Context.Tag("@inato/GcpSecretManager/Config")<
  GcpSecretManagerConfig,
  GcpSecretManagerConfigShape
>() {}

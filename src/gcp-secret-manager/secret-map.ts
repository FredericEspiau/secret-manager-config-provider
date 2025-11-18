import { Context } from "effect"

export class SecretMap extends Context.Reference<SecretMap>()(
  "@inato/GcpSecretManagerConfigProvider/SecretMap",
  { defaultValue: () => new Map<string, string>() }
) {}
